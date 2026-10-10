# ZARURIYAT

Xizmatlarni koordinator orqali tashkil etish va murojaatni natijagacha kuzatish platformasi.

## Arxitektura

Brauzer ' bir xil domen /api ' Node.js server ' Supabase PostgreSQL.
Frontend statik HTML/CSS/JS; server Vercel Function yoki mahalliy Node.js.
Brauzer bazaga to'g'ridan-to'g'ri ulanmaydi. Service-role kalit faqat serverda.

- Parollar pgcrypto bcrypt bilan xeshlanadi; eski oddiy parollar migratsiyada xeshlanadi.
- 12 soatlik sessiya: HttpOnly, SameSite=Lax, HTTPS'da Secure cookie; bazada token xeshi.
- Mijoz faqat o'z murojaatini, hamkor o'z xizmatini ko'radi. Ichki qaydlar staff uchun.
- Ochiq kuzatish raqam va kriptografik maxfiy kod bilan; kod URL'ga yozilmaydi.
- SQL amallari murojaat, fayllar, tarix va xabar navbatini tranzaksiyada saqlaydi.
- Paketning muddati, mijozga tegishliligi va limiti bazada tekshiriladi.
- Ro'yxatdan o'tgan hisob doim client; rahbar avtomatik tayinlanmaydi.

## Ishga tushirish

Node.js 24 talab qilinadi. Yangi bazada `supabase-schema.sql`; mavjud bazada
`migrations/001_secure_server.sql` ni Supabase SQL Editor orqali bajaring.
So'ng `.env.example` asosida `.env` tayyorlang va `npm install`, `npm start`.
Statik `serve public` backend funksiyalarini ishlatmaydi.

To'liq ko'rsatma: [joylashtirish va migratsiya](docs/ISHGA-TUSHIRISH.md).
Tekshirish: `npm test` ' Node API va PostgreSQL/PGlite integratsion testlar.

## Chegaralar

Telegram/SMS adapterlari, OTP bilan tiklash va hisobni bloklash tayyor, lekin
`002_accounts_notifications.sql` hamda provayder sozlamalarisiz o'chirilgan.
O'z parolini o'zgartirish faol; to'lov integratsiyasi hali yo'q. Fayllar bazada base64,
3 ta va jami 2.8 MiB; haqiqiy MIME signaturasi tekshiriladi, antivirus emas.
Paket yangilash foydalanish tarixini saqlaydi; yangi billing davri avtomatik ochilmaydi.
Kabinet 50 tadan murojaat yuklaydi; qidiruv va filtrlar serverda barcha ruxsatli yozuvlarga qo'llanadi.
Maxfiylikdagi yakuniy biznes rekvizitlari, aloqa va saqlash muddati egasi tomonidan belgilanadi.

Kunlik zaxira AES-256-GCM bilan shifrlanib yopiq `zaruriyat-backups` bucketiga yoziladi.
Bu mantiqiy dastur zaxirasi; PostgreSQL PITR o'rnini bosmaydi. Tiklash uchun
`BACKUP_ENCRYPTION_KEY` alohida xavfsiz saqlanishi zarur. Eski nusxalar avtomatik o'chirilmaydi.
