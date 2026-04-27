import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(sql: postgres.Sql): Promise<void> {
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const migrationSql = readFileSync(join(dir, f), "utf8");
    await sql.unsafe(migrationSql);
  }
}
