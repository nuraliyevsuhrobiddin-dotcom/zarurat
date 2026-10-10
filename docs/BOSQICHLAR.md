# 2026-10-10 holati

Production: https://zarurat-inky.vercel.app
Deploy: dpl_G1JzeXauCavYsyQMFj8DsFg4Zp5t, READY.

## Faol

- Server orqali xavfsiz kirish, rollar, xodimlar va xabarnomalar API.
- Parolni almashtirish va eski sessiyalarni bekor qilish.
- Server qidiruvi, filtrlar va sahifalash; mobil va kirill interfeys.
- Health GET/HEAD tekshiruvi.
- Shifrlangan yopiq kunlik Supabase zaxirasi, Vercel cron.

31 mahalliy test o'tdi. Jonli health 200, yopiq endpointlar anonimga 401,
maxfiy kalitli backup endpoint 200. 2026-10-10 zaxirasi yaxlitligi tekshirildi.
Egasi hisobiga kirish sinovi bajarilmadi: haqiqiy parol mavjud emas.

## Tayyor, o'chirilgan

SMS tasdiqlash/tiklash, Telegram ulash/yuborish va xodimlarni bloklash.
`002_accounts_notifications.sql` hali jonli bazaga qo'llanmagan.
FEATURE_STAGE2=false. Foydalanuvchi Telegram/SMS ulanishini hozircha saqlab,
o'chirilgan holda qoldirishni so'ragan. Provayder ma'lumotlarisiz xabar jo'natilmaydi.

## Biznes ma'lumotlari kerak

To'lov provayderi, tarif narxlari, davri va limitlari belgilanmagan.
To'lov va avtomatik pulli yangilash faol emas.
Zaxira saqlash muddati va alohida PostgreSQL PITR hali sozlanmagan.
