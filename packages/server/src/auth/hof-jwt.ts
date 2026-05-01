import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_FALLBACK_SECRET = "dev-only-not-for-prod-9c2f";
export const DEFAULT_AUDIENCE = "pagesai";

export interface HofJwtClaims {
  readonly aud?: string;
  readonly sub?: string;
  readonly tid?: string;
  readonly tenant_id?: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly display_name?: string;
  readonly scopes?: string[] | string;
  readonly scope?: string;
  readonly exp?: number;
}

function b64urlDecodeToBuffer(input: string): Buffer {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function secrets(): string[] {
  const current = (process.env["HOF_SUBAPP_JWT_SECRET"] ?? "").trim();
  const previous = (process.env["HOF_SUBAPP_JWT_SECRET_PREVIOUS"] ?? "").trim();
  const values = [current, previous].filter(Boolean);
  return values.length > 0 ? values : [DEV_FALLBACK_SECRET];
}

export function verifyHofJwt(token: string, audience = DEFAULT_AUDIENCE): HofJwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const h = parts[0]!;
  const p = parts[1]!;
  const s = parts[2]!;
  const provided = b64urlDecodeToBuffer(s);
  const matched = secrets().some((secret) => {
    const expected = createHmac("sha256", Buffer.from(secret, "utf-8"))
      .update(`${h}.${p}`)
      .digest();
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  });
  if (!matched) return null;

  let claims: HofJwtClaims;
  try {
    claims = JSON.parse(b64urlDecodeToBuffer(p).toString("utf-8")) as HofJwtClaims;
  } catch {
    return null;
  }
  if (typeof claims.exp === "number" && claims.exp < Date.now() / 1000) return null;
  if (claims.aud !== audience) return null;
  if (!claims.sub || !(claims.tid ?? claims.tenant_id)) return null;
  return claims;
}
