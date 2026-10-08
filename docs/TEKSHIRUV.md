# Loyiha tekshiruvi

2026-10-08 holatidagi tuzatishlar:

- Brauzerdagi Supabase adapteri server API bilan almashtirildi. Ochiq parol
  solishtirish, localStorage orqali rol tanlash va xatodan keyin boshqa bazaga
  yozishni takrorlash olib tashlandi. Sessiyalar HttpOnly cookie orqali ishlaydi.
- Vercel API so‘rovlarini `api/proxy.mjs` funksiyasiga yo‘naltiradi.
- Bo‘sh `supabase-schema.sql` qayta tiklandi; ochiq RLS siyosatlari va demo
  parollar berilmaydi. `supabase-fix.sql` eski bazaga kirishni yopish uchun
  tayyorlangan, masofadagi bazada bajarilmagan.
- Noma’lum API manzili aniq 404 qaytaradi. Buzilgan parol xeshi loginni
  server xatosiga olib kelmaydi.
- `npm run check` barcha loyiha JavaScript fayllari va JSON sozlamalarini
  tekshiradi.
- Lotin/kiril almashganda bosh sahifa qayta chiziladi; yangi xodim oynasida
  hamkorlar ro‘yxati yuklanadi. Login oynasiga yopish tugmasi va maydon
  yorliqlari qo‘shildi, buzilgan kirilcha matnlar tuzatildi.
- Mobil sahifada uzun yordam tugmasi va dekorativ fon gorizontal chiqib
  ketishi tuzatildi; login/ro‘yxatdan o‘tish oynasi kichik ekranda aylantiriladi.

## Vercel va eski Supabase hisoblari

Faol arxitektura: Node.js + SQLite; Vercel sayt va API proksi vazifasini bajaradi.
Vercel’da `API_ORIGIN`, VPS’da `PUBLIC_ORIGIN`, `DEMO_MODE=false` va
`SECURE_COOKIE=true` talab etiladi. Yangi production bazasi uchun `ADMIN_PHONE`
va kamida 14 belgili `ADMIN_PASSWORD` kerak.

Eski Supabase ma’lumotlari SQLite’ga avtomatik ko‘chirilmaydi. Eski bazani
saqlang; haqiqiy ma’lumotlar uchun alohida migratsiya kerak. Agar oldingi
ochiq SQL skriptlari bajarilgan bo‘lsa, Supabase SQL Editor’da yangi
`supabase-fix.sql`ni qo‘lda bajaring va eski ochiq parollarni almashtiring.
Bu skript ma’lumotlarni o‘chirmaydi, ilova jadvallaridagi brauzer ruxsatlarini yopadi.

Ishga tushirish va hosting: [server qo‘llanmasi](../deploy/SERVERGA-JOYLASH.md).
Vercel yo‘naltirish formati: [rasmiy hujjat](https://vercel.com/docs/project-configuration/vercel-json).

## Tekshirish chegaralari

`npm test`: 25 ta test, jumladan server ruxsatlari, yangi xodim hisoblari,
fayllar, paket limiti, sessiya, production bazasi, brauzer API adapteri va
Vercel yo‘naltirishi. `npm run check`: barcha JavaScript va JSON fayllari.
Mahalliy Chrome’da direktor login/logout, hamkorlar tanlovi, lotin/kiril
almashishi, 390 px mobil kenglik, murojaat yuborish va maxfiy kod bilan
kuzatish tekshirildi. Kontrast tekshiruvidagi aniqlangan rang xatosi tuzatildi;
gradientli qismlarda avtomatik kontrast tekshiruvi to‘liq xulosa bermaydi.

Mahalliy API va brauzer tekshiruvi haqiqiy hosting tekshiruvining o‘rnini bosmaydi.
Vercel/VPS va Supabase bazasida hech qanday masofaviy o‘zgartirish bajarilmadi.
SMS/OTP, Telegram yuborish va to‘lov integratsiyalari hozircha ulanmagan.

Mobil interfeys o‘zgarishlari ushbu commitdan chiqarilgan va mahalliy ishchi nusxada saqlangan.
