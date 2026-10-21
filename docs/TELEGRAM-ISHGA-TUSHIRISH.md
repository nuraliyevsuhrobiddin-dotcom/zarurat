# Telegram orqali parolni tiklash

SMS provayder talab qilinmaydi. Bot mavjud Vercel Function orqali ishlaydi.

## Ro‘yxatdan o‘tishda raqamni tasdiqlash

`migrations/007_telegram_registration.sql` va
`FEATURE_TELEGRAM_REGISTRATION=true` yangi mijozlar uchun majburiy tasdiqlashni
yoqadi. `FEATURE_TELEGRAM=true` ham kerak. Mavjud hisoblar o‘zgartirilmaydi.

Ro‘yxatdan o‘tish formasida ism, telefon, parol va rozilik kiritilgach,
Telegramda tasdiqlash havolasi chiqadi. Foydalanuvchi botda Start, so‘ng
«Telefon raqamimni ulashish» tugmasini bosadi. Saytga qaytib «Kabinet yaratish»
tugmasini yana bosadi. Hisob shundan keyingina yaratiladi.

Webhook faqat shaxsiy chatdagi yuboruvchining o‘z kontaktini qabul qiladi:
kontakt user_id, yuboruvchi IDsi va chat IDsi teng bo‘lishi, telefon esa formadagi
raqamga mos kelishi kerak. Forward qilingan kontaktlar qabul qilinmaydi.
Oddiy Start yoki telefon raqamini matn qilib yuborish tasdiqlash emas.

Havola 15 daqiqa amal qiladi va bir marta ishlaydi. Serverda havolaning faqat
xeshi saqlanadi. Parol tasdiqlash boshlanishida bazaga saqlanmaydi. Hisobni
yaratish va tasdiqlashni ishlatilgan deb belgilash bitta SQL tranzaksiyasida
bajariladi. Rol doim client; telefon tasdiqlangan, Telegram esa bog‘langan
bo‘ladi. `/stop` pending tasdiqlashni bekor qiladi. Bog‘langan bitta Telegram
orqali ikkinchi hisob ochilmaydi.

Telegramdagi raqami saytga kiritgan raqamidan farqli yoki Telegram hisobisiz
foydalanuvchi bu usulda ro‘yxatdan o‘ta olmaydi. Bunday foydalanuvchilar uchun
kelajakda alohida SMS tasdiqlash usuli kerak bo‘ladi.

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
