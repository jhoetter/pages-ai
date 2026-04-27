# Build log

## 2026-04-26

- Chose **Fastify 5** + **Drizzle** + **postgres.js** for the sidecar.
- Chose **Lexical 0.43** to align with hofOS `sister-ui-contract` host singletons.
- **Yjs** room map is in-memory on the server for v1; Redis pub/sub can be wired per `spec/shared/sync-model.md`. **Deferred:** multi-instance Yjs via `REDIS_URL` / `ioredis` remains single-node until needed.
- Added **`pagesai`** product entry to `hof-os/infra/sister-ui-contract.json` so `hofos:check` can resolve export destinations.
- Standalone dev seeds a `dev-tenant` space automatically.
- Full-text search uses `to_tsvector` / `plainto_tsquery` on title + `search_document` (no GIN index in first migration for simplicity).
- **Makefile** `make dev` is the canonical local entry (Docker infra + `pnpm dev`); ports **3399** (API) and **3400** (web).
- **Editor persistence (v1):** Lexical plain text debounced to `block.update` on the first page block when present, otherwise `block.append` for the first save; slash commands append typed blocks via `block.append`.
- **Playwright / Vite:** Dev server binds `127.0.0.1:3400` so `baseURL` matches (default `localhost` can be IPv6-only on some macOS setups). E2E `webServer` runs `kill-ports` → `docker compose up` → `wait-tcp 5433` → `pnpm dev` so Postgres is ready and stale listeners on 3399/3400 are cleared.

## Licenses

Runtime stack: MIT/Apache (Fastify, Drizzle, Lexical, React, Yjs, Zod, Playwright, etc.). See each package `package.json`.
