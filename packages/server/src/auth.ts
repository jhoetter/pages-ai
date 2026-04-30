import type { FastifyRequest } from "fastify";
import { verifyHofJwt } from "./auth/hof-jwt.js";

export type AuthContext = {
  tenantId: string;
  actorId: string;
  scopes: string[];
};

function extractSessionCookie(req: FastifyRequest): string | null {
  const raw = req.headers.cookie;
  if (typeof raw !== "string") return null;
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === "hof_subapp_session") {
      return decodeURIComponent(value.join("="));
    }
  }
  return null;
}

export async function resolveAuth(
  req: FastifyRequest,
  opts: { devToken?: string; jwtSecret?: string },
): Promise<AuthContext | null> {
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const token = bearer ?? extractSessionCookie(req);

  if (opts.jwtSecret) {
    if (!token) return null;
    const payload = verifyHofJwt(token, "pagesai");
    if (!payload) return null;
    const tid = String(payload.tid ?? payload.tenant_id ?? "default");
    const sub = String(payload.sub ?? "unknown");
    const rawScopes = payload.scopes ?? payload.scope ?? "read,write";
    const scopes = Array.isArray(rawScopes)
      ? rawScopes
      : String(rawScopes).split(/[,\s]+/).filter(Boolean);
    return { tenantId: tid, actorId: sub, scopes };
  }

  if (opts.devToken) {
    if (token === opts.devToken) {
      return { tenantId: "dev-tenant", actorId: "dev-user", scopes: ["read", "write", "admin"] };
    }
    return null;
  }

  /** Dev permissive when no auth configured */
  return { tenantId: "dev-tenant", actorId: "dev-user", scopes: ["read", "write", "admin"] };
}
