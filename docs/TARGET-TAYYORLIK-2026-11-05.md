# Targetdan oldingi tayyorlik auditi — 2026-11-05

## Qaror

Mobil asos foydalanishga qulay, ammo to‘liq reklama oqimini hozir boshlashga tayyorlik tasdiqlanmagan. Avval quyidagi ishga tushirish shartlari bajarilishi kerak. Keyin Qarshida hamkori tayyor xizmatlar bilan cheklangan reklama sinovi o‘tkazib, natijaga qarab kengaytirish mumkin.

Foydalanuvchi tasdiqlagan jarayon: **mijoz murojaat qoldiradi → koordinator ko‘rib chiqadi → mijoz bilan bog‘lanadi**. Reklama qilinadigan 2–3 xizmat hali belgilanmagan. Manzil: Qarshi shahri, Yoshlar texnoparki; ish vaqti: 24/7. Koordinatorning javob berish muddati va navbatchilik jadvali amalda tekshirilmagan, daqiqalarda kafolat berilmaydi.

## Asosiy topilmalar

| Daraja | Dalil | Kerakli ish va qabul mezoni |
| --- | --- | --- |
| Ishga tushirishdan oldin | Jonli kabinetda 5 hamkorning barchasi `pending`; faol shartnomali hamkor yo‘q. | Reklama qilinadigan har bir xizmat uchun haqiqiy hamkor, hudud, narxni kelishish tartibi va mavjudlik tasdiqlansin. Vakolatli xodim tegishli shartnomalarni tasdiqlasin; auditda holatlar o‘zgartirilmadi. |
| Ishga tushirishdan oldin | Jonli statistikada 17 ochiq murojaat, 17 muddati o‘tgan, yakunlangan 0. | Sinov yozuvlari haqiqiy murojaatlardan ajratilsin. Haqiqiy ishlarning mas’uli va keyingi qadami belgilansin. Bularning hammasi haqiqiy mijoz ishlari degan xulosa chiqarilmaydi; ommaviy o‘chirish/yopish bajarilmadi. |
| Ishga tushirishdan oldin | Jonli sayt mahalliy tiklangan versiyadan eski: `app.js`, `index.html`, `site-content.js` farq qiladi. Yangi yordamchi fayllar hali chiqmagan. | Sinovdan o‘tgan versiya chiqarilib, jonli saytda xizmat qidiruvi, tanlangan xizmat, tarif limitlari, Yoshlar texnoparki va 24/7 qayta tekshirilsin. Eski mobil dizayn saqlansin. Hozirgi eski sayt ishlaydi; yangi fayllarning yo‘qligi uning buzilganini anglatmaydi. |
| Ishga tushirishdan oldin | Jonli saytda 2 faol operator va 1 faol rahbar bor. Xabarlar namunasida 19 `queued`, 1 `sent`, 6 `recorded`. | Nazorat murojaati bilan koordinator kabinetiga kelishi, mas’ulga olinishi, mijozga qo‘ng‘iroq va natija qaydi tekshirilsin. Navbatdagi xabarlar yetkazilgani deb hisoblanmasin. |
| Reklama o‘lchovi | Manba kodida UTM saqlash, reklama analitikasi yoki muvaffaqiyatli murojaat hodisasi topilmadi. | Kamida manba, kanal va kampaniya saqlansin; muvaffaqiyat hodisasi server murojaatni qabul qilgandan keyin yozilsin. Bosish, qabul qilingan murojaat, birinchi aloqa va yakun natijasi ajratilsin. |
| Konversiya to‘sig‘i | Jonli auth sozlamalari: SMS o‘chiq, ro‘yxatdan o‘tishda Telegram talab qilinadi. | Telegram ishlatmaydigan mijoz uchun mehmon murojaati va telefon orqali aloqa yo‘li ko‘rinib tursin. Reklama yo‘li majburiy ro‘yxatdan o‘tishga olib bormasin; nazorat sinovida tasdiqlansin. |

`queued` soni Telegram buzilganini o‘zi isbotlamaydi: yuborish mexanizmi mijozning Telegram bog‘lanishi kabi shartlarga qaraydi. Mijozga xabar yuborilishi va koordinatorga yangi ish yetib borishi alohida tekshirilishi kerak. Ushbu auditda haqiqiy xabar yuborilmadi.

## Qulaylik va texnik holat

