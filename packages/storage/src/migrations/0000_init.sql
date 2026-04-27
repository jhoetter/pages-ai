CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL REFERENCES "spaces"("id"),
	"parent_page_id" uuid,
	"title" text NOT NULL,
	"icon" text,
	"search_document" text DEFAULT '',
	"archived_at" timestamp with time zone,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "pages_space_parent_idx" ON "pages" ("space_id","parent_page_id");

CREATE TABLE IF NOT EXISTS "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
	"parent_block_id" uuid,
	"type" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "blocks_page_parent_idx" ON "blocks" ("page_id","parent_block_id");

CREATE TABLE IF NOT EXISTS "operations" (
	"id" bigserial PRIMARY KEY,
	"command_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"op_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "operations_command_idx" ON "operations" ("command_id");

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"actor_id" text NOT NULL,
	"key" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_actor_key" UNIQUE("actor_id","key")
);

CREATE TABLE IF NOT EXISTS "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL REFERENCES "spaces"("id"),
	"actor_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rationale" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
	"block_id" uuid,
	"author_id" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "comments_page_idx" ON "comments" ("page_id");

CREATE TABLE IF NOT EXISTS "databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL REFERENCES "spaces"("id"),
	"parent_page_id" uuid,
	"title" text NOT NULL,
	"schema_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "database_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL REFERENCES "databases"("id") ON DELETE CASCADE,
	"cells" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "database_rows_db_idx" ON "database_rows" ("database_id");

CREATE TABLE IF NOT EXISTS "database_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL REFERENCES "databases"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"query_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "database_views_db_idx" ON "database_views" ("database_id");

CREATE TABLE IF NOT EXISTS "yjs_snapshots" (
	"page_id" uuid PRIMARY KEY REFERENCES "pages"("id") ON DELETE CASCADE,
	"snapshot" bytea NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
