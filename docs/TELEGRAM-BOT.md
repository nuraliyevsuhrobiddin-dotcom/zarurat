# Telegram bot

Bot orqali har kim saytdagidek murojaat qoldira oladi. Saytda ro‘yxatdan o‘tish shart emas:
mijoz bir marta «📱 Raqamni yuborish» tugmasini bosadi, Telegram raqamni o‘zi tasdiqlaydi.
Shu raqam bilan ZARURIYAT mijoz hisobi ochiladi yoki mavjud hisob ulanadi.
Rahbar va koordinatorlar ishni saytdagi kabinetda bajaradi.

## Ishga tushirish

1. Supabase SQL Editor’da 006–009 migratsiyalar mavjudligini tekshiring, keyin
   `010_telegram_cases.sql`, `015_telegram_request_access.sql` va
   `018_telegram_contact_account.sql` ni bajaring.
2. Server muhitida `FEATURE_TELEGRAM=true`, `FEATURE_TELEGRAM_CASES=true`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` va HTTPS `PUBLIC_ORIGIN` ni sozlang.
3. Yangilangan kodni deploy qiling.
4. Webhook va buyruqlar menyusini yangilang:
   `node --env-file-if-exists=.env scripts/configure-telegram.mjs`.
   Lokal `.env` ishlatilsa, `PUBLIC_ORIGIN` jonli HTTPS sayt manzili bo‘lsin.
5. `npm run check:ready` ni bajaring.
6. Botni **@zaruriyat_center_murojatlar** kanaliga **administrator** qilib qo‘shing
   (hech qanday huquq belgilash shart emas). Aks holda bot a’zolikni tekshira olmaydi;
   `configure-telegram.mjs` bu haqda ogohlantiradi.

## Kanalga majburiy a’zolik

Bot menyusi, murojaat yuborish, tariflar va aloqa bo‘limlaridan oldin foydalanuvchi
kanal a’zosi ekani tekshiriladi. A’zo bo‘lmasa, bot ikki tugma ko‘rsatadi:
«📢 Kanalga qo‘shilish» (kanal havolasi) va «✅ A’zo bo‘ldim» (qayta tekshirish).
Tekshiruv o‘tsa, asosiy menyu ochiladi; o‘tmasa, ogohlantirish chiqadi.

- Kanal `public/site-content.js` dagi `telegramChannel` da yoziladi.
  Server muhitidagi `TELEGRAM_REQUIRED_CHANNEL` uni almashtiradi; bo‘sh qiymat tekshiruvni o‘chiradi.
- Telegram javob bermasa yoki bot kanal admini bo‘lmasa, mijoz to‘xtab qolmasligi uchun
  bot ishlashda davom etadi va xato logga yoziladi.
- Parolni tiklash, hisobni ulash havolasi va `/stop` a’zolikni talab qilmaydi.

## Asosiy menyu

```
[📝 Murojaat yuborish]
[📋 Murojaatlarim | 🗂 Xizmatlar]
[💳 Tariflar      | ☎️ Aloqa]
```

## Murojaat yuborish tartibi

1. **📝 Murojaat yuborish.** Birinchi marta: «📱 Raqamni yuborish» (faqat o‘z kontakti,
   forward qilingan kontakt qabul qilinmaydi). Ism Telegram profilidan olinadi.
2. **① Yo‘nalish** — 14 ta yo‘nalish tugmalari (ikki ustunda).
3. **② Vaziyat** — bitta matnli xabar, kamida 10 belgi. Ovoz va rasm qabul qilinmaydi.
4. **③ Tasdiqlash** — yo‘nalish, matn, ism va telefon ko‘rsatiladi; «✅ Roziman, yuborish».
5. Murojaat raqami (ZAR-…) chiqadi. Koordinator qo‘ng‘iroq qiladi, holat o‘zgarsa bot xabar beradi.

Qoralama 30 daqiqa saqlanadi; «❌ Bekor qilish» yoki «🏠 Asosiy menyu» uni to‘xtatadi.
Birinchi murojaat bepul; keyingisi uchun faol obuna kerak (saytdagi qoida bilan bir xil).

## Raqamni tasdiqlash natijalari

- Raqam bo‘yicha hisob yo‘q — yangi mijoz hisobi ochiladi (parolsiz; saytga kirish uchun
  «Parolni tiklash» orqali parol o‘rnatiladi).
- Telegramga ulanmagan mijoz hisobi bor — shu Telegramga ulanadi.
- Raqam boshqa Telegramga ulangan, xodimga tegishli, bloklangan yoki +998 emas — ulanmaydi,
  mijozga sababi va markaz telefoni aytiladi.

## Boshqa buyruqlar

`/start` (asosiy menyu), `/new`, `/cases`, `/services`, `/tariffs`, `/contact`, `/cancel`,
`/stop` (Telegramni hisobdan uzish). Eski `/track ZAR-000001` va `/rate ZAR-000001 5 Izoh`
ham ishlaydi; yakunlangan murojaatni ⭐ 1–5 tugmalari bilan baholash mumkin.

## Chegaralar

Faqat o‘z hisobidagi murojaatlar ko‘rinadi; ichki izohlar va maxfiy kuzatish kalitlari
yuborilmaydi. Soatiga 5 tagacha murojaat. Takror yetkazilgan Telegram xabari yana murojaat
yaratmaydi. Hujjat va rasmlar uchun saytdagi kabinetdan foydalaniladi.

Tekshirish: `node --test --test-isolation=none tests/telegram-cases.test.mjs`.
