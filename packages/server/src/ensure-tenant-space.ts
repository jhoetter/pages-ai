import { eq } from "drizzle-orm";
import { type Db, schema } from "@pagesai/storage";

/**
 * Ensure exactly one space row exists for this tenant (hof-os `tid`), matching
 * collaboration-ai's JIT workspace persistence for JWT identities.
 */
export async function ensureImplicitSpaceForTenant(db: Db, tenantId: string): Promise<void> {
  const existing = await db
    .select({ id: schema.spaces.id })
    .from(schema.spaces)
    .where(eq(schema.spaces.tenantId, tenantId))
    .limit(1);
  if (existing[0]) return;

  try {
    await db.insert(schema.spaces).values({ tenantId, name: tenantId });
  } catch (e) {
    const code =
      e !== null && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "23505") return;
    throw e;
  }
}
