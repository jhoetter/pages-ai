# Notion-style selection — analysis, specification, and build plan

This document analyses what “selection” means in a Notion-like editor (using your reference screenshots as anchors), maps it to the current PagesAI Lexical setup, and proposes a phased plan **without** AI features.

---

## 1. What the references show

### 1.1 Simple table (pricing grid)

- **Cell selection**: One cell is primary — clear **outline** (e.g. blue) and **handles** on the mid-left / mid-right of the cell edge (drag to extend selection or resize affordance).
- **Row / column chrome**: A **neutral grab strip** (e.g. grey bar) at corners / headers suggests whole-row, whole-column, or whole-table operations.
- **Meaning**: Selection is **hierarchical** — the user can be “in” a **cell** while the table remains one **block**.

### 1.2 Large embedded block (methodology / diagram)

- **Block-level chrome**: **Six-dot** drag handle, **floating toolbar** (duplicate of Notion: comment, media, …). Here the **whole canvas** is one block; inner boxes are not shown selected in the static image.
- **Meaning**: At minimum you need a strong **L1 (block)** selection model with **toolbar anchoring**. **L2 (sub-elements)** inside the diagram is a separate, heavier step (hit-testing, own model, or an embedded editor).

---

## 2. Selection layers (specification)

Use explicit **levels** so UI and commands stay consistent:

| Level | Name | Example | Typical chrome |
|--------|------|---------|----------------|
| **L0** | Page / shell | Sidebar, title | (App chrome — out of scope) |
| **L1** | **Block** | Paragraph, heading, file embed, table container, diagram container | Hover rail (`+` / grip), reorder, delete, “turn into” |
| **L2** | **Sub-block** | Table cell, row, column; future: diagram node | Cell border + handles, row/column headers |
| **L3** | **Text** | Caret / range inside paragraph or inside cell | Native caret, bold/italic, link |

**Rules (Notion-like):**

1. **Deepest wins on click**: Click lands in the deepest level that contains the point (text > cell > block).
2. **Bubble up with Escape**: Repeated Escape (or explicit “click outside”) collapses L3→L2→L1.
3. **One primary L2 per block type**: For a table, at most one contiguous cell selection (range optional later).
4. **L1 stays explicit for decorators**: `DecoratorNode` content is not normal Lexical text — block focus must be **orthogonal** to text selection (see §3).

**Non-goals for v1:** AI actions, multi-block marquee selection, collaboration cursors.

---

## 3. Current PagesAI reality (short)

- **Body**: Lexical with custom **element** nodes (`pa-paragraph`, `pa-heading`, …) and **decorator** nodes (file, divider, legacy types including **database** / page link / …).
- **L1 affordances**: `BlockHoverHandles` — hover-based rail + drag reorder + menu (**not** yet tied to Lexical “selected block”).
- **Database in body**: `InlineDatabaseBlock` → `DatabaseTableView` — a **full view** inside a decorator; cell selection today is **inside the database product**, not unified with “page block selection”.
- **No first-class “simple table”** block in page body (Notion’s `/table` is often a lightweight grid, not always a DB). Pricing-style tables may today be DB-backed or missing — product choice affects Phase 2.

Implication: **L3** is already there for text blocks. **L1** needs alignment between **hover**, **Lexical node selection** (especially decorators), and **persistence** (`page.body_sync`). **L2** for tables requires either **embedding** the DB view’s selection into this model **or** introducing a **simple table** block with its own cell model.

---

## 4. Technical approaches (by level)

### 4.1 L1 — Block selection

**Goal:** Clicking a decorator or margin selects the block; chrome reflects **selection**, not only hover.

**Options:**

- **A. Lexical `NodeSelection`** (or root child key tracking): On decorator click, dispatch `select` on the block node; listen in a small plugin and expose `activeBlockId` via context.
- **B. DOM + bridge**: Keep `data-block-id` and manage `selectedBlockId` in React context (simpler, but must stay in sync with Lexical moves/deletes).

**Recommendation:** Prefer **A** where Lexical supports it for decorator clicks; fall back to **B** for edge cases. Unify `BlockHoverHandles` so the rail targets **`max(hover, selected)`** for the same block.

