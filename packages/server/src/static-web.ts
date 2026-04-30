import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESERVED_PREFIXES = ["/api/", "/health", "/readyz", "/openapi.json"];

function resolveWebDist(): string | null {
  const explicit = (process.env["PAGESAI_WEB_DIST"] ?? "").trim();
  const candidates = [
    explicit,
    "/app/web",
    resolve(__dirname, "../../web/dist"),
    resolve(__dirname, "../../../web/dist"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

export async function registerStaticWeb(app: FastifyInstance): Promise<void> {
  const dist = resolveWebDist();
  if (!dist) {
    app.log.info("PagesAI web dist not found; serving API-only backend");
    return;
  }

  await app.register(fastifyStatic, {
    root: dist,
    prefix: "/",
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    const path = new URL(request.url, "http://pagesai.local").pathname;
    if (RESERVED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return reply.status(404).send({ error: { code: "not_found" } });
    }
    return reply.sendFile("index.html");
  });
}
