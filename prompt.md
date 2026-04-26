# Build PagesAI: A Clean-Room Notion-Alike for hofOS

## Mission

You are a senior software architect and engineer. Build `pages-ai`, a browser-accessible, CLI-first, AI-native workspace for pages, docs, wikis, lightweight databases, embedded files, and team knowledge. The product should feel extremely close to Notion in workflow quality: fast page creation, nested blocks, slash commands, drag handles, backlinks, database views, embeds, templates, search, comments, command palette, and a calm design system.

This is a standalone sister product, not a hofOS module first. It must run independently during development and production, with its own backend, database, CLI, and standalone web harness. Later it will be integrated into hofOS exactly like `mail-ai` and `collaboration-ai`: the shipped hofOS UI will live as a native `hof-components` module, while this repo remains the sidecar backend and standalone dev harness source.

Do not start coding until the analysis and specifications are complete. Work in this exact sequence:

1. Analyze clean-room references and hofOS sister-product integration.
2. Specify shared architecture, data model, command bus, sync model, design system, i18n, CLI, and hofOS contract.
3. Build the headless core and CLI before the web UI.
4. Build the collaboration/sync layer.
5. Build the standalone web harness.
6. Build the hofOS-mode export/harness contract.
7. Validate everything with headless tests, browser smoke tests, and integration tests.

Ask no clarifying questions. Begin with analysis and specs.

---

## Legal Constraint: Clean-Room Engineering

Analyze reference products and repositories to extract concepts, patterns, UX behavior, and architecture decisions. Then write a fresh implementation from specs you produce yourself.

Allowed:

- Study public documentation, demos, product behavior, specs, and architecture notes.
- Extract high-level concepts: block trees, slash-command UX, database view models, sync strategies, page hierarchy, command palettes, editor transaction flows.
- Use permissively licensed runtime dependencies when justified.
- Implement independently from first principles.

Not allowed:

- Copy Notion UI code, visual assets, text, CSS, proprietary behavior tables, or undocumented private APIs.
- Copy source code from AGPL or source-available projects.
- Lightly rename identifiers from reference projects.
- Use AGPL/source-available components as runtime dependencies.
- Import AppFlowy, AFFiNE, Anytype, Outline, Logseq, or similar products as runtime packages unless every dependency and file used is license-approved.

Reference licensing posture:

- Notion: proprietary. Study product behavior only.
- AppFlowy: important open-source Notion alternative. Study architecture and UX concepts only unless a specific package is verified as acceptable.
- AppFlowy-Collab: study CRDT/document/database concepts and diagrams only.
- AFFiNE / BlockSuite: study block editor and collaborative document concepts; verify licenses before any runtime use. Default to study-only.
- Outline, Anytype, Logseq, Obsidian-like products: study concepts only unless licensing is explicitly verified.

Runtime dependencies should default to MIT, Apache 2.0, BSD, or similarly permissive licenses. If in doubt, do not use the dependency.

---

## hofOS Sister-Product Contract From Day One

This product must be designed to integrate later into hofOS without a retrofit. Follow the current hofOS sister-product architecture used by `mail-ai` and `collaboration-ai`.

### Target Integration Shape

```text
Browser with hof_token
→ hofOS data-app shell
→ native hof-components module for PagesAI
→ same-origin /api/pages/* proxy
→ pages-ai sidecar backend with minted sidecar JWT
→ pages-ai database / queues / object metadata
```

Non-negotiable integration rules:

- The browser only carries `hof_token`.
- hofOS verifies `hof_token`, strips browser-supplied trust headers, mints a short-lived sidecar JWT signed with `HOF_SUBAPP_JWT_SECRET`, and forwards to the sidecar.
- The PagesAI sidecar must never receive `hof_token` directly.
- Browser API calls in hofOS mode must go through `/api/pages/*`.
- Browser WebSockets in hofOS mode must go through `/api/pages/ws/*` or an equivalent same-origin proxy path and pass `hof_token` as a query parameter because browsers cannot set custom WebSocket headers.
- Product URL state must be reconstructable from the host URL after refresh.
- The hofOS shell owns global sidebar, page header, breadcrumbs, auth, and top-level command surfaces.
- The PagesAI module may provide product-internal navigation, but not duplicate global hofOS chrome.
- The standalone web app is a dev harness and product surface; it is not the shipped hofOS UI source of truth after integration.

