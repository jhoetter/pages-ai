import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  doublePrecision,
  bigserial,
  unique,
  index,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("spaces_tenant_id_key").on(t.tenantId)],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    parentPageId: uuid("parent_page_id"),
    title: text("title").notNull(),
    icon: text("icon"),
    coverImageUrl: text("cover_image_url"),
    /** CSS `background-position` e.g. `50% 35%` */
    coverImagePosition: text("cover_image_position"),
    searchDocument: text("search_document").default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("pages_space_parent_idx").on(t.spaceId, t.parentPageId)],
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    parentBlockId: uuid("parent_block_id"),
    type: text("type").notNull(),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("blocks_page_parent_idx").on(t.pageId, t.parentBlockId)],
);

export const operations = pgTable(
  "operations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    commandId: uuid("command_id").notNull(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(),
    opType: text("op_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("operations_command_idx").on(t.commandId)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    actorId: text("actor_id").notNull(),
    key: text("key").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("idempotency_actor_key").on(t.actorId, t.key)],
);

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id),
  actorId: text("actor_id").notNull(),
  status: text("status").notNull().default("pending"),
  rationale: text("rationale").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    blockId: uuid("block_id"),
    authorId: text("author_id").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("comments_page_idx").on(t.pageId)],
);

export const databases = pgTable("databases", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id),
  parentPageId: uuid("parent_page_id"),
  title: text("title").notNull(),
  schemaJson: jsonb("schema_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const databaseRows = pgTable(
  "database_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => databases.id, { onDelete: "cascade" }),
    cells: jsonb("cells").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("database_rows_db_idx").on(t.databaseId)],
);

export const databaseViews = pgTable(
  "database_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => databases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    queryJson: jsonb("query_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("database_views_db_idx").on(t.databaseId)],
);

export const yjsSnapshots = pgTable("yjs_snapshots", {
  pageId: uuid("page_id")
    .primaryKey()
    .references(() => pages.id, { onDelete: "cascade" }),
  snapshot: bytea("snapshot").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
