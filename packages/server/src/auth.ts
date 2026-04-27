import { jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";

export type AuthContext = {
  tenantId: string;
  actorId: string;
  scopes: string[];
};

const encoder = new TextEncoder();

export async function resolveAuth(
  req: FastifyRequest,
  opts: { devToken?: string; jwtSecret?: string },
): Promise<AuthContext | null> {
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (opts.jwtSecret && bearer) {
    try {
      const { payload } = await jwtVerify(bearer, encoder.encode(opts.jwtSecret), {
        algorithms: ["HS256"],
      });
      const tid = String(payload["tid"] ?? payload["tenant_id"] ?? "default");
      const sub = String(payload["sub"] ?? "unknown");
      const scopeStr = String(payload["scopes"] ?? payload["scope"] ?? "read,write");
      const scopes = scopeStr.split(/[,\s]+/).filter(Boolean);
      return { tenantId: tid, actorId: sub, scopes };
    } catch {
      return null;
    }
  }

  if (opts.devToken) {
    if (bearer === opts.devToken) {
      return { tenantId: "dev-tenant", actorId: "dev-user", scopes: ["read", "write", "admin"] };
    }
    return null;
  }

  /** Dev permissive when no auth configured */
  return { tenantId: "dev-tenant", actorId: "dev-user", scopes: ["read", "write", "admin"] };
}
