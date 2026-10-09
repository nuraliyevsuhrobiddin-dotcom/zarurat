-- ====================================================================
-- ZARURIYAT — SUPABASE BAZASINI TO'LIQ TIKLASH VA RUXSATLARNI OCHISH
-- ====================================================================
-- QO'LLANMA:
-- 1. https://supabase.com ga kiring va o'z loyihangizni oching.
-- 2. Chap menyudan "SQL Editor" bo'limiga kiring.
-- 3. "New query" ochib, ushbu fayldagi barcha kodni tashlang (Paste).
-- 4. Pastdagi yashil "RUN" tugmasini bosing!
-- ====================================================================

-- 1. Sxemaga to'liq ruxsat berish
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Har bir jadval uchun RLS siyosatlarini (Policies) yaratish
-- Bu INSERT va Ro'yxatdan o'tishdagi "violates row-level security policy" xatosini butunlay yo'qotadi!
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['partners', 'users', 'cases', 'services', 'history',
    'attachments', 'feedback', 'packages', 'package_usage', 'notifications'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      -- Jadvalda RLS ni faollashtirib, unga to'liq ruxsat beruvchi ochiq siyosat (policy) yaratamiz:
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_full_access" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon all" ON public.%I', t);
      EXECUTE format('CREATE POLICY "anon_full_access" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)', t);
      
      -- Qo'shimcha ravishda RLS ni o'chirib ham qo'yamiz:
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 3. Kelajakda yaratiladigan jadvallar uchun ham ruxsatlarni saqlash
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. Boshlang'ich namuna hamkor
INSERT INTO partners (id, name, phone, address, category, hours, region, price, contract_status) VALUES
(1, '«Adolat» yuridik byurosi', '+998901112233', 'Toshkent sh., Amir Temur shox ko‘chasi, 12-uy', 'legal', '09:00 - 18:00', 'Toshkent shahri', 150000, 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Boshlang'ich foydalanuvchilar (Login / Parol: Zaruriyat2026!)
INSERT INTO users (login, name, phone, password_hash, role, partner_id) VALUES
('operator', 'Operator Sarvinoz', '+998901234501', 'Zaruriyat2026!', 'operator', NULL),
('director', 'Rahbar Aziz', '+998901234502', 'Zaruriyat2026!', 'director', NULL),
('client', 'Mijoz Dilshod', '+998901234503', 'Zaruriyat2026!', 'client', NULL),
('partner', 'Hamkor Rustam', '+998901234504', 'Zaruriyat2026!', 'partner', 1)
ON CONFLICT (login) DO UPDATE SET password_hash = 'Zaruriyat2026!';

SELECT 'Tabriklaymiz! Supabase bazasi to''liq tiklandi va ruxsatlar 100% ochildi!' AS natija;
