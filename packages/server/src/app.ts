import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { CommandEnvelopeSchema } from "@pagesai/core";
import { handleCommand } from "@pagesai/commands";
import { extractPageRefs } from "@pagesai/documents";
import { createDb, runMigrations, schema } from "@pagesai/storage";
import { and, eq, ilike, or } from "drizzle-orm";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { resolveAuth, type AuthContext } from "./auth.js";
import { registerSsoMiddleware } from "./middleware/sso.js";
import { createS3Client, ensureBucket, getObjectStream, putObjectBytes, type S3Config } from "./s3.js";
import { registerStaticWeb } from "./static-web.js";
import * as Y from "yjs";
import { applyUpdate, encodeFullUpdate, getOrCreateRoom } from "./yjs-room.js";

export type ServerOptions = {
  databaseUrl: string;
  devToken?: string;
  jwtSecret?: string;
  s3?: S3Config;
};

export async function buildApp(opts: ServerOptions) {
  const { sql, db } = createDb(opts.databaseUrl);
  await runMigrations(sql);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 400, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 52 * 1024 * 1024 } });
  await app.register(websocket);
  registerSsoMiddleware(app);

  let s3Runtime: { client: ReturnType<typeof createS3Client>; bucket: string } | null = null;
  if (opts.s3) {
    const client = createS3Client(opts.s3);
    await ensureBucket(client, opts.s3.bucket);
    s3Runtime = { client, bucket: opts.s3.bucket };
  }

  app.decorate("db", db);
  app.decorate("sql", sql);

  const seed = await db
    .select()
    .from(schema.spaces)
    .where(eq(schema.spaces.tenantId, "dev-tenant"))
    .limit(1);
  if (!seed[0]) {
    await db.insert(schema.spaces).values({ tenantId: "dev-tenant", name: "Default" });
  }

  app.addHook("preHandler", async (req, reply) => {
    if (req.url === "/health") return;
    if (req.url.startsWith("/api/ws")) return;
    const auth = await resolveAuth(req, { devToken: opts.devToken, jwtSecret: opts.jwtSecret });
    if (!auth) {
      reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
      return;
    }
    (req as typeof req & { auth: AuthContext }).auth = auth;
  });

  app.post("/api/commands", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const parsed = CommandEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: { code: "VALIDATION", message: parsed.error.message } });
      return;
    }
    const result = await handleCommand(parsed.data, { tenantId: auth.tenantId, db });
    if (result.status === "failed") {
      reply.code(400).send({ error: result.error });
      return;
    }
    return result;
  });

  app.get("/api/me", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    return {
      userId: auth.actorId,
      actorId: auth.actorId,
      tenantId: auth.tenantId,
      email: auth.email ?? null,
      displayName: auth.displayName ?? auth.email ?? auth.actorId,
    };
  });

  app.get("/api/spaces", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    return handleCommand(
      {
        type: "space.list",
        payload: {},
        actor_id: auth.actorId,
        actor_type: "human",
      },
      { tenantId: auth.tenantId, db },
    );
  });

  app.get("/api/pages", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const q = req.query as Record<string, string | undefined>;
    const payload: Record<string, unknown> = { space_id: q.space_id };
    if (q.parent_page_id) payload.parent_page_id = q.parent_page_id;
    if (q.all_in_space === "1" || q.all_in_space === "true") payload.all_in_space = true;
    return handleCommand(
      {
        type: "page.list",
        payload,
        actor_id: auth.actorId,
        actor_type: "human",
      },
      { tenantId: auth.tenantId, db },
    );
  });

  app.get("/api/pages/:id", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const id = (req.params as { id: string }).id;
    const page = await db
      .select()
      .from(schema.pages)
      .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
      .where(and(eq(schema.pages.id, id), eq(schema.spaces.tenantId, auth.tenantId)))
      .limit(1);
    if (!page[0]) {
      reply.code(404).send({ error: { code: "NOT_FOUND", message: "page" } });
      return;
    }
    const blocks = await db
      .select()
      .from(schema.blocks)
      .where(eq(schema.blocks.pageId, id))
      .orderBy(schema.blocks.sortOrder);
    return { page: page[0].pages, blocks };
  });

  app.get("/api/search", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const q = (req.query as { q?: string }).q ?? "";
    if (!q.trim()) return { results: [] };
    const pattern = `%${q}%`;
    const rows = await db
      .select({ id: schema.pages.id, title: schema.pages.title })
      .from(schema.pages)
      .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
      .where(
        and(
          eq(schema.spaces.tenantId, auth.tenantId),
          or(ilike(schema.pages.title, pattern), ilike(schema.pages.searchDocument, pattern)),
        ),
      )
      .limit(50);
    return { results: rows };
  });

  app.get("/api/backlinks/:pageId", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const pageId = (req.params as { pageId: string }).pageId;
    const blocks = await db
      .select()
      .from(schema.blocks)
      .innerJoin(schema.pages, eq(schema.blocks.pageId, schema.pages.id))
      .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
      .where(eq(schema.spaces.tenantId, auth.tenantId));

    const incoming: { pageId: string; blockId: string }[] = [];
    for (const row of blocks) {
      const refs = extractPageRefs(row.blocks.content as Record<string, unknown>);
      if (refs.includes(pageId)) {
        incoming.push({ pageId: row.blocks.pageId, blockId: row.blocks.id });
      }
    }
    return { backlinks: incoming };
  });

  app.get("/api/comments", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const pageId = (req.query as { page_id: string }).page_id;
    const page = await db
      .select()
      .from(schema.pages)
      .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
      .where(and(eq(schema.pages.id, pageId), eq(schema.spaces.tenantId, auth.tenantId)))
      .limit(1);
    if (!page[0]) return { comments: [] };
    const list = await db.select().from(schema.comments).where(eq(schema.comments.pageId, pageId));
    return { comments: list };
  });

  app.get("/api/databases", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const spaceId = (req.query as { space_id?: string }).space_id;
    if (!spaceId) {
      reply.code(400).send({ error: { code: "VALIDATION", message: "space_id required" } });
      return;
    }
    const space = await db
      .select()
      .from(schema.spaces)
      .where(and(eq(schema.spaces.id, spaceId), eq(schema.spaces.tenantId, auth.tenantId)))
      .limit(1);
    if (!space[0]) {
      reply.code(404).send({ error: { code: "NOT_FOUND", message: "space" } });
      return;
    }
    const list = await db.select().from(schema.databases).where(eq(schema.databases.spaceId, spaceId));
    return { databases: list };
  });

  app.get("/api/databases/:id", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const id = (req.params as { id: string }).id;
    const d = await db
      .select()
      .from(schema.databases)
      .innerJoin(schema.spaces, eq(schema.databases.spaceId, schema.spaces.id))
      .where(and(eq(schema.databases.id, id), eq(schema.spaces.tenantId, auth.tenantId)))
      .limit(1);
    if (!d[0]) {
      reply.code(404).send({ error: { code: "NOT_FOUND", message: "database" } });
      return;
    }
    const views = await db
      .select()
      .from(schema.databaseViews)
      .where(eq(schema.databaseViews.databaseId, id));
    return { database: d[0].databases, views };
  });

  app.post("/api/spaces/:spaceId/upload", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    if (!s3Runtime) {
      reply
        .code(503)
        .send({ error: { code: "UNAVAILABLE", message: "Object storage is not configured" } });
      return;
    }
    const spaceId = (req.params as { spaceId: string }).spaceId;
    const space = await db
      .select()
      .from(schema.spaces)
      .where(and(eq(schema.spaces.id, spaceId), eq(schema.spaces.tenantId, auth.tenantId)))
      .limit(1);
    if (!space[0]) {
      reply.code(404).send({ error: { code: "NOT_FOUND", message: "space" } });
      return;
    }
    const file = await req.file();
    if (!file) {
      reply.code(400).send({ error: { code: "VALIDATION", message: "file field required" } });
      return;
    }
    const buf = await file.toBuffer();
    const mime = file.mimetype || "application/octet-stream";
    const orig = file.filename || "upload";
    const safe = orig.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const key = `${auth.tenantId}/${spaceId}/${randomUUID()}-${safe}`;
    await putObjectBytes(s3Runtime.client, s3Runtime.bucket, key, buf, mime);
    return {
      asset: {
        provider: "standalone-s3",
        object_key: key,
        mime_type: mime,
        display_name: orig,
        size_bytes: buf.length,
      },
    };
  });

  app.get("/api/assets", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    if (!s3Runtime) {
      reply
        .code(503)
        .send({ error: { code: "UNAVAILABLE", message: "Object storage is not configured" } });
      return;
    }
    const key = (req.query as { key?: string }).key;
    if (!key || typeof key !== "string") {
      reply.code(400).send({ error: { code: "VALIDATION", message: "key query required" } });
      return;
    }
    if (!key.startsWith(`${auth.tenantId}/`)) {
      reply.code(403).send({ error: { code: "FORBIDDEN", message: "invalid key" } });
      return;
    }
    try {
      const { body, contentType } = await getObjectStream(s3Runtime.client, s3Runtime.bucket, key);
      reply.header("Content-Type", contentType ?? "application/octet-stream");
      reply.header("Cache-Control", "private, max-age=3600");
      return reply.send(body);
    } catch {
      reply.code(404).send({ error: { code: "NOT_FOUND", message: "asset" } });
    }
  });

  app.post("/api/databases/:id/query", async (req, reply) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const id = (req.params as { id: string }).id;
    const body = req.body as { view_id?: string };
    const viewId = body?.view_id;
    if (!viewId || typeof viewId !== "string") {
      reply.code(400).send({ error: { code: "VALIDATION", message: "view_id required" } });
      return;
    }
    const result = await handleCommand(
      {
        type: "db.query",
        payload: { database_id: id, view_id: viewId },
        actor_id: auth.actorId,
        actor_type: "human",
      },
      { tenantId: auth.tenantId, db },
    );
    if (result.status === "failed") {
      reply.code(400).send({ error: result.error });
      return;
    }
    return result;
  });

  app.get("/api/proposals", async (req) => {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const q = req.query as { space_id?: string; status?: string };
    const payload: Record<string, unknown> = {};
    if (q.space_id) payload.space_id = q.space_id;
    if (q.status === "pending" || q.status === "approved" || q.status === "rejected")
      payload.status = q.status;
    return handleCommand(
      {
        type: "proposal.list",
        payload,
        actor_id: auth.actorId,
        actor_type: "human",
      },
      { tenantId: auth.tenantId, db },
    );
  });

  app.get("/health", async () => ({ ok: true }));

  app.register(async function (fastify) {
    fastify.get("/api/ws", { websocket: true }, async (socket, req) => {
      const auth = await resolveAuth(req, { devToken: opts.devToken, jwtSecret: opts.jwtSecret });
      if (!auth) {
        socket.close(1008, "unauthorized");
        return;
      }

      socket.on("message", (raw: unknown) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            t: string;
            docId?: string;
            pageId?: string;
            update?: number[];
          };
          if (msg.t === "sync_update" && msg.docId && msg.update) {
            const u = new Uint8Array(msg.update);
            applyUpdate(msg.docId, u);
            const doc = getOrCreateRoom(msg.docId);
            const merged = Y.encodeStateAsUpdate(doc);
            socket.send(
              JSON.stringify({ t: "sync_update", docId: msg.docId, update: [...merged] }),
            );
          }
          if (msg.t === "sync_step1" && msg.docId) {
            const full = encodeFullUpdate(msg.docId);
            socket.send(JSON.stringify({ t: "sync_update", docId: msg.docId, update: [...full] }));
          }
        } catch {
          socket.send(JSON.stringify({ t: "error", code: "BAD_MESSAGE" }));
        }
      });
    });
  });

  app.addHook("onClose", async () => {
    await sql.end({ timeout: 5 });
  });

  await registerStaticWeb(app);

  return app;
}