Future hofOS paths should be planned now:

```text
/pages
/pages/p/<pageId>
/pages/p/<pageId>?block=<blockId>
/pages/space/<spaceId>
/pages/db/<databaseId>
/pages/db/<databaseId>?view=<viewId>
/pages/templates
/pages/settings
```

Every durable state must have a URL:

- selected page
- selected block
- open database view
- open side panel
- active search result
- comments drawer
- template picker

Do not rely on `MemoryRouter` or in-memory stores as the final source of truth for state users expect to survive refresh.

### Native hofOS Module Shape

Plan for a future module:

```text
packages/hof-components/modules/pagesai/
├── module.json
├── README.md
└── ui/
    ├── pages/
    │   └── pages.tsx
    ├── lib/
    │   ├── pagesApi.ts
    │   ├── pagesWs.ts
    │   ├── pagesPersistentGroup.tsx
    │   ├── pagesHostChrome.ts
    │   └── pagesHostCapabilities.ts
    ├── original/
    │   └── copied runtime UI from this repo
    └── vendor/
        └── copied runtime-only local packages if needed
```

The future sibling export must preserve hofOS bridge files and export only runtime UI/source:

```sh
pnpm run hofos:check
pnpm run hofos:harness
pnpm run export:hofos-ui
```

The future hofOS overlay should match existing products:

```sh
HOF_SISTER_UI_OVERLAY=1 \
PAGESAI_UI_SOURCE_PATH=$HOME/repos/pages-ai \
make dev
```

### Assets, S3, and Office-AI Boundary

hofOS owns the platform file primitives:

- tenant S3 prefix validation and policy
- `/assets`
- `/edit-asset`
- asset versions and restore semantics
- shared Office-AI editor runtime
- same-origin attachment byte fetching
- host capabilities such as `openAsset`, `openOfficeAsset`, `createAssetFromBytes`, and attachment preview

PagesAI must consume these through a typed host capability boundary. It must not ship its own Office-AI bundle inside the hofOS module.

Embedded files should use Office-AI wherever feasible:

- DOCX, XLSX, PPTX, and PDF blocks should open through the shared `@officeai/react-editors` mount in hofOS mode.
- Standalone mode may provide a mock or local implementation of the same host capabilities.
- Unsupported file types should still be downloadable or previewable where safe.
- File bytes must be fetched same-origin and authenticated.
- Embedded file blocks should support S3 object keys, version metadata, display names, MIME type, size, and source product.

The PagesAI sidecar can own page/document metadata and product-specific embed records. It must not take over hofOS tenant S3 policy or the shared Office-AI runtime.

### Shared Runtime Singletons

Future hofOS UI must share the data-app Vite graph singletons:

- `react`
- `react-dom`
- `react-router`
- `@tanstack/react-query`
- `zustand`
- `yjs`
- `y-websocket`
- `@officeai/react-editors`
- editor dependencies such as `lexical` or `prosemirror-*`
- `zod`
- `dompurify`
- `pdfjs-dist`

Avoid dependency choices that will make the hofOS native module hard to stage. Prefer dependencies already compatible with hofOS where feasible.

---

## Product Definition

PagesAI is a Notion-alike workspace with AI-native foundations:

- Pages are nested documents made of typed blocks.
- Blocks can be text, headings, lists, todos, toggles, quotes, callouts, code, equations, dividers, media, file embeds, synced blocks, mentions, links, tables, database views, and custom AI blocks.
- Databases are first-class documents with rows, properties, views, filters, sorts, groups, formulas, relations, rollups, and templates.
- Users can type `/` to insert blocks and actions.
- Users can press `Cmd+K` / `Ctrl+K` to navigate, search, create, insert, and invoke actions.
- Everything important is exposed through a headless CLI first.
- AI agents use the same command bus as humans, with staged proposals where policy requires review.
- The web UI is a rendering surface over the same API and command model.

The initial target is not every Notion feature. The target is the 80% that makes the product feel real:

- page tree
- block editor
- slash menu
- command palette
- page search
- database table/board/calendar/list views
- file embeds using host capabilities
- comments
- mentions
- templates
- sharing/permissions
- import/export
- real-time collaboration
- CLI-first operations
- i18n-ready UI
- hofOS integration readiness

---

## Design System Requirements

Design must be feasible inside hofOS and standalone mode.

