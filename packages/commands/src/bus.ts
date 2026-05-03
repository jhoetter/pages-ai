import {
  BlockAppendPayload,
  BlockDeletePayload,
  BlockInsertPayload,
  BlockMovePayload,
  BlockUpdatePayload,
  CommandEnvelope,
  CommandResult,
  DatabaseCreatePayload,
  DbPropertyAddPayload,
  DbQueryPayload,
  DbRowCreatePayload,
  DbRowUpdatePayload,
  DbViewCreatePayload,
  PageArchivePayload,
  PageBodySyncPayloadSchema,
  PageCreatePayload,
  PageListPayload,
  PageMovePayload,
  PageUpdatePayload,
  ProposalCreatePayload,
  ProposalListPayload,
  CommentCreatePayload,
} from "@pagesai/core";
import { applyFilters, applySorts, type ViewQuery } from "@pagesai/databases";
import { extractPlainText, markdownToBlocks, paragraphFromText } from "@pagesai/documents";
import type { Db } from "@pagesai/storage";
import * as schema from "@pagesai/storage/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type CommandContext = {
  tenantId: string;
  db: Db;
};

async function nextBlockSort(
  db: Db,
  pageId: string,
  parentBlockId: string | null,
): Promise<number> {
  const rows = await db
    .select({ sortOrder: schema.blocks.sortOrder })
    .from(schema.blocks)
    .where(
      and(
        eq(schema.blocks.pageId, pageId),
        parentBlockId
          ? eq(schema.blocks.parentBlockId, parentBlockId)
          : isNull(schema.blocks.parentBlockId),
      ),
    )
    .orderBy(desc(schema.blocks.sortOrder))
    .limit(1);
  return (rows[0]?.sortOrder ?? 0) + 1;
}

async function refreshPageSearch(db: Db, pageId: string): Promise<void> {
  const bl = await db
    .select({ content: schema.blocks.content })
    .from(schema.blocks)
    .where(eq(schema.blocks.pageId, pageId));
  const doc = bl.map((b) => extractPlainText(b.content as Record<string, unknown>)).join("\n");
  await db
    .update(schema.pages)
    .set({ searchDocument: doc, updatedAt: new Date() })
    .where(eq(schema.pages.id, pageId));
}

