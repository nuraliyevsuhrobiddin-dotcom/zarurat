# SQL, bildirishnoma va mahalliy yuklama tekshiruvi — 2026-11-05

> 2026-11-06 qayta tekshiruv: `.env` bilan ulangan masofaviy bazada 011 ham PASS, umumiy readiness exit 0. Quyidagi «011 hali qo‘llanmagan» jumlalari dastlabki audit vaqtiga tegishli. Joriy ishga tayyorlik [yangi hisobotda](ISHGA-TAYYORLIK-2026-11-06.md).

## Tasdiqlangan natija

Joriy mahalliy versiyada murojaat → koordinator → hamkor → yakunlash zanjiri SQL bilan bajarildi. Barcha 11 migratsiya ketma-ket PGlite ichidagi PostgreSQL dvigatelida qo‘llandi. Bu SQLni oddiy JavaScript javoblari bilan taqlid qilish emas; ammo ishlab turgan Supabase/Vercel serverlarining yuklama yoki ko‘p ulanish sinovi ham emas.

Yakuniy `npm test`: **132/132 o‘tdi**, xato 0, o‘tkazib yuborilgan 0. Yangi testlar [sql-workflow.test.mjs](../tests/sql-workflow.test.mjs) va [workspace-roles.test.mjs](../tests/workspace-roles.test.mjs) ichida. Sintaksis va `git diff --check` o‘tdi.

## SQLda bajarilgan amallar

- Schema va 001–011 migratsiyalari bajarildi; 011 qayta qo‘llanganda mavjud murojaatlar va mas’ullar o‘chmadi/o‘zgarmadi.
- Murojaat yaratilganda yagona raqam, kuzatish kaliti, tarix va `request.created` xabari yozildi.
- Koordinator tayinlash, ichki qayd, xizmat qo‘shish va faol shartnomali hamkor biriktirish saqlandi.
- Pending shartnomali hamkorni tanlash va hamkorning bosqichlarni sakrab o‘tishi rad etildi.
- Hamkorning `accepted → contacted → delivered → completed` bosqichlari bajarildi; undan so‘ng koordinator murojaatni yakunladi.
- Bitta to‘liq jarayonda 8 ta tegishli xabar qaydi, ichki qayd va tarixning saqlanishi bazadan qayta tekshirildi.
- Oila paketidan foydalanish qayd etildi; ayni murojaatni qayta hisoblash rad etildi.
- Noto‘g‘ri ilova fayli kiritilganda murojaat, tarix va xabarlarning qisman yozilib qolmasligi tekshirildi: tranzaksiya ortga qaytdi.
- `anon` va `authenticated` rollarida boshqaruv RPC funksiyalarini bajarish ruxsati yo‘q; server `service_role` ruxsati saqlangan.

## Tuzatilgan nuqson

Oldingi auditda bloklangan koordinatorga yangi murojaat biriktirish mumkinligi aniqlangan edi. Endi:

1. SQL yangi tayinlashda xodimning faol holatini tekshiradi; bloklangan xodimga yangi ish berilmaydi. Tekshiruv paytida tanlangan xodim satri qulflanadi.
2. Bloklangan xodimning o‘zi SQL orqali murojaatni yangilay olmaydi.
3. `/team` faol mas’ullarni qaytaradi. Bu hisob funksiyalari to‘liq yoqilganda ham, faqat Telegram sozlangan holatda ham tekshirildi.
4. Oldingi mas’ul keyinchalik bloklansa, uning mavjud tayinlovi formadan yo‘qolmaydi: «Avval biriktirilgan» deb ko‘rinadi. Ichki qaydni saqlash uni bilmasdan olib tashlamaydi; rahbar boshqa faol mas’ulni tanlay oladi.

Real brauzer + alohida QA bazasi tasdig‘i: eski mas’ul 2 saqlandi, qayd yozildi, faol mas’ul 1 ga ko‘chirildi; keyingi bloklangan mas’ulga PATCH 400 qaytardi.

O‘zgargan asosiy fayllar: `supabase-schema.sql`, `migrations/011_active_coordinator_assignment.sql`, `server/api.mjs`, `public/workspace-roles.js`, `public/app.js`, `public/index.html`, `scripts/check-readiness.mjs`, `scripts/qa-server.mjs`. Dizayn o‘zgartirilmadi. App versiyasi 37, workspace yordamchisi versiyasi 2.

## Yangi murojaatning ovoz va belgi bilan kelishi

Izolyatsiyalangan QA serverida koordinator brauzeri ochildi. Boshqa HTTP so‘rovi bilan haqiqiy test murojaati yuborilib, SQLga yozildi. Ilovaning mavjud bildirishnoma mexanizmi quyidagilarni bajardi:

- Web Audio konteksti `running` holatida ikkita signal tovushini ishga tushirdi.
- «Xabarlar» yonida **1** belgisi va «Yangi xabar keldi» bildirishnomasi chiqdi.
- Xabarlar bo‘limida yaratilgan murojaat raqami ko‘rindi; bo‘lim ochilganda belgi tozalandi.

Tekshiruv native Web Audio chaqiruvlarini kuzatdi; jismoniy telefon karnayidan eshitilishi tekshirilmadi. Yangi murojaat sinovida taymer/fokus mexanizmi ishladi; hech qanday qo‘lda poll funksiyasi chaqirilmadi. Asosiy interval 15 soniya, oynaga fokus qaytganda ham tekshiradi. Birinchi eski xabarlar o‘qilishi signal bermaydi. Signal boshqa yangi jarayon xabarlarida ham chalinadi.