Use a calm, Notion-like design language:

- neutral surfaces
- strong whitespace
- subtle dividers
- no heavy shadows
- compact typography
- high information density without clutter
- keyboard-first interactions
- light/dark mode

Do not hardcode one-off colors or pixel-heavy layouts. Create design tokens from the start:

- `background`
- `foreground`
- `surface`
- `hover`
- `divider`
- `secondary`
- `tertiary`
- `accent`
- `warning`
- `danger`
- `success`

In hofOS mode, map these to hofOS semantic Tailwind/CSS variable tokens. In standalone mode, provide a compatible token implementation.

Required design-system specs:

- spacing scale
- typography scale
- panel and sidebar layout
- editor block spacing
- hover/selection states
- drag handle behavior
- slash menu style
- command palette style
- database view controls
- comments drawer
- file embed cards
- empty states
- loading states
- error states
- accessibility rules
- keyboard shortcut display

---

## Internationalization Requirements

i18n must be designed from the start.

Default languages:

- German (`de`) as the primary product language for hofOS customers.
- English (`en`) as the fallback/dev language.

Rules:

- No hardcoded user-facing strings in components.
- Translation keys must be stable and grouped by product area.
- CLI output must support `--locale`, defaulting from env or config.
- Dates, numbers, file sizes, relative time, and keyboard shortcut labels must be locale-aware.
- Search should support German and English content at minimum.
- Specs must define how block content language is detected or stored.
- Empty states and errors must have translatable structured codes.

---

## CLI-First Requirement

The CLI is not an afterthought. It is the first complete user of the product API and must work before the full web UI.

CLI name:

```sh
pages-ai
```

Core commands:

```sh
# Auth
pages-ai auth login
pages-ai auth whoami
pages-ai auth logout
pages-ai auth token create --name "docs-bot" --scopes read,write,propose

# Spaces and pages
pages-ai space list --format json
pages-ai page create --title "Projektplan" --parent <pageId>
pages-ai page show <pageId> --format markdown
pages-ai page list --parent <pageId> --format json
pages-ai page move <pageId> --parent <targetPageId> --position after:<siblingId>
pages-ai page archive <pageId>
pages-ai page restore <pageId>

# Blocks
pages-ai block list --page <pageId> --format json
pages-ai block append --page <pageId> --type paragraph --text "..."
pages-ai block insert --after <blockId> --type todo --text "Follow up"
pages-ai block update <blockId> --text "Updated"
pages-ai block move <blockId> --after <targetBlockId>
pages-ai block delete <blockId>

# Databases
pages-ai db create --title "Roadmap" --parent <pageId>
pages-ai db property add <dbId> --name Status --type select --options "Todo,Doing,Done"
pages-ai db row create <dbId> --json '{"Name":"MVP","Status":"Todo"}'
pages-ai db view create <dbId> --type table --name "All"
pages-ai db query <dbId> --view <viewId> --format json

# Files and embeds
pages-ai file embed --page <pageId> --s3-key <objectKey> --title "Spec.docx"
pages-ai file open <embedId>
pages-ai file versions <embedId> --format json

# Search and navigation
pages-ai search "retainer model" --format json
pages-ai backlinks <pageId> --format json

# Agent proposals
pages-ai propose page-update --page <pageId> --file ./draft.md --rationale "Generated first draft"
pages-ai proposals list --format json
pages-ai proposals approve <proposalId>
pages-ai proposals reject <proposalId> --reason "Wrong scope"

# Sync / export / import
pages-ai export page <pageId> --format markdown
pages-ai import markdown ./docs --parent <pageId>
pages-ai sync status

# MCP
pages-ai mcp serve
pages-ai mcp manifest
```

JSON output is the default. Human output uses `--format table` or `--format markdown`. Errors go to stderr as structured JSON when JSON output is active.

Exit codes:

- `0` success
- `1` user error
- `2` auth error
- `3` network error
- `4` conflict
- `5` rate-limited
- `6` validation failed

---

## Architecture Principles

