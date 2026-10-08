# Vercel va API sozlash

Faol arxitektura: Node.js + SQLite API; Vercel’da statik sayt va API proksi.
Brauzerdan Supabase’ga bevosita kirish yopildi: oldingi adapter parollarni
ochiq saqlagan va server ruxsatlarini chetlab o‘tgan.

1. [Server qo‘llanmasi](deploy/SERVERGA-JOYLASH.md) bo‘yicha API’ni doimiy diskli VPS’da ishga tushiring.
2. Vercel’da `API_ORIGIN=https://api.YOUR_DOMAIN` belgilang.
3. VPS’da `PUBLIC_ORIGIN=https://YOUR_SITE.vercel.app`, `DEMO_MODE=false` va `SECURE_COOKIE=true` belgilang.
4. Yangi production bazasi uchun `ADMIN_PHONE` va kamida 14 belgili `ADMIN_PASSWORD` kiriting.
5. Saytni qayta joylashtirib, login, murojaat, fayl va logout jarayonlarini tekshiring.

Agar avvalgi SQL ishlatilgan bo‘lsa, yangilangan `supabase-fix.sql`ni Supabase
SQL Editor’da qo‘lda bajaring. U ilova jadvallaridagi ochiq ruxsatlarni yopadi,
ma’lumotlarni o‘chirmaydi. Eski ochiq parollarni almashtiring. Supabase’dagi
yozuvlar SQLite’ga avtomatik ko‘chirilmaydi; eski bazani saqlang.

Tuzatishlar va tekshirish chegaralari: [tekshiruv qaydlari](docs/TEKSHIRUV.md).
