# Telegram bot

Bot mijoz hisobiga bog‘langandan keyin murojaat yuborish va kuzatish imkonini beradi.
Rahbar va xodimlarning ish paneli sayt orqali ochiladi.

## Ishga tushirish

1. Supabase SQL Editor’da 006–009 migratsiyalar mavjudligini tekshiring, keyin
   `migrations/010_telegram_cases.sql` ni bajaring.
2. Server muhitida `FEATURE_TELEGRAM=true`, `FEATURE_TELEGRAM_CASES=true`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` va HTTPS `PUBLIC_ORIGIN` ni sozlang.
3. Yangilangan kodni deploy qiling.
4. Webhook va buyruqlar menyusini yangilang:
   `node --env-file-if-exists=.env scripts/configure-telegram.mjs`.
   Lokal `.env` ishlatilsa, `PUBLIC_ORIGIN` jonli HTTPS sayt manzili bo‘lsin.
5. `npm run check:ready` ni bajaring. Mijoz hisobiga kirib,
   Hisob sozlamalari → Telegramni bog‘lash orqali botni ulang.

## Imkoniyatlar

- `/start`, `/menu`: asosiy menyu.
- `/new`: yo‘nalish → vaziyat (10–3500 belgi) → ma’lumotlarni qayta ishlashga
  rozilik → yuborish. Ism va telefon bog‘langan hisobdan olinadi.
- `/cases`: so‘nggi 20 ta shaxsiy murojaatning raqami va holati.
- `/track ZAR-000001` yoki murojaat raqamini yuborish: joriy holat.
- `/rate ZAR-000001 5 Izoh`: yakunlangan murojaatni 1–5 ball bilan bir marta baholash.
- `/services`: xizmat yo‘nalishlari.
- `/contact`: yordam, kabinet va parolni tiklash havolalari.
- `/cancel`: yuborilmagan qoralamani bekor qilish.
- `/stop`: Telegram bog‘lanishini va faol qoralamani o‘chirish.

Murojaat holati saytda o‘zgartirilganda mavjud bildirishnoma navbati botga
xabar yuboradi. Yetkazish muvaffaqiyatsiz bo‘lsa, navbatdagi urinishni mavjud
bildirishnoma vazifasi bajaradi. Bot orqali yaratilgan murojaat saytdagi umumiy
murojaatlar ro‘yxatida ham ko‘rinadi.

## Chegaralar

Faqat o‘z hisobidagi murojaatlar ko‘rinadi; ichki izohlar va maxfiy kuzatish
kalitlari yuborilmaydi. Qoralama 30 daqiqa amal qiladi, soatiga 5 tagacha murojaat
yuboriladi. Takror yetkazilgan Telegram xabari yana murojaat yaratmaydi.
Rasm, ovoz va hujjatlar uchun sayt kabinetidan foydalaniladi. To‘lov hamda xodimlarning
murojaatni boshqarish amallari sayt orqali bajariladi.

Tekshirish: `node --test --test-isolation=none tests/telegram-cases.test.mjs`.