export async function handleCommand(
  envelope: CommandEnvelope,
  ctx: CommandContext,
): Promise<CommandResult> {
  const commandId = envelope.command_id ?? randomUUID();
  const baseOps = { commandId, actorId: envelope.actor_id, actorType: envelope.actor_type };

  const fail = (code: string, message: string): CommandResult => ({
    command_id: commandId,
    status: "failed",
    operations: [],
    error: { code, message },
  });

  const { db, tenantId } = ctx;

  if (envelope.idempotency_key) {
    const existing = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(
        and(
          eq(schema.idempotencyKeys.actorId, envelope.actor_id),
          eq(schema.idempotencyKeys.key, envelope.idempotency_key),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return existing[0].result as unknown as CommandResult;
    }
  }

  try {
    switch (envelope.type) {
      case "space.create": {
        const name = String(envelope.payload.name ?? "Space");
        let row = (
          await db
            .select()
            .from(schema.spaces)
            .where(eq(schema.spaces.tenantId, tenantId))
            .limit(1)
        )[0];
        if (!row) {
          try {
            const [inserted] = await db.insert(schema.spaces).values({ tenantId, name }).returning();
            row = inserted;
          } catch (e) {
            const code =
              e !== null && typeof e === "object" && "code" in e
                ? String((e as { code: unknown }).code)
                : "";
            if (code !== "23505") throw e;
            row = (
              await db
                .select()
                .from(schema.spaces)
                .where(eq(schema.spaces.tenantId, tenantId))
                .limit(1)
            )[0];
            if (!row) throw e;
          }
        }
        const op = { op_type: "space.created", payload: { id: row.id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        const result: CommandResult = {
          command_id: commandId,
          status: "applied",
          operations: [op],
        };
        if (envelope.idempotency_key)
          await db.insert(schema.idempotencyKeys).values({
            actorId: envelope.actor_id,
            key: envelope.idempotency_key,
            result: result as unknown as Record<string, unknown>,
          });
        return result;
      }
      case "space.list": {
        const list = await db
          .select()
          .from(schema.spaces)
          .where(eq(schema.spaces.tenantId, tenantId));
        const op = { op_type: "space.listed", payload: { spaces: list } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "page.create": {
        const p = PageCreatePayload.parse(envelope.payload);
        const space = await db
          .select()
          .from(schema.spaces)
          .where(and(eq(schema.spaces.id, p.space_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!space[0]) return fail("NOT_FOUND", "space not found");
        const sortOrder = Date.now();
        const [page] = await db
          .insert(schema.pages)
          .values({
            spaceId: p.space_id,
            parentPageId: p.parent_page_id ?? null,
            title: p.title,
            icon: p.icon ?? null,
            sortOrder,
          })
          .returning();
        const sortOrderBlock = await nextBlockSort(db, page.id, null);
        await db.insert(schema.blocks).values({
          pageId: page.id,
          parentBlockId: null,
          type: "paragraph",
          properties: {},
          content: paragraphFromText("") as Record<string, unknown>,
          sortOrder: sortOrderBlock,
        });
        await refreshPageSearch(db, page.id);
        const op = { op_type: "page.created", payload: { page } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        const result: CommandResult = {
          command_id: commandId,
          status: "applied",
          operations: [op],
        };
        if (envelope.idempotency_key)
          await db.insert(schema.idempotencyKeys).values({
            actorId: envelope.actor_id,
            key: envelope.idempotency_key,
            result: result as unknown as Record<string, unknown>,
          });
        return result;
      }
      case "page.list": {
        const p = PageListPayload.parse(envelope.payload);
        const space = await db
          .select()
          .from(schema.spaces)
          .where(and(eq(schema.spaces.id, p.space_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!space[0]) return fail("NOT_FOUND", "space not found");
        const conds = [eq(schema.pages.spaceId, p.space_id)];
        if (!p.all_in_space) {
          if (p.parent_page_id)
            conds.push(eq(schema.pages.parentPageId, p.parent_page_id));
          else conds.push(isNull(schema.pages.parentPageId));
        }
        const list = await db.select().from(schema.pages).where(and(...conds));
        const op = { op_type: "page.listed", payload: { pages: list } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "page.update": {
        const p = PageUpdatePayload.parse(envelope.payload);
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, p.page_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        await db
          .update(schema.pages)
          .set({
            ...(p.title !== undefined ? { title: p.title } : {}),
            ...(p.icon !== undefined ? { icon: p.icon } : {}),
            ...(p.cover_image_url !== undefined ? { coverImageUrl: p.cover_image_url } : {}),
            ...(p.cover_image_position !== undefined
              ? { coverImagePosition: p.cover_image_position }
              : {}),
            ...(p.parent_page_id !== undefined ? { parentPageId: p.parent_page_id } : {}),
            ...(p.sort_order !== undefined ? { sortOrder: p.sort_order } : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.pages.id, p.page_id));
        const op = { op_type: "page.updated", payload: { page_id: p.page_id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "page.move": {
        const p = PageMovePayload.parse(envelope.payload);
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, p.page_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        await db
          .update(schema.pages)
          .set({
            parentPageId: p.parent_page_id ?? null,
            sortOrder: p.sort_order ?? Date.now(),
            updatedAt: new Date(),
          })
          .where(eq(schema.pages.id, p.page_id));
        const op = { op_type: "page.moved", payload: { page_id: p.page_id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "page.archive": {
        const p = PageArchivePayload.parse(envelope.payload);
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, p.page_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        await db
          .update(schema.pages)
          .set({
            archivedAt: p.archived ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.pages.id, p.page_id));
        const op = {
          op_type: "page.archived",
          payload: { page_id: p.page_id, archived: p.archived },
        };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "block.append": {
        const p = BlockAppendPayload.parse(envelope.payload);
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, p.page_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        const sortOrder = await nextBlockSort(db, p.page_id, p.parent_block_id ?? null);
        const content = p.text
          ? paragraphFromText(p.text)
          : { root: { type: "root", children: [] } };
        const [block] = await db
          .insert(schema.blocks)
          .values({
            pageId: p.page_id,
            parentBlockId: p.parent_block_id ?? null,
            type: p.type,
            properties: p.properties ?? {},
            content: content as Record<string, unknown>,
            sortOrder,
          })
          .returning();
        await refreshPageSearch(db, p.page_id);
        const op = { op_type: "block.appended", payload: { block } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "block.insert": {
        const p = BlockInsertPayload.parse(envelope.payload);
        const after = await db
          .select()
          .from(schema.blocks)
          .where(eq(schema.blocks.id, p.after_block_id))
          .limit(1);
        if (!after[0]) return fail("NOT_FOUND", "block not found");
        const pageId = after[0].pageId;
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, pageId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        const sortOrder = after[0].sortOrder + 0.5;
        const content = p.text
          ? paragraphFromText(p.text)
          : { root: { type: "root", children: [] } };
        const [block] = await db
          .insert(schema.blocks)
          .values({
            pageId,
            parentBlockId: after[0].parentBlockId,
            type: p.type,
            properties: p.properties ?? {},
            content: content as Record<string, unknown>,
            sortOrder,
          })
          .returning();
        await refreshPageSearch(db, pageId);
        const op = { op_type: "block.inserted", payload: { block } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "block.update": {
        const p = BlockUpdatePayload.parse(envelope.payload);
        const existing = await db
          .select()
          .from(schema.blocks)
          .where(eq(schema.blocks.id, p.block_id))
          .limit(1);
        if (!existing[0]) return fail("NOT_FOUND", "block not found");
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, existing[0].pageId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        const nextContent = p.text
          ? paragraphFromText(p.text)
          : (existing[0].content as Record<string, unknown>);
        const nextProps =
          p.properties !== undefined
            ? { ...(existing[0].properties as Record<string, unknown>), ...p.properties }
            : (existing[0].properties as Record<string, unknown>);
        await db
          .update(schema.blocks)
          .set({
            type: p.type ?? existing[0].type,
            properties: nextProps,
            content: nextContent as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(schema.blocks.id, p.block_id));
        await refreshPageSearch(db, existing[0].pageId);
        const op = { op_type: "block.updated", payload: { block_id: p.block_id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "block.move": {
        const p = BlockMovePayload.parse(envelope.payload);
        const blk = await db
          .select()
          .from(schema.blocks)
          .where(eq(schema.blocks.id, p.block_id))
          .limit(1);
        if (!blk[0]) return fail("NOT_FOUND", "block not found");
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, blk[0].pageId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        let sortOrder = blk[0].sortOrder;
        if (p.sort_order !== undefined) {
          sortOrder = p.sort_order;
        } else if (p.after_block_id) {
          const after = await db
            .select()
            .from(schema.blocks)
            .where(eq(schema.blocks.id, p.after_block_id))
            .limit(1);
          if (after[0]) sortOrder = after[0].sortOrder + 0.5;
        }
        await db
          .update(schema.blocks)
          .set({
            parentBlockId: p.parent_block_id ?? blk[0].parentBlockId,
            sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(schema.blocks.id, p.block_id));
        const op = { op_type: "block.moved", payload: { block_id: p.block_id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "block.delete": {
        const p = BlockDeletePayload.parse(envelope.payload);
        const blk = await db
          .select()
          .from(schema.blocks)
          .where(eq(schema.blocks.id, p.block_id))
          .limit(1);
        if (!blk[0]) return fail("NOT_FOUND", "block not found");
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, blk[0].pageId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        const pageId = blk[0].pageId;
        await db.delete(schema.blocks).where(eq(schema.blocks.id, p.block_id));
        await refreshPageSearch(db, pageId);
        const op = { op_type: "block.deleted", payload: { block_id: p.block_id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "page.body_sync": {
        const p = PageBodySyncPayloadSchema.parse(envelope.payload);
        const pageRow = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, p.page_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!pageRow[0]) return fail("NOT_FOUND", "page not found");
        const existing = await db
          .select({ id: schema.blocks.id })
          .from(schema.blocks)
          .where(eq(schema.blocks.pageId, p.page_id));
        const existingIds = new Set(existing.map((r) => r.id));
        const payloadIds = new Set(
          p.blocks.map((b) => b.id).filter((x): x is string => typeof x === "string"),
        );
        for (const row of existing) {
          if (!payloadIds.has(row.id)) {
            await db.delete(schema.blocks).where(eq(schema.blocks.id, row.id));
          }
        }
        for (const b of p.blocks) {
          const props = (b.properties ?? {}) as Record<string, unknown>;
          const content = b.content as Record<string, unknown>;
          if (b.id && existingIds.has(b.id)) {
            await db
              .update(schema.blocks)
              .set({
                type: b.type,
                sortOrder: b.sort_order,
                properties: props,
                content,
                updatedAt: new Date(),
              })
              .where(eq(schema.blocks.id, b.id));
          } else {
            await db.insert(schema.blocks).values({
              id: b.id ?? randomUUID(),
              pageId: p.page_id,
              parentBlockId: null,
              type: b.type,
              properties: props,
              content,
              sortOrder: b.sort_order,
            });
          }
        }
        await refreshPageSearch(db, p.page_id);
        const op = { op_type: "page.body_synced", payload: { page_id: p.page_id } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "import.markdown": {
        const pageId = String(envelope.payload.page_id);
        const md = String(envelope.payload.markdown ?? "");
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, pageId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        const blocks = markdownToBlocks(md);
        const created = [];
        for (const b of blocks) {
          const sortOrder = await nextBlockSort(db, pageId, null);
          const [row] = await db
            .insert(schema.blocks)
            .values({
              pageId,
              type: b.type,
              content: b.content,
              sortOrder,
            })
            .returning();
          created.push(row);
        }
        await refreshPageSearch(db, pageId);
        const op = { op_type: "import.markdown", payload: { blocks: created } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "db.create": {
        const p = DatabaseCreatePayload.parse(envelope.payload);
        const space = await db
          .select()
          .from(schema.spaces)
          .where(and(eq(schema.spaces.id, p.space_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!space[0]) return fail("NOT_FOUND", "space not found");
        const schemaJson = {
          properties: [{ id: randomUUID(), name: "Name", type: "title" }],
        };
        const [d] = await db
          .insert(schema.databases)
          .values({
            spaceId: p.space_id,
            parentPageId: p.parent_page_id ?? null,
            title: p.title,
            schemaJson,
          })
          .returning();
        const queryJson: ViewQuery = { filters: [], sorts: [] };
        await db.insert(schema.databaseViews).values({
          databaseId: d.id,
          name: "Default",
          type: "table",
          queryJson,
        });
        const op = { op_type: "db.created", payload: { database: d } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "db.property.add": {
        const p = DbPropertyAddPayload.parse(envelope.payload);
        const d = await db
          .select()
          .from(schema.databases)
          .innerJoin(schema.spaces, eq(schema.databases.spaceId, schema.spaces.id))
          .where(and(eq(schema.databases.id, p.database_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!d[0]) return fail("NOT_FOUND", "database not found");
        const cur = d[0].databases.schemaJson as { properties: Array<Record<string, unknown>> };
        const prop: Record<string, unknown> = {
          id: randomUUID(),
          name: p.name,
          type: p.type,
        };
        if (p.options) prop["options"] = p.options;
        cur.properties.push(prop);
        await db
          .update(schema.databases)
          .set({ schemaJson: cur as Record<string, unknown> })
          .where(eq(schema.databases.id, p.database_id));
        const op = { op_type: "db.property.added", payload: { property: prop } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "db.row.create": {
        const p = DbRowCreatePayload.parse(envelope.payload);
        const d = await db
          .select()
          .from(schema.databases)
          .innerJoin(schema.spaces, eq(schema.databases.spaceId, schema.spaces.id))
          .where(and(eq(schema.databases.id, p.database_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!d[0]) return fail("NOT_FOUND", "database not found");
        const [row] = await db
          .insert(schema.databaseRows)
          .values({ databaseId: p.database_id, cells: p.cells })
          .returning();
        const op = { op_type: "db.row.created", payload: { row } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "db.row.update": {
        const p = DbRowUpdatePayload.parse(envelope.payload);
        const d = await db
          .select()
          .from(schema.databases)
          .innerJoin(schema.spaces, eq(schema.databases.spaceId, schema.spaces.id))
          .where(and(eq(schema.databases.id, p.database_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!d[0]) return fail("NOT_FOUND", "database not found");
        const row = await db
          .select()
          .from(schema.databaseRows)
          .where(
            and(
              eq(schema.databaseRows.id, p.row_id),
              eq(schema.databaseRows.databaseId, p.database_id),
            ),
          )
          .limit(1);
        if (!row[0]) return fail("NOT_FOUND", "row not found");
        const merged = {
          ...(row[0].cells as Record<string, unknown>),
          ...p.cells,
        };
        const [updated] = await db
          .update(schema.databaseRows)
          .set({ cells: merged, updatedAt: new Date() })
          .where(eq(schema.databaseRows.id, p.row_id))
          .returning();
        const op = { op_type: "db.row.updated", payload: { row: updated } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "db.view.create": {
        const p = DbViewCreatePayload.parse(envelope.payload);
        const d = await db
          .select()
          .from(schema.databases)
          .innerJoin(schema.spaces, eq(schema.databases.spaceId, schema.spaces.id))
          .where(and(eq(schema.databases.id, p.database_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!d[0]) return fail("NOT_FOUND", "database not found");
        const queryJson: ViewQuery = { filters: [], sorts: [] };
        const [view] = await db
          .insert(schema.databaseViews)
          .values({
            databaseId: p.database_id,
            name: p.name,
            type: p.type,
            queryJson,
          })
          .returning();
        const op = { op_type: "db.view.created", payload: { view } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "db.query": {
        const p = DbQueryPayload.parse(envelope.payload);
        const d = await db
          .select()
          .from(schema.databases)
          .innerJoin(schema.spaces, eq(schema.databases.spaceId, schema.spaces.id))
          .where(and(eq(schema.databases.id, p.database_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!d[0]) return fail("NOT_FOUND", "database not found");
        const view = await db
          .select()
          .from(schema.databaseViews)
          .where(
            and(
              eq(schema.databaseViews.id, p.view_id),
              eq(schema.databaseViews.databaseId, p.database_id),
            ),
          )
          .limit(1);
        if (!view[0]) return fail("NOT_FOUND", "view not found");
        const rows = await db
          .select()
          .from(schema.databaseRows)
          .where(eq(schema.databaseRows.databaseId, p.database_id));
        const q = view[0].queryJson as ViewQuery;
        let out = rows.map((r) => ({ id: r.id, cells: r.cells as Record<string, unknown> }));
        out = applyFilters(out, q.filters ?? []);
        out = applySorts(out, q.sorts ?? []);
        const op = { op_type: "db.queried", payload: { rows: out } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "comment.create": {
        const p = CommentCreatePayload.parse(envelope.payload);
        const page = await db
          .select()
          .from(schema.pages)
          .innerJoin(schema.spaces, eq(schema.pages.spaceId, schema.spaces.id))
          .where(and(eq(schema.pages.id, p.page_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!page[0]) return fail("NOT_FOUND", "page not found");
        const [c] = await db
          .insert(schema.comments)
          .values({
            pageId: p.page_id,
            blockId: p.block_id ?? null,
            authorId: envelope.actor_id,
            body: p.body,
          })
          .returning();
        const op = { op_type: "comment.created", payload: { comment: c } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "proposal.list": {
        const p = ProposalListPayload.parse(envelope.payload);
        const conds = [eq(schema.spaces.tenantId, tenantId)];
        if (p.space_id) conds.push(eq(schema.proposals.spaceId, p.space_id));
        if (p.status) conds.push(eq(schema.proposals.status, p.status));
        const rows = await db
          .select({ proposal: schema.proposals })
          .from(schema.proposals)
          .innerJoin(schema.spaces, eq(schema.proposals.spaceId, schema.spaces.id))
          .where(and(...conds))
          .orderBy(desc(schema.proposals.createdAt));
        const proposals = rows.map((r) => r.proposal);
        const op = { op_type: "proposal.listed", payload: { proposals } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "proposal.create": {
        const p = ProposalCreatePayload.parse(envelope.payload);
        const space = await db
          .select()
          .from(schema.spaces)
          .where(and(eq(schema.spaces.id, p.space_id), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!space[0]) return fail("NOT_FOUND", "space not found");
        if (envelope.actor_type === "agent") {
          const [pr] = await db
            .insert(schema.proposals)
            .values({
              spaceId: p.space_id,
              actorId: envelope.actor_id,
              status: "pending",
              rationale: p.rationale,
              payload: { commands: p.commands } as Record<string, unknown>,
            })
            .returning();
          const op = { op_type: "proposal.staged", payload: { proposal: pr } };
          await db.insert(schema.operations).values({
            ...baseOps,
            commandId,
            opType: op.op_type,
            payload: op.payload,
          });
          return {
            command_id: commandId,
            status: "staged",
            operations: [op],
            proposal_id: pr.id,
          };
        }
        return fail("INVALID", "proposal.create for non-agent use proposal.approve flow");
      }
      case "proposal.approve": {
        const proposalId = String(envelope.payload.proposal_id);
        const pr = await db
          .select()
          .from(schema.proposals)
          .innerJoin(schema.spaces, eq(schema.proposals.spaceId, schema.spaces.id))
          .where(and(eq(schema.proposals.id, proposalId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!pr[0]) return fail("NOT_FOUND", "proposal not found");
        if (pr[0].proposals.actorId === envelope.actor_id)
          return fail("FORBIDDEN", "cannot approve own proposal");
        await db
          .update(schema.proposals)
          .set({ status: "approved" })
          .where(eq(schema.proposals.id, proposalId));
        const op = { op_type: "proposal.approved", payload: { proposal_id: proposalId } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      case "proposal.reject": {
        const proposalId = String(envelope.payload.proposal_id);
        const pr = await db
          .select()
          .from(schema.proposals)
          .innerJoin(schema.spaces, eq(schema.proposals.spaceId, schema.spaces.id))
          .where(and(eq(schema.proposals.id, proposalId), eq(schema.spaces.tenantId, tenantId)))
          .limit(1);
        if (!pr[0]) return fail("NOT_FOUND", "proposal not found");
        await db
          .update(schema.proposals)
          .set({ status: "rejected" })
          .where(eq(schema.proposals.id, proposalId));
        const op = { op_type: "proposal.rejected", payload: { proposal_id: proposalId } };
        await db.insert(schema.operations).values({
          ...baseOps,
          commandId,
          opType: op.op_type,
          payload: op.payload,
        });
        return { command_id: commandId, status: "applied", operations: [op] };
      }
      default:
        return fail("UNKNOWN_COMMAND", envelope.type);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail("VALIDATION", msg);
  }
}
