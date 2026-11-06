# Murojaat va ro‘yxatdan o‘tishni qayta tekshirish — 2026-11-05

> 2026-11-06: Telegram talabi oldindan tushuntirilishi, ikki bosqichli forma, avtomatik status va bosqichni tiklash qo‘shilib jonli saytga chiqarildi. Quyidagi eski UX kamchiligi tuzatildi; joriy natija [yangi hisobotda](TELEGRAM-ROYXAT-YAXSHILASH-2026-11-06.md).

Jonli manzil: https://www.zaruriyat.uz/. Ushbu tekshiruvda jonli hisob/murojaat yaratilmadi va Telegram xabari yuborilmadi. Ilova kodi o‘zgartirilmadi.

## O‘tgan tekshiruvlar

- Murojaat, integratsiya, Telegram ro‘yxatdan o‘tish va qoralama bo‘yicha **33/33 test o‘tdi**. SQL mutatsiyalari izolyatsiyalangan PostgreSQL/PGlite bazasida bajarildi.
- Jonli `/api/health`, `/api/auth/me`, `/api/auth/options` — 200; backend configured=true.
- Jonli server roziliksiz murojaatni va ro‘yxatdan o‘tishni 400 bilan to‘g‘ri rad etdi. Xato ma’lumot yuborish hisob yoki murojaat yaratmadi.
- Jonli `#register` va `#request?category=legal` sahifalari 320/390 px da 4 holatda tekshirildi: gorizontal chiqish, loading yoki ko‘rinadigan xato 0. Majburiy maydonlar va rozilik mavjud.
- `.env` da sozlangan Telegram botining `getMe` javobi OK; webhook navbati 0, oxirgi xato yo‘q. Webhook `zarurat-inky.vercel.app/api/telegram/webhook` orqali ishlaydi. Vercel alias tekshiruvi ushbu hostname ham aynan `prj_zUX8jghSXE4nJzNCygLfCAcLHzFo` loyihasi va joriy `dpl_7rdQJQaoUgvYkCFHkT4DgAnKfMD4` reliziga qarashli ekanini tasdiqladi. Domen nomining www manzildan farq qilishi bu holatda webhook nuqsoni emas.

## Amaldagi shartlar va chegaralar

1. Mehmon murojaat uchun ro‘yxatdan o‘tishi shart emas: ism, telefon, vaziyat va rozilik kerak.
2. Jonli saytda **Telegram orqali telefonni tasdiqlash ro‘yxatdan o‘tishda majburiy**, SMS o‘chiq. Saytda yozilgan telefon Telegramdagi o‘z raqamiga mos bo‘lishi kerak. Botga kirib, o‘z kontaktini ulashgach, saytga qaytib «Kabinet yaratish» bosiladi. Havola muddati va noto‘g‘ri/begona kontakt holatlari testlarda tekshirildi.
3. Telegramsiz ro‘yxatdan o‘tish ushbu jonli sozlamada ishlamaydi — bu hozirgi talab. Murojaat yuborish esa bundan mustaqil.
4. Ro‘yxatdan o‘tish formasining dastlabki ko‘rinishida Telegram sharti alohida tushuntirilmagan; bosqich yuborishdan keyin ochiladi. Bu foydalanuvchini chalg‘itishi mumkin bo‘lgan qulaylik kamchiligi sifatida qoladi.
5. Jonli muhitda haqiqiy telefon/Telegram kontakti bilan ro‘yxatdan o‘tishni va yangi haqiqiy murojaat yuborishni oxirigacha bajarish ushbu auditga kirmadi. Bot javob berishi va testlar o‘tishi bunday yakuniy amaliy tasdiq o‘rnini bosmaydi.
6. Oldingi auditda aniqlangan bir IP uchun 15 daqiqada 10 murojaat limiti saqlangan.

Mahalliy brauzer dalili: `.cache/seo-release/intake-recheck.json`; test buyrug‘i: `node --test --test-isolation=none tests/api.test.mjs tests/integration.test.mjs tests/telegram-registration.test.mjs tests/request-drafts.test.mjs`.
