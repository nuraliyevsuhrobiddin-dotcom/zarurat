-- ====================================================================
-- ZARURIYAT — SUPABASE BAZASINI TO'LIQ TIKLASH VA RUXSATLARNI OCHISH
-- ====================================================================
-- QO'LLANMA:
-- 1. https://supabase.com ga kiring va o'z loyihangizni oching.
-- 2. Chap menyudan "SQL Editor" bo'limiga kiring.
-- 3. "New query" ochib, ushbu kodni tashlang (Paste).
-- 4. Pastdagi yashil "RUN" tugmasini bosing!
-- ====================================================================

-- 1. Sxemaga to'liq ruxsat berish (anon va authenticated rollari uchun)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Har bir jadval uchun ochiq RLS siyosatlarini (Policies) yaratish
-- Bu yangi foydalanuvchi ro'yxatdan o'tishi va murojaat qoldirishiga to'liq ruxsat beradi
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['partners', 'users', 'cases', 'services', 'history',
    'attachments', 'feedback', 'packages', 'package_usage', 'notifications'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_full_access" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon all" ON public.%I', t);
      EXECUTE format('CREATE POLICY "anon_full_access" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)', t);
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 3. Kelajakda yaratiladigan barcha jadvallar uchun ham ruxsatlarni saqlash
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. Barcha eski demo va sinov hisoblarini tozalash (agar mavjud bo'lsa)
DELETE FROM users WHERE login IN ('operator', 'director', 'client', 'partner');
DELETE FROM partners WHERE id = 1 AND name LIKE '%Adolat%';

SELECT 'Supabase bazasi sozlandi. Barcha ruxsatlar ochildi va demo akkauntlar olib tashlandi!' AS natija;
