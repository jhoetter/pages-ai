# Testing strategy

## Unit

- Vitest in each package for pure logic: command handlers, query engine, markdown, permissions.

## Integration

- Testcontainers or docker-compose Postgres + Redis; spin up Fastify app; supertest HTTP.

## Replay

- Golden tests: apply operation list → expected block tree JSON.

## E2E

- Playwright against `http://localhost:3400`: create page, type in editor, slash menu, Cmd+K, refresh restores URL.

## CI

- `pnpm check` = format + lint + typecheck + `hofos:check` + unit tests.
- `pnpm quality` = integration + e2e (optional nightly if slow).

## Coverage targets

- Core command handlers ≥80% lines; UI smoke critical paths only.
