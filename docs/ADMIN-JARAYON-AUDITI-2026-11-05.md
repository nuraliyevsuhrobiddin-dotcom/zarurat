# Admin, koordinator va hamkor jarayonlari auditi — 2026-11-05

> Keyingi chuqur tekshiruvda bloklangan mas’ul nuqsoni mahalliy SQL/API/UI kodida tuzatildi va 132 test o‘tdi. Masofaviy bazaga 011 hali qo‘llanmagan. Quyidagi dastlabki audit tafsilotlari tarixiy; joriy natija [SQL va yuklama hisobotida](SQL-VA-YUKLAMA-TEKSHIRUVI-2026-11-05.md).

## Natija

Mahalliy joriy kodning asosiy ish jarayoni amaliy sinovdan o‘tdi: mehmon murojaati → koordinator qabul qilishi → faol hamkor biriktirish → hamkorning to‘rt bosqichi → koordinator murojaatni yakunlashi. «Barcha bo‘limlarda kamchilik yo‘q» deyish mumkin emas: bloklangan koordinatordan foydalanishga oid bitta qayta namoyish qilingan nuqson topildi.

Sinov `scripts/qa-server.mjs` orqali 3103 portda, alohida xotiradagi PGlite bazasida bajarildi. `.env` yuklanmadi, jonli bazaga yozilmadi, tashqi SMS/Telegram yuborilmadi. Natija jonli eski versiyaga avtomatik tatbiq etilmaydi. Jonli tayyorlik holati [alohida hisobotda](TARGET-TAYYORLIK-2026-11-05.md).

## Topilgan nuqson

**P2 — bloklangan koordinatorga yangi murojaat biriktirish mumkin.**

- Shart: hisoblarni bloklash funksiyasi (`FEATURE_STAGE2=true`) yoqilgan.
- Qayta namoyish: rahbar yangi operator yaratdi; uni o‘z paroli bilan blokladi; `/team` bloklangan operatorni ham qaytardi; `/cases/1` ga `coordinatorId` bilan PATCH so‘rovi 200 qaytardi va aynan bloklangan operatorni mas’ul qilib saqladi.
- Oqibat: tizimga kira olmaydigan xodimga yangi ish topshirilishi mumkin.
- Sabab: `server/api.mjs` dagi `/team` ro‘yxati bloklanganlarni chiqarib tashlamaydi; `supabase-schema.sql` dagi `zar_update_case` mas’ulning rolini tekshiradi, blok holatini tekshirmaydi. Frontend mas’ullar ro‘yxatini shu team ma’lumotidan tuzadi.
- Tavsiya: yangi biriktirishni server/baza darajasida rad etish va tanlovda faqat faol xodimlarni ko‘rsatish. Avvaldan biriktirilgan xodim keyin bloklansa, eski tarixni saqlab, ishni boshqa mas’ulga o‘tkazish imkoniyati qolishi kerak.
- Jonli muhitda bloklash funksiyasi holati va ushbu nuqsonning amaldagi ta’siri bu sinovda tasdiqlanmadi. Sinov uchun jonli xodim bloklanmadi.
- Dalil: `.cache/admin-audit-2026-11-05/blocked-probe.json`: `blockedCoordinatorIncludedInTeam=true`, `assignmentHttp=200`, `assignedToBlocked=true`.

Bu turn audit doirasida ilova kodi o‘zgartirilmadi; nuqson tuzatilgan deb belgilanmaydi.

## Amalda ishlagan jarayonlar

| Tekshiruv | Natija |
| --- | --- |
| Mehmon xizmat tanlab, ism/telefon/tavsif va rozilik bilan murojaat yuborishi | Qabul qilindi, koordinator ro‘yxatiga tushdi |
| «Mijoz bilan gaplashdim» tugmasi | Murojaat aniqlashtirish holatiga o‘tdi va koordinator o‘ziga oldi; haqiqiy qo‘ng‘iroq qilinmadi |
| Faol hamkorni yangi xizmatga biriktirish, narxni 0 belgilash | Saqlandi, hamkor kabinetida ko‘rindi |
| Hamkor bosqichlari | «Qabul qildim» → «Mijoz bilan bog‘landim» → «Xizmat ko‘rsatildi» → «Yakunlandi» ishladi |
| Koordinatorning murojaatni yakunlashi | Xizmat tugamaguncha tugma yopiq; xizmat tugagach murojaat yakunlandi |
| Yangi hamkor yaratish va tahrirlash | Nomi, tashkilot identifikatori va shartnoma holati saqlandi |
| Rahbarning tashkilotga bog‘langan hamkor hisobi yaratishi | Hisob yaratildi; alohida API kirishi va partnerId tekshirildi |
| Qo‘lda oila paketini saqlash | COMFORT, limit 7 va oila a’zolari bilan saqlandi |
| Rahbar bo‘limlari | Umumiy, murojaatlar, yakunlanganlar, hamkorlar, mijozlar, paketlar, jamoa, xabarlar, sozlamalar — 390 va 1280 px da 18 holat; yuklanish/xato/gorizontal chiqish 0 |

