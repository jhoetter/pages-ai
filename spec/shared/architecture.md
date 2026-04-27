# Architecture

## Monorepo packages

| Package              | Responsibility                                                                 |
| -------------------- | ------------------------------------------------------------------------------ |
| `@pagesai/core`      | IDs, Zod schemas, command envelopes, error codes, slash/palette registry types |
| `@pagesai/commands`  | Command router, validation, handler dispatch, result mapping                   |
| `@pagesai/storage`   | Drizzle schema, migrations, repositories                                       |
| `@pagesai/documents` | Rich text model, block transforms, markdown import/export, backlinks projector |
| `@pagesai/databases` | Property definitions, view query engine, sandboxed formulas                    |
| `@pagesai/sync`      | Yjs room keys, WS message envelopes, presence DTOs                             |
| `@pagesai/files`     | `AssetRef`, host capability TypeScript interface                               |
| `@pagesai/agent`     | MCP tool mapping, proposal helpers                                             |
| `@pagesai/cli`       | `pages-ai` bin                                                                 |
| `@pagesai/web`       | Vite React harness                                                             |
| `@pagesai/server`    | Fastify HTTP + WS, auth, rate limits                                           |
| `@pagesai/hofos`     | Export helpers, contract metadata                                              |

## Mutation path

Only **`Command`** records mutate durable state (except Yjs ephemeral merge which **commits** via `SyncCommit` command or autosave endpoint — v1: **HTTP command** for structure; **Yjs persistence** endpoint flushes doc to `blocks` snapshot).

**v1 simplification**: Client sends block edits via commands `block.update` / `block.append` from CLI; web editor batches Lexical changes into `block.update` debounced. Optional later: binary Yjs persist.

_Clarification for implementation_: To deliver working collab in one pass, the server implements **Yjs `Doc` per `pageId`** with persistence hook that serializes to block rows on interval and on disconnect; **command log** records `yjs.snapshot` operations for audit.

## Technology choices

- **Runtime**: Node 20+
- **HTTP**: Fastify 5
- **DB**: PostgreSQL 16
- **ORM**: Drizzle + `drizzle-kit`
- **Cache/pubsub**: Redis 7
- **Validation**: Zod 3
- **Editor**: Lexical 0.43 (hofOS-aligned)
- **Tests**: Vitest; Playwright e2e

## Standalone vs hofOS

| Aspect   | Standalone                       | hofOS                              |
| -------- | -------------------------------- | ---------------------------------- |
| API base | `/api` or `VITE_PAGESAI_API_URL` | `/api/pages`                       |
| Auth     | Dev token or API key header      | `hof_token` → proxy mints JWT      |
| Files    | MinIO + local upload             | Host capabilities only             |
| Office   | Download / optional viewer stub  | `@officeai/react-editors` via host |
