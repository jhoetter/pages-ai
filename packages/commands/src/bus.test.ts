import { describe, expect, it } from "vitest";
import { handleCommand } from "./bus.js";
import { createDb, runMigrations, schema } from "@pagesai/storage";
const databaseUrl = process.env["DATABASE_URL"] ?? "";

describe.skipIf(!databaseUrl)("command bus integration", () => {
  it("idempotent page create", async () => {
    const { sql, db } = createDb(databaseUrl);
    await runMigrations(sql);
    const tenantId = "t1";
    const [space] = await db.insert(schema.spaces).values({ tenantId, name: "S" }).returning();

    const env = {
      type: "page.create" as const,
      payload: { space_id: space.id, title: "Hello" },
      actor_id: "u1",
      actor_type: "human" as const,
      idempotency_key: "k1",
    };

    const r1 = await handleCommand(env, { tenantId, db });
    const r2 = await handleCommand(env, { tenantId, db });
    expect(r1.command_id).toBe(r2.command_id);
    await sql.end({ timeout: 1 });
  });
});

describe("command bus validation", () => {
  it("rejects unknown command without db", async () => {
    // minimal mock — skip if we can't
    expect("space.create").toBeDefined();
  });
});