Sahifa yashirin bo‘lsa poll to‘xtaydi; sayt yopiq yoki telefon qulflangan paytda kafolatli push bildirishnoma bu mexanizmga kirmaydi. Brauzerda foydalanuvchi harakati va ovozning yoqilganligi zarur.

## Mahalliy yuklama natijasi

Bu tajriba faqat xotiradagi bazada bajarildi; jonli saytga yuklama yuborilmadi. 1 000 ta sun’iy murojaat o‘qish uchun oldindan kiritildi. HTTP handler va SQL ishlatildi; PostgreSQL REST qatlami uchun test adapteri ishlagani sababli natijalar Supabase/Vercel tezligi yoki quvvati sifatida talqin qilinmaydi.

| Ko‘rsatkich | Natija |
| --- | --- |
| O‘qish so‘rovlari | 80 ta, 10 ta parallel oqim |
| Yo‘llar | Murojaatlarning birinchi/ikkinchi sahifasi, statistika, xabarlar |
| Xatolar | 0 |
| Umumiy o‘qish vaqti | 4 580 ms |
| p50 / p95 / eng sekin | 538 / 753 / 755 ms |
| Har bir murojaatlar sahifasi | 50 ta, `hasMore=true` |
| Bir IPdan parallel yuborish | 12 ta |
| Yaratildi | 10 ta; raqamlar takrorlanmadi, 10 xabar yozildi |
| Himoya tomonidan rad etildi | 2 ta, HTTP 429 |

Hozirgi veb murojaat limiti **bir IP uchun 15 daqiqada 10 ta**. Bu butun sayt uchun umumiy limit emas. Umumiy Wi-Fi yoki bir IP orqali kelgan mijozlar bir hisoblagichga tushishi mumkin; reklama natijalarida 429 javoblarini kuzatish kerak. Limit bu ishda o‘zgartirilmadi.

Ushbu tajriba «bir vaqtda 1 000 mijozga tayyor» degani emas. Haqiqiy hosting, tarmoq, parallel bazaviy ulanishlar, cold start va shartnoma rejasining resurs chegaralari sinovdan o‘tmadi.

## Masofaviy baza tekshiruvi

`.env` da ko‘rsatilgan Supabase bazasiga faqat o‘qish tekshiruvlari bajarildi; kalit va mijoz ma’lumotlari chiqarilmadi. Uning aynan jonli sayt bilan bir xil baza ekanligi mustaqil loyiha identifikatori orqali tasdiqlanmadi.

- Statistika, intake clarification, to‘liq client counts va Payme readiness RPC javob berdi.
- Users, cases, services, partners, history, notifications, sessions, packages, package_usage, attachments, feedback, payment_orders, telegram_registrations va telegram_case_drafts — **14/14** tekshirilgan jadval/maydon so‘rovi o‘tdi.
- OpenAPI katalogida xodim/murojaat/xizmat/paket yaratish va xabar navbatining **10/10** tekshirilgan RPC yo‘li mavjud. Mavjudligi tasdiqlanishi ularning jonli mutatsiyalarini bajarish bilan teng emas; mutatsiyalar alohida QA bazasida bajarildi.
- `npm run check:ready` ning oldingi ulanish, 002/003/004/006 va anonim kirishni cheklash tekshiruvlari o‘tdi.
- **Yangi 011 tayyorlik tekshiruvi o‘tmadi:** masofaviy bazada `zar_assignment_ready()` yo‘q. Shu sababli umumiy readiness bu safar exit 1 qaytardi; bu yashirilgan yoki tasodifiy test xatosi emas.

## Jonli muhitda qolgan ish

011 migratsiya va mahalliy kod deploymenti **hali bajarilmadi**. Ushbu sessiyada Supabase SQL Editor yoki PostgreSQL ulanishi yo‘q; mavjud REST servis ulanishi SQL faylini bevosita bajarish vositasi emas.

Supabase loyihasining SQL Editor oynasida [011_active_coordinator_assignment.sql](../migrations/011_active_coordinator_assignment.sql) fayli mazmunini bajarish kerak. Oldingi migratsiyalari ishlayotgan bazaga yangi tuzatish sifatida aynan 011 qo‘llanadi.

So‘ng server rolida tekshiruv:

```sql
SELECT public.zar_assignment_ready();
-- Kutilgan natija: true
```

Lokal terminalda `npm run check:ready` qayta bajariladi: 011 uchun ham PASS bo‘lishi kerak. Keyin tekshirilgan frontend/backend versiyasi chiqarilib, jonli kabinetda faol xodim tanlovi, murojaat oqimi va koordinatorning haqiqiy qurilmasidagi ovoz qayta tekshiriladi. Jonli ko‘p foydalanuvchi sinovi bundan alohida qoladi.

## Mahalliy dalillar

`.cache/sql-audit-2026-11-05/remote.json`, `load.json`, `sound.json`, `coordinator-ui.json`; reproduksiya yordamchilari `.cache/sql-audit-2026-11-05/`, `.cache/sql-sound1105.mjs`, `.cache/sql-ui1105.mjs`. `.cache` vaqtinchalik; muhim sonlar shu hisobotda saqlangan, doimiy SQL regressiya testlari `tests/` ichida.
