-- One implicit Pages "space" per hof tenant (same model as collaboration-ai workspace ↔ tid).
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_tenant_id_key" UNIQUE ("tenant_id");
