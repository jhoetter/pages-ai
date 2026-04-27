# HTTP API

Base path standalone: `/api`. hofOS: `/api/pages` (strip prefix in proxy — server receives `/api/...` internally after rewrite or mount at `/api`).

## Auth header

`Authorization: Bearer <token>`

## Endpoints (v1)

| Method | Path                       | Description                                         |
| ------ | -------------------------- | --------------------------------------------------- |
| POST   | `/api/commands`            | Execute command envelope                            |
| GET    | `/api/spaces`              | List spaces                                         |
| GET    | `/api/pages`               | `?space_id` `&parent_page_id` `&all_in_space=1` (flat tree) |
| GET    | `/api/pages/:id`           | Page + blocks tree                                  |
| GET    | `/api/search`              | Full-text                                           |
| GET    | `/api/backlinks/:pageId`   | Incoming links                                      |
| GET    | `/api/databases/:id`       | Schema + views                                      |
| POST   | `/api/databases/:id/query` | View query                                          |
| GET    | `/api/comments`            | `?page_id`                                          |
| GET    | `/api/proposals`           | `?space_id` `&status=` pending/approved/rejected     |
| WS     | `/api/ws`                  | Yjs + awareness (standalone); hofOS `/api/pages/ws` |

## Command endpoint

Request: `CommandEnvelope` JSON.  
Response: `CommandResult` JSON.

## Errors

- JSON `{ error: { code, message, details } }` with appropriate HTTP status.
