-- ====================================================================
-- ZARURIYAT — SUPABASE BAZASINI TIKLASH VA RUXSATLARNI OCHISH (SQL FIX)
-- ====================================================================
-- QO'LLANMA:
-- 1. https://supabase.com ga kiring va o'z loyihangizni oching.
-- 2. Chap menyudan "SQL Editor" bo'limini bosing.
-- 3. "New query" ochib, ushbu fayldagi barcha kodni tashlang (Paste).
-- 4. Pastdagi yashil "RUN" tugmasini bosing!
-- ====================================================================

-- 1. Jadvallardagi RLS (Row Level Security) ni o'chirish (to'g'ridan-to'g'ri ishlashi uchun)
ALTER TABLE IF EXISTS partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS package_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;

-- 2. 'anon', 'authenticated' va 'service_role' ga to'liq ruxsatlarni berish (401 xatosini yo'qotadi)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Yangi yaratiladigan jadvallar uchun ham avtomatik ruxsatlar
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 3. Boshlang'ich namuna hamkor
INSERT INTO partners (id, name, phone, address, category, hours, region, price, contract_status) VALUES
(1, '«Adolat» yuridik byurosi', '+998901112233', 'Toshkent sh., Amir Temur shox ko‘chasi, 12-uy', 'legal', '09:00 - 18:00', 'Toshkent shahri', 150000, 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Boshlang'ich foydalanuvchilar (Login / Parol: Zaruriyat2026!)
INSERT INTO users (login, name, phone, password_hash, role, partner_id) VALUES
('operator', 'Operator Sarvinoz', '+998901234501', 'Zaruriyat2026!', 'operator', NULL),
('director', 'Rahbar Aziz', '+998901234502', 'Zaruriyat2026!', 'director', NULL),
('client', 'Mijoz Dilshod', '+998901234503', 'Zaruriyat2026!', 'client', NULL),
('partner', 'Hamkor Rustam', '+998901234504', 'Zaruriyat2026!', 'partner', 1)
ON CONFLICT (login) DO UPDATE SET password_hash = 'Zaruriyat2026!';

SELECT 'Supabase bazasi muvaffaqiyatli tiklandi va ruxsatlar ochildi!' AS natija;
