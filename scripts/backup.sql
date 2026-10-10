-- Execute using Supabase Management API before migration.
-- Save the JSON output to data-private/, never to public/ or a tool transcript.
-- All rows are read in one statement/snapshot; includes legacy password data.
SELECT jsonb_build_object(
  'created_at', now(),
  'database', current_database(),
  'tables', jsonb_build_object(
    'users', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.users t),
    'partners', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.partners t),
    'cases', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.cases t),
    'services', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.services t),
    'history', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.history t),
    'attachments', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.attachments t),
    'feedback', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.feedback t),
    'packages', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.packages t),
    'package_usage', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.package_usage t),
    'notifications', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM public.notifications t)
  ),
  'columns', (SELECT jsonb_agg(c) FROM information_schema.columns c WHERE table_schema='public'),
  'policies', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM pg_policies p WHERE schemaname='public'),
  'sequences', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM pg_sequences s WHERE schemaname='public')
) AS backup;
