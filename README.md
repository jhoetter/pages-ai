# PagesAI

Notion-like workspace: CLI-first command bus, PostgreSQL, standalone web harness on port **3400**, hofOS sister integration (`/api/pages`).

## Prerequisites

- Node 20+
- pnpm 9+
- Docker (for Postgres/Redis/MinIO): `docker compose -f infra/docker/docker-compose.yml up -d`

## Configure

Copy `.env.example` to `.env`. Default API port **3399** (avoids clashing with other local apps); web UI uses **3400**.

## Develop

```sh
make install   # once after clone (same idea as drive-ai: wraps pnpm install)
make dev
```

This starts Docker services (Postgres on **5433**, Redis **6380**, MinIO **9002**), runs SQL migrations on API boot, then the API on **3399** and the Vite app on **3400**.

Day-to-day you only need **`make dev`** if dependencies are already installed. After pulling dependency changes, run **`make install`** again.

Manual alternative: `pnpm --filter @pagesai/server dev` and `pnpm --filter @pagesai/web dev` in two terminals.

Open `http://127.0.0.1:3400/pages`.

Stop infra: `make dev-down`.

### Running next to sister apps (e.g. drive-ai)

Host ports are chosen **not** to clash (PagesAI: Postgres **5433**, web **3400**, API **3399**; drive-ai: **35432**, **3500**, **3520**). Each repo’s compose file sets a distinct **Docker Compose project name** (`pagesai` vs `driveai`) so containers are not both named `docker-postgres-1`.

If you still have old containers from before that change, stop the legacy project once:

```sh
docker compose -p docker -f infra/docker/docker-compose.yml down   # from pages-ai, if needed
docker compose -p docker -f infra/docker/docker-compose.dev.yml down # from drive-ai, if needed
```

Then `make dev` in each repo.

## CLI

```sh
pnpm --filter @pagesai/cli build
node packages/cli/dist/index.js space list
node packages/cli/dist/index.js page create --space <uuid> --title "Hello"
```

Ensure the API is running; default space is seeded for tenant `dev-tenant`.

## Validation

```sh
pnpm check    # format, lint, hofos:check, typecheck, unit tests
pnpm quality  # install Playwright Chromium, integration, e2e (e2e bootstraps Docker + `pnpm dev` — see packages/web/playwright.config.ts)
```

## hofOS

- Contract: `hofos-ui.config.json` → `../hof-os/infra/sister-ui-contract.json` (product `pagesai`).
- `pnpm run hofos:check` — dependency majors + routes + export paths.
- `pnpm run export:hofos-ui` — copies `packages/web/src` into `release-out/hofos-ui/...`.

## Specs

Authoritative design docs live in [`spec/shared/`](spec/shared/) and [`spec/research/`](spec/research/).

## Consumed Via Tarball URL

The hofOS host consumes the built UI package from GitHub Releases rather than copying source trampolines into customer cells. Each release attaches `pagesai-ui-<version>.tgz`, installable with:

```json
"@pagesai/hofos-ui": "https://github.com/jhoetter/pages-ai/releases/download/v0.1.0/pagesai-ui-0.1.0.tgz"
```

For local iteration, run `pnpm run build:dist` or point hofOS' local-dev override at `packages/hofos-ui`.