1. Headless-first. Core logic runs without DOM, browser APIs, or React.
2. Commands are the only mutation path. Human UI, CLI, agents, imports, and system jobs all use commands.
3. Separate intent from effect. Commands validate and authorize; accepted commands produce document operations/events.
4. Collaboration is explicit. Pick and specify the sync model before implementation.
5. Server-readable by design for AI-native workflows. E2EE is deferred.
6. AI agents are first-class actors with scoped capabilities, attribution, budgets, and audit trails.
7. File storage is capability-based. PagesAI references files and embeds them; hofOS owns tenant S3 primitives in hofOS mode.
8. URLs are durable product state.
9. i18n and Cmd+K are core architecture, not polish.
10. Clean-room implementation beats clever dependency shortcuts.

---

## Recommended Technical Direction

Decide final choices in the spec, but start with these defaults:

- Language: TypeScript for server, shared packages, CLI, and web.
- Runtime: Node.js.
- Backend: Fastify or Hono.
- Database: PostgreSQL.
- Query builder: Kysely or Drizzle.
- Cache/pubsub: Redis.
- Object storage: S3-compatible APIs for standalone mode; host capabilities in hofOS mode.
- Validation: Zod.
- Editor: evaluate Lexical vs ProseMirror/Tiptap in spec. Favor hofOS compatibility and long-term control over short-term demo speed.
- Collaboration: evaluate Yjs for live document editing, plus a durable server-side operation/event log for audit, sync repair, and agent review.
- Search: PostgreSQL full-text for v1, with a path to semantic indexing.
- Testing: Vitest for pure logic, Playwright for browser smoke tests, integration tests against Dockerized Postgres/Redis/MinIO.

Important architectural question to resolve in spec:

- A Notion-like block editor benefits from CRDT collaboration.
- hofOS and AI audit benefit from command/event logs.
- The likely v1 shape is a hybrid: commands produce audited operations, operations apply to CRDT/doc snapshots or deterministic block projections, and snapshots can be rebuilt/verified from the operation log.

Do not implement until this is specified precisely.

---

## Reference Analysis Tasks

Before writing the spec, produce `/spec/research/analysis.md` answering:

1. What makes Notion feel like Notion at the interaction level?
2. How do block trees, nested selection, drag/drop, slash insertion, and keyboard navigation need to work?
3. How should pages, blocks, comments, mentions, backlinks, files, and databases relate?
4. What should be CRDT-managed and what should be event/command-log-managed?
5. How do AppFlowy and AppFlowy-Collab model documents, databases, folders, and sync at a conceptual level?
6. How do AFFiNE/BlockSuite model block stores, multiple renderers, and collaboration conceptually?
7. What do references get wrong or trade off that PagesAI should avoid?
8. Which dependencies are safe as runtime dependencies, and which are study-only?
9. What will an AI agent need that a human user does not?
10. How will this later fit into hofOS with `/api/pages`, sidecar JWTs, host URLs, shared Office-AI, and native module export?

Also produce `/spec/research/reference-inventory.md` with:

- reference name
- URL
- license posture
- what was studied
- what is explicitly not copied
- runtime dependency decision

---

## Required Shared Specs

Write these before implementation:

```text
spec/shared/
├── architecture.md
├── clean-room.md
├── hofos-integration.md
├── design-system.md
├── i18n.md
├── command-bus.md
├── actor-and-agent-model.md
├── security-model.md
├── sync-model.md
├── data-model.md
├── block-model.md
├── database-model.md
├── file-embed-model.md
├── search-model.md
├── permissions.md
├── api.md
├── cli.md
├── mcp.md
└── testing-strategy.md
```

Spec quality bar:

- self-contained
- precise data shapes
- explicit algorithms for hard parts
- honest scope exclusions
- actionable enough for another engineer to implement
- clear about standalone mode vs hofOS mode

---

## Phase Plan

### Phase 1: Foundations, Commands, Storage

Analyze, specify, build, validate:

- workspace/space/page/block identifiers
- actor model: human, agent, system
- command bus
- audited operation log
- idempotency keys
- PostgreSQL schema
- page tree storage
- block tree storage
- snapshots/checkpoints
- permissions baseline
- CLI auth and basic read/write commands

Acceptance:

- CLI can create spaces, pages, and blocks headlessly.
- Replaying operations reconstructs the same page tree/block projection.
- Duplicate idempotency keys do not duplicate mutations.
- Tests cover page create/move/archive, block append/insert/update/move/delete.

### Phase 2: Editor Domain and Import/Export

Analyze, specify, build, validate:

- block types
- inline rich text model
- markdown import/export
- selection-independent transformations
- nested list/toggle/todo behavior
- code blocks
- mentions
- backlinks
- templates

