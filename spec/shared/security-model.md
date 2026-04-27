# Security

## Standalone dev

- `PAGESAI_DEV_TOKEN` optional; if set, `Authorization: Bearer <token>` required.
- If unset, server trusts local requests (documented dev-only).

## hofOS

- Require `Authorization: Bearer <sidecar_jwt>`.
- Verify HS256 with `HOF_SUBAPP_JWT_SECRET`.
- Claims: `sub`, `tid`, `scopes`, `exp` (≤15m).

## Tenant isolation

- Every row includes `space_id` / `tenant_id` from JWT `tid`.
- Queries always filter by tenant.

## CSRF

- Browser uses SameSite cookies only in future; v1 API is Bearer-only.

## Rate limits

- `@fastify/rate-limit` per IP + per actor for mutations.

## Import sanitization

- Markdown → strip raw HTML; allowlist Lexical nodes.
- `dompurify` on any HTML paste path.

## Attachments

- MIME allowlist; size cap 25MB default.
- Virus scan deferred.

## Audit

- `operations` append-only; no deletes.

## Public links

- Deferred v1.