- Jonli `https://www.zaruriyat.uz` brauzerda 320, 390, 430 va 768 px kenglikda tekshirildi: bosh sahifa, xizmatlar, xizmat tafsiloti, murojaat, ro‘yxatdan o‘tish va checkout — jami 24 holat. Gorizontal chiqish va kuzatilgan JavaScript xatosi: 0.
- Asosiy harakat va telefon ko‘rinadi, original ko‘k-oq mobil dizayn saqlangan. Jonli murojaat formasi oddiy; mahalliy versiyadagi tanlangan xizmat ko‘rsatkichi va katalog qidiruvi hali unda yo‘q.
- Oldingi mahalliy tiklash tekshiruvlari 126/126 test va 120 ekran holatini qamragan; bu natijalar jonli versiya ham xuddi shunday degan kafolat emas. Tafsilot: [mobil tiklash hisoboti](MOBIL-TIKLASH-2026-11-05.md).
- Jonli health va ochiq auth/payment options javoblari muvaffaqiyatli. Payme jonli muhitda yoqilgan. Xavfsiz `CheckPerformTransaction` tekshiruvida ishchi kalit qabul qilindi, noto‘g‘ri/test kalit rad etildi. Haqiqiy kartadan pul yechish, checkoutdan to‘lovga borish va qaytish bu auditda bajarilmadi.
- Mahalliy `npm run check:ready` o‘tdi. Mahalliy Payme test rejimida, jonli Payme live rejimida — ularni aralashtirmaslik kerak. Backup sozlanganligi tiklash mashqi bajarilganini isbotlamaydi.
- `/api/config` ga bevosita so‘rovning 401 javobi ilova nuqsoni sifatida baholanmadi: frontend adapteri `/config` ni import qilingan konfiguratsiyadan qaytaradi.
- Android/iPhone qurilmalarida, reklama ichidagi brauzerda klaviatura, telefon kiritish va ortga qaytish amaliy sinovi hali bajarilmadi.

## Nima qo‘shish, nimani soddalashtirish kerak

1. Avval mavjud mahalliy tuzatishlarni chiqarish: xizmat qidiruvi, tanlangan xizmat, checkout izohi va to‘liq aloqa ma’lumotlari. Yangi vizual qayta dizayn kerak emas.
2. Reklama havolasidan to‘g‘ridan-to‘g‘ri tegishli xizmat va murojaatga o‘tish; xizmat tanlovi yuborilgunga qadar saqlanishini tekshirish. Birinchi murojaat uchun paket sotib olishni majburiy bosqich qilmaslik.
3. Koordinator uchun yangi murojaat → mas’ul → aloqa qilindi → kelishildi/yakunlandi jarayonini amalda sinash. Aloqa bo‘lmasa qayta ko‘rish mas’uli va navbatchilikni belgilash.
4. Kampaniya manbasini saqlash va muvaffaqiyatli murojaatni o‘lchash. Analitikaga ism, telefon va murojaat matnini uzatmaslik. Hozirgi xavfsizlik siyosatini shunchaki bo‘shatib uchinchi tomon skriptlarini qo‘shmaslik.
5. Barcha xizmatlarni birdan reklama qilish o‘rniga Qarshida hamkori va koordinatori tayyor yo‘nalishlardan boshlash. Tumanlarga kengayishni hudud bo‘yicha haqiqiy bajarish imkoniyatiga bog‘lash.

UTM uchun `utm_source`, `utm_medium`, `utm_campaign` ishlatilishi [Google Analytics rasmiy qo‘llanmasida](https://support.google.com/analytics/answer/10917952?hl=en) tushuntirilgan. `generate_lead` hodisasi murojaatni o‘lchashga mos [rasmiy tavsiya](https://support.google.com/analytics/answer/9267735/); bu aynan Google Analytics o‘rnatilishi shart degani emas. Foydalanuvchining reklama kabineti bu auditda tekshirilmadi.

## Reklamani kengaytirish uchun yakuniy shartlar

- [ ] 011 faol koordinator migratsiyasi qo‘llangan va readiness PASS; [SQL tekshiruvi](SQL-VA-YUKLAMA-TEKSHIRUVI-2026-11-05.md) dagi mahalliy tuzatishlar jonli muhitda tasdiqlangan.
- [ ] Tekshirilgan mobil versiya jonli saytda va aloqa ma’lumotlari to‘g‘ri.
- [ ] Reklama xizmatlari uchun tasdiqlangan faol hamkor va navbatchi koordinator bor.
- [ ] Eski/sinov murojaatlari ajratilgan, haqiqiy ochiq ishlarning mas’uli bor.
- [ ] Nazorat murojaati koordinatorga kelgan, mijozga bog‘lanilgan, natija qayd etilgan.
- [ ] Kampaniya manbasi va server tasdiqlagan murojaat natijasi o‘lchanadi.
- [ ] Android/iPhone va reklama ichidagi brauzerda asosiy yo‘l tekshirilgan.
- [ ] Agar reklama to‘lovga yo‘naltirsa, alohida ruxsat bilan haqiqiy to‘lov va qaytish yo‘li tekshirilgan.

Shundan keyin cheklangan sinov reklamasi: kelgan murojaat, aloqa va xizmat yakunini ko‘rib hajmni oshirish. Aniq budjet yoki natija kafolati bu auditda belgilanmadi.

## Dalillar va audit chegarasi

Mahalliy dalillar: `.cache/ad-launch-2026-11-05/production-check.json`, `live-ops.json`, `live-browser.json` va `live-*-390.png`. `.cache` fayllari vaqtinchalik bo‘lishi mumkin; asosiy xulosalar ushbu hujjatda saqlangan.

Jonli kabinet sonlari autentifikatsiyalangan, o‘qish uchun API so‘rovlaridan olindi; vaqtinchalik sessiya yakunda yopildi. Parollar, tokenlar va mijozlarning shaxsiy ma’lumotlari hisobotga kiritilmadi. Ilova kodi, shartnoma/murojaat holatlari, reklama va deployment o‘zgartirilmadi. Haqiqiy murojaat, to‘lov yoki tashqi xabar yaratilmagan. Audit sanasidan keyin jonli holat o‘zgarishi mumkin.