Acceptance:

- CLI can import Markdown into blocks and export blocks back to Markdown.
- Block transforms are pure/headless-tested.
- Backlinks update deterministically.
- Templates can create page/block subtrees.

### Phase 3: Databases

Analyze, specify, build, validate:

- database-as-page/block model
- rows and properties
- property types: title, text, number, select, multi-select, status, checkbox, date, person, relation, rollup, formula, file
- views: table, board, list, calendar
- filters, sorts, groups
- row templates
- CLI database commands

Acceptance:

- CLI can create/query/update databases.
- Views produce deterministic results.
- Filters/sorts/groups have explicit JSON schemas.
- Formula scope is safe and sandboxed.

### Phase 4: Sync and Collaboration

Analyze, specify, build, validate:

- real-time document collaboration
- reconnect semantics
- conflict handling
- presence and cursors
- comments
- notifications hooks
- WebSocket protocol
- snapshot compaction
- operation log repair

Acceptance:

- Multiple simulated clients converge on identical document state.
- Reconnect does not drop or duplicate operations.
- Comments and mentions sync across clients.
- Presence is ephemeral and expires cleanly.

### Phase 5: Agent API, MCP, and Review

Analyze, specify, build, validate:

- typed agent API
- MCP server
- proposal/staging model
- agent budgets
- command scopes
- audit views
- CLI proposal commands

Acceptance:

- Agents can read, search, propose, and apply allowed commands headlessly.
- Policy can require human approval for page/database changes.
- Agent actions are attributable and auditable.
- MCP manifest exposes the safe command catalog.

### Phase 6: Web UI Standalone Harness

Analyze, specify, build, validate:

- standalone app shell
- page sidebar/tree
- block editor
- slash menu
- Cmd+K / Ctrl+K command palette
- database views
- search
- comments drawer
- file embeds
- i18n language switch
- light/dark mode

Acceptance:

- Browser smoke tests cover page creation, block editing, slash commands, Cmd+K, database view, file embed, and refresh restore.
- UI uses design tokens.
- No hardcoded user-facing strings.
- Standalone mode works without hofOS.

### Phase 7: hofOS-Mode Harness and Export Contract

Analyze, specify, build, validate:

- `/api/pages` runtime config
- host URL hydration
- persistent group design
- hidden standalone chrome
- host capabilities for files/Office-AI
- future native module export manifest
- sibling overlay env vars
- dependency singleton checks

Acceptance:

- `pnpm run hofos:check` validates route shapes, proxy prefix, dependency majors, export paths, and singleton policy.
- `pnpm run hofos:harness` builds PagesAI in hofOS mode with mocked host capabilities.
- `pnpm run export:hofos-ui` emits runtime source and a manifest suitable for future import into hofOS.
- Smoke tests prove deep links refresh correctly.

---

## Data Model Starting Point

Specify and refine these concepts before implementation:

```typescript
type ActorType = "human" | "agent" | "system";

interface Command<T extends string, P> {
  command_id?: string;
  type: T;
  payload: P;
  actor_id: string;
  actor_type: ActorType;
  session_id?: string;
  idempotency_key?: string;
  locale?: "de" | "en" | string;
}

interface CommandResult {
  command_id: string;
  status: "applied" | "staged" | "rejected" | "failed";
  operations: Operation[];
  proposal_id?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface Page {
  page_id: string;
  space_id: string;
  parent_page_id?: string;
  title: string;
  icon?: string;
  cover_asset_ref?: AssetRef;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

interface Block {
  block_id: string;
  page_id: string;
  parent_block_id?: string;
  type: string;
  properties: Record<string, unknown>;
  content?: RichText[];
  children: string[];
  created_at: string;
  updated_at: string;
}

interface AssetRef {
  provider: "hofos" | "standalone-s3" | "external-url";
  object_key?: string;
  url?: string;
  version_id?: string;
  mime_type: string;
  size_bytes?: number;
  display_name: string;
}
```

This is illustrative, not final. The spec must decide exact shapes.

---

## Slash Commands

The slash menu is a core interaction surface. Specify and implement it as command registry data, not hardcoded UI.

Minimum slash commands:

- text
- page
- heading 1/2/3
- bullet list
- numbered list
- todo
- toggle
- quote
- callout
- divider
- code
- table
- database
- board
- calendar
- image
- file
- embed S3 asset
- embed Office file
- mention page
- mention person
- AI draft
- AI summarize
- AI rewrite
- template

