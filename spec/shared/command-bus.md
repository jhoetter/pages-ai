# Command bus

## Envelope (Zod)

```typescript
const ActorType = z.enum(["human", "agent", "system"]);
const CommandEnvelope = z.object({
  command_id: z.string().uuid().optional(),
  type: z.string(),
  payload: z.record(z.unknown()),
  actor_id: z.string(),
  actor_type: ActorType,
  session_id: z.string().optional(),
  idempotency_key: z.string().max(128).optional(),
  locale: z.string().optional(),
});
```

## Result

```typescript
const CommandResult = z.object({
  command_id: z.string().uuid(),
  status: z.enum(["applied", "staged", "rejected", "failed"]),
  operations: z.array(Operation),
  proposal_id: z.string().uuid().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});
```

## Idempotency

- Table `idempotency_keys (key, actor_id, command_hash, result_json, created_at)`.
- Unique `(actor_id, key)` when key present.
- Duplicate → return stored result with HTTP 200.

## Core command types (v1)

- `space.create`, `space.list`
- `page.create`, `page.update`, `page.move`, `page.archive`, `page.restore`, `page.list`
- `block.append`, `block.insert`, `block.update`, `block.move`, `block.delete`
- `db.create`, `db.property.add`, `db.row.create`, `db.view.create`, `db.query`
- `comment.create`, `comment.list`
- `proposal.create`, `proposal.approve`, `proposal.reject`
- `yjs.snapshot` (internal)

## Staging

If space policy `require_proposal_for_writes` and `actor_type === agent` → `status=staged`, create `proposals` row.

## Algorithms

1. Validate envelope + payload schema per type.
2. Authorize (`permissions.md`).
3. Open transaction.
4. Check idempotency.
5. Append `operations` rows + apply to tables.
6. Commit; return result.
