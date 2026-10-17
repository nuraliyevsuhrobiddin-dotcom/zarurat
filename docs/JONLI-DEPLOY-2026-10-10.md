# Jonli deploy — 10.10.2026

- Sayt: https://zarurat-inky.vercel.app
- Vercel loyihasi: `zarurat`, production.
- Deploy ID: `dpl_3AQ2bRRKFemmdhqxU644CMCeXHmF`.
- Holat: READY, asosiy domen yangi versiyaga yo‘naltirildi.
- 12 ta ochiq fayl jonli domen orqali olinib, mahalliy fayllar bilan SHA-256
  bo‘yicha solishtirildi: 12/12 mos.
- `/api/health`: 200, status `ok`.
- `/api/auth/me`: 200, backend sozlangan.
- Noto‘g‘ri murojaat rad etilishi tekshirildi: 400. Sinov mijozlari yoki
  murojaatlari jonli bazada yaratilmagan.
- Jonli mobil forma, paketlar va markaz ko‘rinishi brauzerda tekshirildi.

## Yakunlanmagan baza yangilanishi

Supabase loyihasi: `aqjwgflyyiyzaqzmxbwv`.
`migrations/003_intake_clarification.sql` hali jonli bazaga qo‘llanmagan.
SQL yozish ulanishi mavjud emas; Supabase ilovasi ulanishi so‘ralgan.
Foydalanuvchi hozircha Supabase’ni ulay olmasligini bildirdi.
Ulanish tasdiqlangach mavjud loyiha ID si tekshirilib, migratsiya qo‘llanishi kerak.

Muqobil: https://supabase.com/dashboard/project/aqjwgflyyiyzaqzmxbwv/sql/new
da tayyor `003` SQL faylini bajarish. U ma’lumotlarni o‘chirmaydi.
Keyin `npm run check:ready` va jonli koordinator funksiyalari tekshiriladi.

Migratsiya bajarilguncha qisqa murojaat formasi va mavjud xizmat jarayonlari
ishlaydi; yangi aniqlashtirish maydonlari avtomatik yashiriladi.

Mahalliy saqlangan ikki xil rahbar paroli bilan kirish 401 qaytardi.
Kabinetning jonli autentifikatsiyalangan tekshiruvi amaldagi hisob orqali
kirishni talab qiladi. Hisoblar yoki parollar o‘zgartirilmagan.

Vercelga yuborilgan fayllardan `.env`, cache, hujjatlar, sinovlar va mahalliy
agent papkalari chiqarib tashlangan.

## Markaz rasmi yangilanishi

Keyingi production deploy: `dpl_BDnYcuBJUnf7xK1G7qukf7HSGhky`, READY.
AI hero, ustidagi kartochkalar va AI izohi olib tashlandi. Birinchi ekranda
bitta katta markaz rasmi bor; uning tagida ZARURIYAT CENTER nomi,
`+998 55 406 77 55` telefon havolasi va `Qashqadaryo, Qarshi` manzili ko‘rsatiladi.

320/390/820/821/1280 px ko‘rinishlari tekshirildi. Jonli brauzerda aynan bitta
hero rasmi, surat ostidagi kontaktlar, to‘g‘ri telefon havolasi va gorizontal
chiqish yo‘qligi tasdiqlandi. O‘zgargan 5 ta ochiq fayl SHA-256 bo‘yicha mos;
server health 200. Kesh versiyasi `v7`.