Slash command results must be invokable from CLI/agent commands too.

---

## Cmd+K / Ctrl+K Command Palette

The command palette is also a core architecture surface.

It must support:

- jump to page
- create page
- search pages/blocks/databases
- insert block
- open templates
- open recent pages
- open backlinks
- switch language
- switch theme
- open settings
- invoke AI actions
- open file/asset picker
- navigate to database views

In hofOS mode, command palette entries must only target routes/actions that work inside hofOS. Standalone-only routes must be hidden or remapped.

---

## File Embeds and Office-AI

File embeds are first-class blocks.

Required block behavior:

- render compact card and expanded preview modes
- show name, MIME type, size, source, version, last updated
- open Office-compatible files via Office-AI in hofOS mode
- use standalone preview/editor fallback in standalone mode only if explicitly implemented
- allow linking an existing S3 object by key
- allow attaching/uploading a local file in standalone mode
- preserve version metadata where available
- expose all file actions through CLI

Office-compatible MIME types:

- DOCX
- XLSX
- PPTX
- PDF

Do not duplicate Office-AI runtime packages in the future hofOS module.

---

## AI-Native Behavior

AI is not a floating chat widget. AI actions use the same command/proposal model as everything else.

Agent capabilities:

- read pages, blocks, databases, comments, and permitted file metadata
- search content
- propose page edits
- propose database updates
- summarize pages
- generate templates
- convert Markdown into pages
- create draft pages
- add comments
- subscribe to changes
- export content

Policies:

- agents can be read-only, propose-only, write-limited, or admin-scoped
- sensitive spaces default to proposal-required
- agents cannot approve their own proposals
- every agent action is attributed and auditable
- budgets/rate limits are enforced server-side

---

## Security Requirements

Specify before building:

- auth in standalone mode
- sidecar JWT verification in hofOS mode
- tenant/workspace isolation
- page/database permissions
- public sharing links, if any
- agent token scopes
- CSRF/session model
- rate limits
- import sanitization
- HTML sanitization
- attachment MIME validation
- audit log
- backup/export behavior

Server-readable content is a deliberate v1 requirement for AI features. E2EE is deferred and must not complicate v1.

---

## Project Structure

Create this monorepo structure only after specs are ready:

```text
/
  packages/
    core/             # shared types, command registry, i18n contracts
    commands/         # command bus and command handlers
    storage/          # DB schema, migrations, repositories
    documents/        # page/block model and transforms
    databases/        # database rows/properties/views/formulas
    sync/             # realtime protocol, presence, snapshots
    files/            # asset references, standalone S3 adapter, host capability contracts
    agent/            # agent API and MCP server
    cli/              # pages-ai CLI
    web/              # standalone browser harness
    server/           # HTTP/WebSocket composition
    hofos/            # hofOS-mode harness/export helpers, no hofOS code copied
  spec/
    research/
    shared/
    phases/
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  infra/
    docker/
  docs/
    build-log/
```

---

## Validation Bar

Before declaring any phase complete:

- specs are updated
- unit tests pass
- integration tests pass against Dockerized Postgres/Redis/MinIO where relevant
- CLI tests pass
- operation replay/projection tests pass
- multi-client convergence tests pass where relevant
- browser smoke tests pass where relevant
- i18n checks pass
- license/dependency review is updated
- build log documents decisions and deviations

Before any future PR/push:

```sh
pnpm check
pnpm quality
```

If the repo uses different commands after setup, document them and keep a single obvious validation path.

---

## First Action

Read this prompt completely. Then:

1. Create `/spec/research/analysis.md`.
2. Analyze Notion behavior, AppFlowy/AppFlowy-Collab concepts, AFFiNE/BlockSuite concepts, and hofOS sister-product integration constraints.
3. Create `/spec/research/reference-inventory.md`.
4. Draft the shared specs.
5. Stop before implementation until the specs are complete enough to build from.

Confirm in the session that:

- you understand the clean-room constraint
- you will not copy AGPL/source-available/proprietary code
- you understand PagesAI must be CLI-first
- you understand the future hofOS integration shape
- you understand Office-AI and S3/file primitives are host capabilities in hofOS mode
- you understand Cmd+K and i18n are core requirements
- you will not start coding before analysis and specs are complete
