# Actors and agents

## Actor types

| Type     | Description          |
| -------- | -------------------- |
| `human`  | Interactive user     |
| `agent`  | API key / MCP client |
| `system` | Migrations, cron     |

## Identity

- `actors` table: `id`, `type`, `display_name`, `external_ref`.
- JWT / API key resolves to `actor_id`.

## Agent tokens

- Scopes: `read`, `write`, `propose`, `comment`, `admin` (comma list).
- Stored hashed; CLI `auth token create --scopes`.

## Proposals

- Agent with only `propose` cannot call `apply` on staged mutations.
- Human with `write` approves.

## Attribution

Every operation row stores `actor_id`, `actor_type`, optional `agent_run_id`.

## Budgets (v1 stub)

- `agent_budgets` table optional; default limits: 100 commands/min per agent.
