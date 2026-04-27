# Sync model

## Yjs

- One `Y.Doc` per `pageId` room name: `page:<pageId>`.
- Shared structure: `Y.Map` root with key `blocks` containing serialized Lexical JSON or nested maps (v1: **string** `lexicalState` on root).

## WebSocket protocol

Client → server messages (JSON frame):

```typescript
type ClientMsg =
  | { t: "sync_step1"; docId: string; sv: number[] } // state vector
  | { t: "sync_update"; docId: string; update: number[] } // Uint8 as JSON array
  | { t: "awareness"; docId: string; payload: unknown }
  | { t: "presence"; pageId: string; cursor?: unknown };
```

Server → client:

```typescript
type ServerMsg =
  | { t: "sync_ack"; docId: string }
  | { t: "sync_update"; docId: string; update: number[] }
  | { t: "awareness"; docId: string; payload: unknown }
  | { t: "error"; code: string };
```

## Redis

- Channel `pagesai:page:<pageId>` pub/sub for cross-instance Yjs forwarding (optional single-node v1: in-memory).

## Persistence

- Debounce 2s: serialize Lexical → `blocks` table for page root block tree (v1 flat: single root `page` block with children).

## Reconnect

- Client sends full state vector; server returns missing updates from in-memory store + DB snapshot seed.

## Comments

- Not in Yjs v1; use REST `comment.*` commands; UI polls or subscribes to `ws` `comment_event` broadcast.
