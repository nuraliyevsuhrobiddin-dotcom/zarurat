# Telegram orqali parolni tiklash

SMS provayder talab qilinmaydi. Bot mavjud Vercel Function orqali ishlaydi.

## Ro'yxatdan o'tish

Yangi hisob yaratishda Telegram bot orqali telefon tasdig'i talab qilinmaydi. Ism, telefon, parol va rozilik bilan saytda bevosita ro'yxatdan o'tish mumkin. FEATURE_TELEGRAM_REGISTRATION eski sozlama bo'lib, endi hisob yaratish oqimiga ta'sir qilmaydi. Telegram hisob sozlamalaridan keyinroq ulanadi; parolni tiklash uchun alohida ishlatiladi.

## Parolni tiklashni sozlash

1. BotFather bot tokenini faqat serverning `TELEGRAM_BOT_TOKEN` sozlamasiga kiriting.
2. Supabase SQL Editor orqali `migrations/002_accounts_notifications.sql`, so‘ng
   `migrations/006_telegram_recovery.sql` ni bajaring. Mavjud 002 migratsiyasi
   o‘rnatilgan bo‘lsa, faqat 006 kerak.
3. Production sozlamalari: `FEATURE_TELEGRAM=true`, `TELEGRAM_BOT_TOKEN`,
   kriptografik tasodifiy `TELEGRAM_WEBHOOK_SECRET` (masalan 32 bayt hex),
   `PUBLIC_ORIGIN=https://zarurat-inky.vercel.app`.
4. Yangi kodni productionga joylang. Shu production sozlamalari bilan
   `node --env-file=.env scripts/configure-telegram.mjs` ni bajaring.
   Lokal `.env` dagi PUBLIC_ORIGIN ham HTTPS production manzil bo‘lishi kerak.
   Skript migratsiyalar, bot va mavjud webhook manzilini tekshiradi.
   Boshqa saytga ulangan bot webhookini avtomatik almashtirmaydi.
5. Hisobingizga kiring → Hisob sozlamalari → Telegramni bog‘lash → botda Start.
   Kabinetga qaytib Telegram holatini yangilang; «Bog‘langan» chiqishi kerak.
6. Hisobdan chiqing → Parolni unutdingizmi → login yoki telefon → kod so‘rash.
   Botdan kelgan 6 raqamli kod va yangi parolni kiriting. Yangi parol bilan kiring.

Kod 10 daqiqa amal qiladi, bir marta ishlaydi, 5 xato urinishdan keyin bloklanadi.
Hisob bo‘yicha kodlar orasida kamida bir daqiqa bor, API ham IP/login bo‘yicha
urinishlarni cheklaydi. Javoblar hisob yoki Telegram bog‘lanishi mavjudligini
oshkor qilmaydi. Parol almashtirilsa, hisob bloklansa yoki Telegram uzilsa, eski
kod yaroqsiz bo‘ladi. Tiklash barcha eski sessiyalarni tugatadi; telefonni SMS
bilan tasdiqlangan deb belgilamaydi.

Telegramni oldindan bog‘lamagan foydalanuvchiga bot orqali parol tiklab bo‘lmaydi.
Botda oddiy Start bosish yoki Telegram username kiritish hisobni bog‘lamaydi.
Bot tokeni, tasdiqlash kodlari va webhook secretni frontend, Git yoki hisobotga
yozmang. Tekshiruvlar: `npm test`, `npm run check:ready`.

Parol tiklash kodi bevosita yuboriladi; navbat croniga bog‘liq emas.
Murojaat holati haqidagi Telegram xabarnomalari alohida `/api/jobs/notifications`
navbati orqali ishlaydi va ushbu tiklash sozlamasi uning davriy ishga tushishini
o‘zi ta’minlamaydi.
