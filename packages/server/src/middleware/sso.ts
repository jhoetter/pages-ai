import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyHofJwt } from "../auth/hof-jwt.js";

const HANDOFF_QUERY_PARAM = "__hof_jwt";
const HANDOFF_CODE_QUERY_PARAM = "__hof_handoff";
const SESSION_COOKIE = "hof_subapp_session";
const EXPECTED_AUDIENCE = "pagesai";

interface HandoffExchangeResponse {
  readonly token?: string;
  readonly expires_at?: string;
  readonly audience?: string;
}

function maxAgeFromExpiry(exp: number | string | undefined): number {
  if (typeof exp === "number") {
    return Math.max(1, Math.floor(exp - Date.now() / 1000));
  }
  if (typeof exp === "string" && exp.length > 0) {
    return Math.max(1, Math.floor((Date.parse(exp) - Date.now()) / 1000));
  }
  return 120;
}

function cookieHeader(token: string, maxAgeSeconds: number): string {
  const secure = process.env["HOF_ENV"] === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function hofOsBaseUrl(): string {
  return (
    process.env["HOF_DATA_APP_PUBLIC_URL"] ||
    process.env["HOF_OS_PUBLIC_URL"] ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function exchangeHandoffCode(code: string): Promise<{ token: string; maxAgeSeconds: number } | null> {
  const res = await fetch(`${hofOsBaseUrl()}/api/subapp-handoff/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audience: EXPECTED_AUDIENCE, code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as HandoffExchangeResponse;
  if (data.audience !== EXPECTED_AUDIENCE || typeof data.token !== "string") return null;
  const claims = verifyHofJwt(data.token, EXPECTED_AUDIENCE);
  if (!claims) return null;
  return {
    token: data.token,
    maxAgeSeconds: Math.min(maxAgeFromExpiry(data.expires_at), maxAgeFromExpiry(claims.exp)),
  };
}

async function handleHandoff(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = new URL(request.url, "http://pagesai.local");
  const code = url.searchParams.get(HANDOFF_CODE_QUERY_PARAM);
  const token = url.searchParams.get(HANDOFF_QUERY_PARAM);
  if (!code && !token) return;
  url.searchParams.delete(HANDOFF_CODE_QUERY_PARAM);
  url.searchParams.delete(HANDOFF_QUERY_PARAM);
  const cleanPath = `${url.pathname || "/"}${url.search}${url.hash}`;
  if (code) {
    const exchanged = await exchangeHandoffCode(code);
    if (exchanged) {
      reply.header("set-cookie", cookieHeader(exchanged.token, exchanged.maxAgeSeconds));
    }
    reply.redirect(cleanPath || "/");
    return;
  }
  if (!token) return;
  const claims = verifyHofJwt(token, EXPECTED_AUDIENCE);
  if (claims) {
    reply.header("set-cookie", cookieHeader(token, maxAgeFromExpiry(claims.exp)));
  }
  reply.redirect(cleanPath || "/");
}

export function registerSsoMiddleware(app: FastifyInstance): void {
  app.addHook("onRequest", handleHandoff);
}

export const __testInternals = {
  verifyHandoffJwt: verifyHofJwt,
  cookieHeader,
  exchangeHandoffCode,
  maxAgeFromExpiry,
};
