# PagesAI — reference analysis (clean-room)

Answers the ten questions from the product prompt. This document synthesizes **public** product behavior and architecture literature only. No proprietary internals, no source copying.

## 1. What makes Notion feel like Notion at the interaction level?

- **Low friction creation**: New page/block in one gesture; empty states invite typing immediately.
- **Block-first mental model**: Everything is a block; consistent hover, drag handle, and slash insertion.
- **Keyboard fluency**: Slash menu, command palette, arrow navigation inside/outside nested blocks, Escape to dismiss.
- **Hierarchy without ceremony**: Indent/outdent, collapse toggles, breadcrumbs that reflect tree position.
- **Dense but calm UI**: Neutral surfaces, subtle dividers, minimal chrome; focus stays on content.
- **Cross-linking**: `@` mentions and `[[` page links with discoverable backlinks.
- **Databases as views**: Same underlying rows rendered as table/board/calendar/list with shared filters.

## 2. Block trees, nested selection, drag/drop, slash insertion, keyboard navigation

- **Block tree**: Each block has optional `parent_block_id` and ordered children; the editor projects this tree into the DOM. Structural commands (split, merge, indent) map to tree operations + rich-text spans.
- **Nested selection**: Selection is a range in the **flattened** block list for structural ops, or intra-block for text. Parent block selection selects subtree for cut/delete policies (v1: explicit “delete subtree” vs text-only delete).
- **Drag/drop**: Drag handle targets a block row; drop zones are “before sibling” / “as child” with explicit hit targets; server applies `block.move` with deterministic ordering (sort keys or renumbered indices with conflict rules).
- **Slash**: `/` opens filtered command list bound to registry; choice inserts or transforms block; must work with IME and composition (defer menu until composition end).
- **Keyboard**: Arrow up/down cross block boundaries; Tab/Shift+Tab indent/outdent where block type allows; Enter split or create sibling per block type rules.

## 3. Pages, blocks, comments, mentions, backlinks, files, databases

- **Page**: Row in `pages` with `space_id`, optional `parent_page_id`, title, archive state. URL-addressable.
- **Block**: Belongs to exactly one `page_id`; tree via `parent_block_id`; typed `properties` + `content` (rich text model).
- **Mention**: Inline span in `content` with `ref_type` (`page` | `person` | …) and `ref_id`.
- **Backlink**: Derived index from mention spans + explicit `link` blocks pointing at `page_id`; rebuilt on content change (deterministic projector).
- **Comment**: Thread anchored to `page_id` + optional `block_id`; stored outside Yjs CRDT in v1 (command log + row store) while body text may sync via separate small Yjs doc optional later.
- **File embed**: Block type `file_embed` with `AssetRef`; open path uses **host capabilities** in hofOS; standalone uses local/mock adapter.
- **Database**: Page (or block) with `database_id`; properties schema; rows in `database_rows`; views encode filter/sort/group JSON.

## 4. CRDT-managed vs command/event-log-managed

| Concern                                   | CRDT (Yjs)                                                                          | Command / operation log                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Live concurrent text in a page            | Yes — Lexical binding or parallel Y.Text per block (v1: single Y.Doc per page room) | No duplicate source of truth for live text                                         |
| Structural block ops during collaboration | Merge via CRDT map/list OR operational transform in Yjs structures                  | Log **authoritative structural commands** for audit (`block.insert`, `block.move`) |
| Page rename, archive, permissions         | No                                                                                  | Yes — always commands                                                              |
| Database row/cell edits                   | Optional Yjs for “editing session”; v1 can be command-only for cells                | Yes for audit and agent review                                                     |
| Agent proposals                           | N/A                                                                                 | Yes — staged commands                                                              |
| Backlinks index                           | N/A                                                                                 | Derived from logged content snapshots / periodic projection                        |

**v1 hybrid**: Yjs doc for **page body** collaborative state; server persists **snapshots + operation log** for replay/audit. On save/reconcile, server accepts **commands** that commit structural changes and merge Yjs updates into stored blocks (periodic snapshot + version vector).

## 5. AppFlowy / AppFlowy-Collab (conceptual)

- **Folder/page hierarchy** mirrors workspace tree with typed containers.
- **Collab** emphasizes CRDT documents and row/column models for databases; sync via updates over network.
- **Takeaway**: Separate **document CRDT** from **database row storage**; use explicit sync steps for relational data.

## 6. AFFiNE / BlockSuite (conceptual)

- **Block store** as graph with typed blocks and multiple renderers (surface to different UIs).
- **Collaboration** via CRDT on block graph + awareness.
- **Takeaway**: Keep a **stable block schema** and a **single editor binding** (Lexical) for hofOS; avoid multi-renderer complexity in v1.

## 7. What references get wrong (PagesAI should avoid)

- **Dual sources of truth** between CRDT and RDBMS without reconcile rules → define snapshot + log policy upfront.
- **AGPL / source-available stacks** pulled in as deps → forbidden by license policy.
- **Over-broad block types** before editor support → start with Notion’s 80% set, version block schema.
- **Palette/slash as hardcoded UI** → must be command registry for CLI/agents.
- **Memory-only routing** for durable UX → URLs must restore state.

## 8. Safe runtime dependencies vs study-only

**Safe (permissive, planned)**: `typescript`, `fastify`, `@fastify/websocket`, `drizzle-orm`, `postgres`, `ioredis`, `zod`, `vitest`, `playwright`, `lexical`, `@lexical/*`, `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `zustand`, `yjs`, `y-websocket`, `dompurify`, `i18next`, `cmdk`, `vite`, `tailwindcss`, `minio` client (standalone), `bcryptjs` or `argon2`, `jose` (JWT).

**Study-only / verify before use**: Full AppFlowy, AFFiNE, BlockSuite packages — default **not** runtime.

## 9. What agents need beyond humans

- **Stable machine interface**: JSON CLI + MCP with schemas; idempotent commands.
- **Read/search** without UI; **propose** mutations with rationale; never self-approve.
- **Attribution**: `actor_id`, `actor_type=agent`, token scopes, audit trail.
- **Rate limits / budgets** server-enforced.
- **Bulk import/export** and deterministic transforms for evaluation.

## 10. hofOS fit: `/api/pages`, sidecar JWT, host URLs, Office-AI, native export

- Browser holds **`hof_token` only**; data-app proxies **`/api/pages/*`** and mints **short-lived sidecar JWT** with `HOF_SUBAPP_JWT_SECRET`.
- **WebSocket** connects to same-origin **`/api/pages/ws`** (or subpath) with token query param.
- **URLs**: `/pages/...` deep links; module provides product routes only; shell owns global nav/auth.
- **Office-AI**: File blocks call host hooks (`openOfficeAsset`, etc.); **no** bundled `@officeai/react-editors` in export — consume from host.
- **Export**: `pnpm run export:hofos-ui` emits `ui/original` sources + manifest; bridge files preserved in hofOS module (mirrors mail-ai / collabai).

---

**Conclusion**: PagesAI v1 is a **command-sourced** product with **Yjs-assisted** live editing, **Lexical** editor, **Postgres** truth for structure and audit, **Redis** for pub/sub, and a **hofOS-identical** runtime config seam.
