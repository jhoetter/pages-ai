# CLI specification

Binary: `pages-ai` (package `@pagesai/cli`).

## Global flags

- `--format json|table|markdown` (default `json`)
- `--locale de|en`
- `--api-url <url>` override

## Exit codes

| Code | Meaning      |
| ---- | ------------ |
| 0    | success      |
| 1    | user error   |
| 2    | auth error   |
| 3    | network      |
| 4    | conflict     |
| 5    | rate limited |
| 6    | validation   |

## Environment

- `PAGESAI_API_URL`
- `PAGESAI_TOKEN`
- `PAGESAI_LOCALE`

## JSON stderr

When `--format json`, errors print `{ "error": { "code", "message" } }` on stderr.

## Commands

See `prompt.md` § CLI-First — all implemented progressively; v1 ships subset documented in `README.md` after build.
