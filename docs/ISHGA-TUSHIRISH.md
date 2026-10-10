# Xavfsiz versiyani ishga tushirish

## 1. Mavjud bazani yangilash

1. Supabase'da bazaning zaxira nusxasini oling. Migratsiya mavjud jadvallarni va rollarni saqlaydi.
2. Supabase SQL Editor'da `migrations/001_secure_server.sql` ni to'liq bajaring.
   U tranzaksiyada ishlaydi, eski parollarni bcrypt'ga o'tkazadi, sessions/rate_limits
   jadvallarini va server RPC'larini yaratadi, anon/authenticated jadval huquqlarini yopadi.
3. Yangi bazada uning o'rniga `supabase-schema.sql` ni bajaring.
   `SUPABASE_TIKLASH.sql` endi shu xavfsiz migratsiya nusxasi; yozuvlarni o'chirmaydi.
4. Eski frontend to'g'ridan-to'g'ri bazaga ulangan: migratsiya va yangi deployni bitta
   texnik xizmat oynasida bajaring. Eski keng ruxsatli SQL'ni qayta ishga tushirmang.
5. Ilgari ochiq baza bo'lgan bo'lsa, saqlangan parollar maxfiyligi kafolatlanmagan:
   mavjud hisob parollarini boshqariladigan tarzda yangilang. Migratsiya tarixdagi oshkorlikni bartaraf qilmaydi.

## 2. Server muhiti

Vercel Settings ' Environment Variables:

| O'zgaruvchi | Qiymat |
|---|---|
| SUPABASE_URL | Loyihangizning https://PROJECT.supabase.co manzili |
| SUPABASE_SERVICE_ROLE_KEY | Supabase server service_role kaliti; anon key emas |
| PUBLIC_ORIGIN | Saytning aniq HTTPS origin'i, masalan https://zaruriyat.example; oxirida /siz |

Kalitni frontendga, git'ga yoki chatga yozmang. `.env` git tomonidan chiqarib tashlangan.
SUPABASE_ANON_KEY ushbu server versiyasida ishlatilmaydi.
Preview domeni uchun PUBLIC_ORIGIN'ni aynan o'sha deploy domeniga o'rnating.
So'rovlar serverda origin bo'yicha tekshiriladi.

## 3. Vercel

- Root Directory ' loyiha ildizi; `public` emas, chunki `api/` va `server/` ham kerak.
- Framework ' Other; Node.js 24; Output Directory ' public.
- `vercel.json` /api so'rovlarini api/index.js function'ga yo'naltiradi.
- Migratsiya tugagach muhit o'zgaruvchilari bilan deploy qiling.
- Service-role kalit yo'q bo'lsa, server 503 beradi; ochiq landing baribir ochiladi.

Rasmiy ma'lumot: https://vercel.com/docs/functions/runtimes/node-js

## 4. Mahalliy ishga tushirish

```powershell
Copy-Item .env.example .env
# .env ichida server kaliti va PUBLIC_ORIGIN=http://localhost:3000 ni sozlang
npm install
npm start
```

Brauzer: http://localhost:3000. Port o'zgarsa PUBLIC_ORIGIN ham o'zgarishi kerak.
`npm test` jonli bazaga ulanmaydi, vaqtinchalik PostgreSQL/PGlite ishlatadi.
Testlarda ro'yxatdan o'tish, sessiya, ruxsatlar, fayl, kuzatish, yakunlash,
baho, paket limiti va tranzaksiya qaytishi tekshiriladi.

## 5. Birinchi rahbar

Mavjud director hisobi migratsiyada saqlanadi. Yangi foydalanuvchi doim client.
Yangi bazada faqat administratorning ongli buyrug'i orqali rahbar yaratiladi:

```powershell
# .env: ADMIN_NAME, ADMIN_PHONE va kuchli ADMIN_PASSWORD vaqtincha belgilang
node --env-file=.env scripts/create-director.mjs
```

Bajarilgach ADMIN_PASSWORD'ni .env'dan olib tashlang. Dastur mavjud telefon hisobini
avtomatik ko'tarmaydi. Mavjud hisob rolini SQL Editor'da ID bo'yicha alohida boshqaring.
Xodim yoki hamkor hisobini rahbar kabinetidan yarating. Telefon majburiy.

## 6. Deploydan keyin tekshirish

Ro'yxatdan o'tish ' murojaat + PDF ' raqam/kod bilan kuzatish ' rahbar
koordinator/hamkor/xizmat biriktirishi ' barcha xizmatlar yakunlanishi ' mijoz bahosi.
Ikkinchi mijoz bilan birinchi mijoz tafsilotlari va fayllari ochilmasligini tekshiring.
Anon kalit bilan users/cases/attachments o'qish ham rad etilishi kerak.
Telegram bo'limi xabarlar navbatidir, yetkazilgan xabarlar deb talqin qilinmaydi.

## Amaldagi chegaralar

Jonli Supabase/PostgREST integratsiyasi deploymentdan keyin tekshirilishi shart.
OTP, Telegram yuborish va bloklash kodi tayyor, hozir o'chirilgan. Faollashtirishdan
oldin `migrations/002_accounts_notifications.sql` ni SQL Editor'da bajaring,
provayder rekvizitlarini serverga kiriting va `FEATURE_STAGE2=true` belgilang.
Telegram webhook uchun `scripts/configure-telegram.mjs` mavjud; avtomatik ishga tushmaydi.
To'lovlar provayder va tariflar kelishilguncha o'chirilgan. Antivirus hali yo'q.
Operatorlar uchun faqat faol shartnomali hamkor yangi xizmatga biriktiriladi.
Yakunlangan yoki bekor qilingan murojaat qayta ochilmaydi. Paket 1 yakunlangan keys = 1 birlik.
Fayllar 3 ta, jami 2.8 MiB. Katta fayllar uchun kelgusida private Storage kerak.

## 7. Zaxira va xizmat holati

`/api/health` GET/HEAD bazaga ulanishni tekshiradi, shaxsiy ma'lumot qaytarmaydi.
Vercel cron har kuni 01:00 UTC da `/api/jobs/backup` ni chaqiradi.
Endpoint `CRON_SECRET` Bearer kalitini talab qiladi; zaxira faqat yopiq
`zaruriyat-backups` bucketiga AES-256-GCM bilan yoziladi. Bir kun uchun bir nusxa.
`BACKUP_ENCRYPTION_KEY` 64 hex belgidan iborat bo'lishi va alohida saqlanishi kerak.
Kalitni almashtirish eski nusxalarni eski kalitsiz tiklashga imkon bermaydi.
Hozirgi limit 50 MiB. Bu ketma-ket jadval eksporti, yagona tranzaksiyadagi
PostgreSQL snapshot yoki PITR emas. Saqlash muddatini avtomatik qisqartirish hali yo'q.
Telegram yetkazish navbati qayta urinishni qo'llaydi; yuborish va tasdiqlash orasidagi
uzilish kamdan-kam takroriy xabarga sabab bo'lishi mumkin.
