# Supabase va Vercel

Yangilangan va xavfsiz ko'rsatma: [docs/ISHGA-TUSHIRISH.md](docs/ISHGA-TUSHIRISH.md).

Muhim: Vercel Root Directory loyiha ildizi bo'lishi kerak, public emas.
Serverda SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY va PUBLIC_ORIGIN sozlanadi.
Anon kalit frontend orqali ishlatilmaydi. Eski RLS'ni o'chiruvchi skriptlardan foydalanmang.
Mavjud bazada migrations/001_secure_server.sql; yangi bazada supabase-schema.sql.
