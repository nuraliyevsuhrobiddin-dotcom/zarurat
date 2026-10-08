-- Close direct browser access to legacy application tables.
-- Run manually in Supabase SQL Editor if an earlier permissive script was used.
-- No rows are changed or deleted. The application now uses Node.js + SQLite.
BEGIN;
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['partners', 'users', 'cases', 'services', 'history',
    'attachments', 'feedback', 'packages', 'package_usage', 'notifications'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
COMMIT;
