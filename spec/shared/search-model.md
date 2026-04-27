# Search

## v1

- PostgreSQL `tsvector` column on `pages.title` + denormalized `pages.search_document` (concat block text).
- GIN index on `to_tsvector('simple', search_document)`.
- Endpoint: `GET /api/search?q=...&space_id=...`

## Refresh

- On `block.update`, enqueue async reindex (v1 synchronous recompute for small tenants).

## Future

- pgvector / external index for semantic search.