### 4.2 L2 — Table / grid

**Goal:** Cell outline + handles + optional row/column strips (as in reference).

**Options:**

- **Reuse `DatabaseTableView`**: Expose a narrow API — `onCellSelectionChange`, `onTableChrome` — and mirror selection into page-level context for a **single** combined “selected cell” state when the DB block is L1-selected.
- **New `simple_table` block**: Store grid as JSON in block `content`; render with a **controlled** cell selection model; map to Lexical as one decorator or a structured subtree (harder in Lexical).

**Recommendation:** Short term — **improve DB embed UX** (L1 toolbar + focus ring) and define whether pricing tables are **DB views** or a **new block**. Medium term — if you need true Notion-simple-table behaviour, add **`simple_table`** with explicit L2 state in `content`.

### 4.3 L2 — Diagram / methodology block

**Goal:** Block-level toolbar + drag; inner boxes optional later.

**Recommendation:** **Phase 1** — one **diagram embed** decorator (image/SVG or sandboxed canvas) with **only L1** selection and chrome. **Phase 2+** — if inner editing is required, use an **embedded editor** (e.g. tldraw, Excalidraw API, or custom SVG hit-test) and pass **L2** only inside that iframe/component boundary; do not try to express every shape as Lexical nodes initially.

---

## 5. Build plan (phased, no AI)

### Phase 0 — Selection state foundation

- Introduce **`PageBodySelectionContext`** (or extend surface context): `selectedBlockId`, `selectionLevel`, optional `subSelection` payload (e.g. `{ type: 'table', cell: [r,c] }`).
- **Single source of truth**: Prefer updates from Lexical plugins + explicit clears on blur/navigation.
- Document **z-index** and **token** rules for rings (reuse `--pa-accent`, borders) per project styleguide.

### Phase 1 — L1 parity (blocks)

- **Decorator focus**: Clicking file / divider / legacy / future diagram selects the block (Lexical `NodeSelection` or equivalent).
- **Hover vs selected**: Merge `BlockHoverHandles` with **selected** state so chrome does not “float away” when mouse leaves.
- **Keyboard**: `Escape` clears L1 extras (menus) then deselects block; define order.
- **Persistence**: No change to `page.body_sync` contract; selection is ephemeral UI only.

### Phase 2 — Table story (product pick)

- **If DB-first**: Enhance `InlineDatabaseBlock` / `DatabaseTableView` with optional **block-selected** ring, and optional **emit cell selection** to parent for future unified toolbar.
- **If simple-table**: Spec DTO + `lexical` bridge for `simple_table`; implement L2 cell model + keyboard navigation + minimal handles (even static width first).

### Phase 3 — Embeds & diagrams (L1 only)

- **Methodology-style** block: L1 chrome (grip, menu: delete, open, download) **without** inner shape selection.
- **File / image**: Already decorators — ensure L1 ring matches Phase 1.

### Phase 4 — L2 polish & advanced

- **Extend selection** (drag handles for multi-cell) for simple table.
- **Diagram L2** only if product commits to an embed technology.
- **Multi-block** selection and batch actions (later).

### Phase 5 — QA & UX polish

- **Focus traps**: File picker, modals, slash menu — ensure `pendingReplaceKeyRef`-style patterns for any dialog that steals focus.
- **Mobile / touch**: Larger hit targets for handles; optional hide advanced handles on small screens.

---

## 6. Success criteria (incremental)

1. Click any body block → **visible L1 selection** + **consistent** hover rail behaviour.
2. `Escape` and click-outside **predictably** step down / clear selection.
3. Table (whichever implementation) shows **cell-level** outline when editing cells; block-level ring when the table block is the anchor.
4. Large embed blocks have **clear L1** chrome **without** AI buttons.
5. No regression to **`page.body_sync`** (selection-only UI must not corrupt persisted JSON).

---

## 7. Out of scope (explicit)

- AI: “Ask AI”, smart rewrite, auto-layout.
- **Comments** integration on selection toolbar (can stay on existing comment entry points until unified toolbar exists).
- Real-time collaboration presence.

---

*Last updated: 2026-05-03 · Aligned with Lexical-first `PageBodyEditor` + `BlockHoverHandles`.*