Qo‘ng‘iroq, xizmat bajarish va mijoz bilan kelishish sinov tugmalarining ma’nosi sifatida tekshirildi; haqiqiy jismoniy xizmat yoki aloqa bo‘lib o‘tmadi.

## Ruxsatlar va noto‘g‘ri harakatlardan himoya

Qo‘shimcha 18 API tasdig‘i o‘tdi. Bular brauzerda saqlangan natijani bazadan qayta o‘qishni ham qamraydi:

- Boshqa mijoz va boshqa tashkilot hamkori ushbu murojaatni o‘qiy olmaydi.
- Hamkor admin statistikasi/hamkorlar bazasiga kira olmaydi va koordinatorni o‘zgartira olmaydi.
- Mehmon yopiq murojaatlar ro‘yxatiga kira olmaydi.
- Operator yangi xodim yaratishi rad etiladi; bu rahbar vakolati.
- Xizmatsiz murojaatni yakunlash, sababsiz bekor qilish va yakunlangan murojaatni qayta ochish rad etiladi.
- Ichki sabab bilan bekor qilish ishlaydi.
- `pending` shartnomali hamkorni xizmatga biriktirish rad etiladi.

To‘liq `npm test`: **126/126 o‘tdi**. Mavjud testlar ichki qaydlar va maxfiy kalitlarni yashirish, fayl egasi, bosqichlarni sakrab o‘tishni rad etish, paket limitlari, parol/sessiyalar va xabar navbati kabi qo‘shimcha holatlarni qamraydi. 126 testning o‘tishi yuqorida topilgan bloklangan mas’ul nuqsonini yo‘qqa chiqarmaydi: uning alohida regressiya qamrovi hozir yo‘q.

## Ish tartibidagi cheklovlar

1. Hamkor xizmatni qabul qilgandan keyin uni shu xizmat ichida boshqa hamkorga bevosita almashtirish taqiqlangan. Hamkor bajara olmasa, koordinator eski xizmatni sababini ichki qaydda yozib bekor qilish va yangi xizmat biriktirish tartibidan foydalanishi kerak. Bu istisno yo‘l brauzerda ushbu auditda to‘liq bajarilmadi; alohida «boshqa hamkorga o‘tkazish» jarayoni kerakligi biznes tartibiga bog‘liq.
2. Viloyat mavjud, Qarshi va boshqa tumanlar uchun alohida tuzilgan hudud/filtr modeli hali yo‘q. Hozirgi manzil va izoh bo‘yicha ishlash keyingi hududiy kengayishga yetarli emas.
3. Mobil pastki navigatsiya ekran pastidagi tugma ustida turishi mumkin; foydalanuvchi scroll qilib tugmani yuqoriga chiqarishi mumkin va shunda harakat bajarildi. Brauzer avtomatizatsiyasida ham scroll talab qilindi; tugma ishlamaydi deb baholanmadi. Haqiqiy Android/iPhone klaviaturasi va reklama ichidagi brauzer tekshiruvi ochiq qoladi.
4. Jonli auditdagi 5 ta pending hamkor sababli real ishga kimni biriktirish masalasi hali ochiq. Test bazasidagi faol hamkor muvaffaqiyati real shartnomalar tayyorligini isbotlamaydi.
5. Kabinetga ish kelishi sinovdan o‘tdi, lekin haqiqiy koordinatorning navbatchiligi, tashqi xabarning yetib borishi va telefon orqali javobi tasdiqlanmadi.

## Dalillar

Vaqtinchalik mahalliy fayllar: `.cache/admin-flow1105.mjs`, `.cache/admin-audit-2026-11-05/api-check.mjs`, `api-results.json`, `admin-screens.json`, `blocked-probe.mjs`, `blocked-probe.json`. Barcha hisoblar va murojaatlar sun’iy QA ma’lumotlari. Auditda dizayn, jonli holatlar yoki production deployment o‘zgartirilmadi.
