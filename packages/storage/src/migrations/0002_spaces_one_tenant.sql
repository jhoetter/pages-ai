-- One implicit Pages "space" per hof tenant (same model as collaboration-ai workspace ↔ tid).
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'spaces_tenant_id_key'
			AND conrelid = 'spaces'::regclass
	) THEN
		ALTER TABLE "spaces" ADD CONSTRAINT "spaces_tenant_id_key" UNIQUE ("tenant_id");
	END IF;
END $$;
