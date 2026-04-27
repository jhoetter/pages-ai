# Clean-room policy

## Allowed

- Public documentation, demos, blog posts, conference talks.
- Concept extraction: block trees, slash UX, database views, sync topologies.
- Permissive OSS dependencies (MIT, Apache-2.0, BSD, ISC).

## Forbidden

- Copying Notion or competitor **source**, **CSS**, **assets**, **wording**, or **undocumented APIs**.
- AGPL / source-available **runtime** dependencies unless legal review adds allowlist entry.
- Renaming-identifiers reuse from foreign codebases.

## Engineering process

1. Specs in `/spec` are authoritative.
2. Any third-party snippet → reject unless license file recorded in `docs/build-log/licenses.md`.
3. `pnpm run license:scan` (if present) must pass before release.
