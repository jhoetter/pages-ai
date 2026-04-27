# Database model (Notion-like)

## Container

- `databases` table: `id`, `space_id`, `parent_page_id` nullable, `title`, `schema_json`, `created_at`.

## Schema JSON

```typescript
type PropertySchema = {
  id: string;
  name: string;
  type:
    | "title"
    | "text"
    | "number"
    | "select"
    | "multi_select"
    | "status"
    | "checkbox"
    | "date"
    | "person"
    | "relation"
    | "rollup"
    | "formula"
    | "file";
  config?: Record<string, unknown>;
};
type DatabaseSchema = { properties: PropertySchema[] };
```

## Rows

- `database_rows`: `id`, `database_id`, `cells` jsonb `{ [propertyId]: value }`, `created_at`, `updated_at`.

## Views

- `database_views`: `id`, `database_id`, `name`, `type` (`table|board|list|calendar`), `query_json`.

## Query JSON

```typescript
type ViewQuery = {
  filters: Array<{ propertyId: string; op: string; value: unknown }>;
  sorts: Array<{ propertyId: string; direction: "asc" | "desc" }>;
  groupBy?: string;
};
```

## Formulas (v1)

- Sandboxed `expr-eval` or custom DSL: only numeric/date/string ops on row cells; **no** network/fs.

## Determinism

- Query engine sorts nulls last; tie-break `row.id`.
