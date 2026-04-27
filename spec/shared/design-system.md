# Design system

## Tokens (CSS variables)

| Token            | Usage              |
| ---------------- | ------------------ |
| `--pa-bg`        | App background     |
| `--pa-fg`        | Primary text       |
| `--pa-surface`   | Cards, panels      |
| `--pa-hover`     | Hover background   |
| `--pa-divider`   | Hairline borders   |
| `--pa-secondary` | Secondary text     |
| `--pa-tertiary`  | Tertiary / hints   |
| `--pa-accent`    | Primary actions    |
| `--pa-warning`   | Warnings           |
| `--pa-danger`    | Errors/destructive |
| `--pa-success`   | Success            |

Light/dark: `data-theme="light"|"dark"` on `<html>`.

## Spacing scale

`4, 8, 12, 16, 20, 24, 32, 40, 48` px.

## Typography

- UI font: system stack (`-apple-system`, `Segoe UI`, …).
- Mono: `ui-monospace` for code blocks.
- Sizes: `12` (caption), `14` (body), `16` (editor), `20/24/30` (headings).

## Components

- **Sidebar**: 260px fixed; tree indent 20px; drag handle 14px hit area.
- **Editor block**: 4px vertical rhythm; left gutter for handle.
- **Slash menu**: max-height 320px; `cmdk` styles; keyboard nav required.
- **Command palette**: full-screen overlay, same list patterns.
- **DB toolbar**: filter chips, sort dropdown, view tabs.
- **Comments**: right drawer 360px.
- **File card**: title, mime, size, updated, actions row.

## A11y

- Focus rings visible; `aria-expanded` on menus; shortcut hints `aria-keyshortcuts`.

## hofOS mapping

In native module, map `--pa-*` to host semantic tokens when `HOFOS_MODE=1` (CSS layer or host-injected variables).
