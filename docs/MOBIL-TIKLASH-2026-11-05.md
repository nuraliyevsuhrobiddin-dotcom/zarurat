 FGB         # Eski mobil ko‘rinishni tiklash — 2026-11-05

## Talab va natija

Foydalanuvchi yangi mobil dizaynni avvalgi holatga qaytarish va auditdagi muammolarni eski dizayn ichida tuzatishni so‘radi.

Eski `mobile-app.css`, ko‘k-oq ranglar, bosh sahifa sarlavhasi, markaz kartasi, tezkor bo‘limlar va xizmat guruhlari qaytarildi. Ishlatilmagan `mobile-experience.css` va `mobile-screens.js` 2026-11-06 tozalashida olib tashlandi. Formaning mustaqil sahifasi va xotiradagi qoralama ishlashi saqlanadi; ularni eski ko‘rinishga moslashtirish `mobile-compat.css` orqali bajariladi.

## Muammo va yechimlar

| Muammo | Tuzatish |
| --- | --- |
| Tanlangan xizmat ko‘rinmasligi | Formada xizmat nomi va «O‘zgartirish» amali; ataylab xizmatni almashtirganda yozilgan ma’lumot bir marta yangi tanlovga o‘tkaziladi. |
| Checkoutda maslahat limitlari yo‘qligi | Tanlangan tarif manbasidan huquqiy, psixologik va tadbirkorlik limitlari; oylik muddat va tashqi mutaxassis haqi izohi. |
| Ikki xil paket hisobi chalkashligi | Oylik Payme abonementlari va qo‘lda belgilangan murojaat-limitli paketlar alohida belgilanadi. Mavjud huquqlar, limitlar va muddatlar o‘zgartirilmaydi. |
| Kirgan mijozdan ham kalit so‘ralishi | «Murojaatlarim»ga tez yo‘l; raqam+kalit orqali kuzatish ikkilamchi usul sifatida saqlanadi. |
| Katalogda xizmat topish qiyinligi | Lotin/kirill, xizmat nomi va «aliment», «kadastr», «usta» kabi kalit so‘zlar bilan qidiruv; tozalash va bo‘sh natija holati. |
| Aloqa ma’lumotlari kamligi | Foydalanuvchi tasdiqlagan manzil: **Qarshi shahri, Yoshlar texnoparki**. Ish vaqti: **24/7**. Mavjud telefon saqlanadi, xarita qidiruv havolasi qo‘shiladi. |

Javobning aniq necha daqiqada kelishi tasdiqlanmagan, shuning uchun bunday kafolat yozilmadi. Xarita havolasi joy nomini qidiradi; taxminiy koordinata qo‘yilmagan.

## Tekshiruv holati

Eski bosh sahifa saqlangan dastlabki skrinshot bilan solishtirildi. Tasdiqlangan manzil va ish vaqti qo‘shilgani sababli markaz kartasi balandroq; ranglar, sarlavha, kartalar va navigatsiya avvalgi uslubda.

| Tekshiruv | Natija |
| --- | --- |
| To‘liq `npm test` | 126/126 o‘tdi |
| Mahsulot/navigatsiya bo‘yicha alohida testlar | 21/21 o‘tdi |
| Brauzer matritsasi | 120 holat, muammo 0 |
| Takrorlanmagan amaliy brauzer tekshiruvlari | 15/15 o‘tdi |
| Mustaqil vizual va qulaylik bahosi | PASS; qo‘shimcha 34 holat, muammo 0 |
| Kirish sahifasi accessibility tekshiruvi | 41 tekshiruv o‘tdi, buzilish/yakunlanmagan 0 |
| Sintaksis va `git diff --check` | O‘tdi |

Matritsa 320, 390, 430, 768, 820, 821 va 1280 px ochiq sahifalarni; mijoz, koordinator, hamkor va rahbarning asosiy kabinetlarini 320, 390, 820 va 821 px da qamradi. Checkout ham barcha yetti kenglikda ochildi. Mobil ekranlarda bitta pastki navigatsiya, ochiq dialog yo‘qligi, gorizontal chiqish va xato holatlari tekshirildi.

Amaliy tekshiruvlarda eski stylesheet va tarkib, telefon/manzil/24/7, tanlangan xizmat, kalit so‘z bilan qidirish/bo‘sh natija/tozalash, xizmatni ataylab almashtirishdagi qoralama, 390→821→390 px o‘zgarish, murojaat yuborish va maxfiy kuzatish, mijozning shaxsiy murojaatlariga yo‘l, COMFORT limitlari va qo‘lda paket belgisi tekshirildi.

Mustaqil baholash eski bosh sahifa va xizmatlar ko‘rinishiga moslikni tasdiqladi. Mehmon, mijoz va rahbar holatlari 320–1440 px oralig‘ida ko‘rildi; 320 px da yuborish tugmasiga scroll orqali yetib borish va uni bosish ham tekshirildi. Tuzatish talab qiladigan ochiq muammo qolmadi.

Asl `styles.css`, `mobile-app.css`, autentifikatsiya/to‘lov modullari va API adapterlari saqlangan nusxaga SHA-256 orqali solishtirilib, o‘zgarmagani tekshirildi. Yangi mahsulot yordamchilari uchun 9 ta qo‘shimcha regressiya testi qo‘shildi. Mavjud navigatsiya testining VM muhitiga yangi tarjima yordamchisi kiritildi, tekshiruv shartlari saqlandi.

Ko‘rinishlar: [mobil bosh sahifa](../.cache/restore-mobile-qj0nju0z.1ym/screenshots/home-390.png), [murojaat formasi](../.cache/restore-mobile-qj0nju0z.1ym/screenshots/request-390.png), [checkout](../.cache/restore-mobile-qj0nju0z.1ym/screenshots/checkout-comfort-390.png), [kompyuter](../.cache/restore-mobile-qj0nju0z.1ym/screenshots/home-1280.png).

Mashina o‘qiydigan dalillar: `browser-matrix.json` va `checks.json` tiklash sessiyasi katalogida.

Mahalliy sinov manzili: http://127.0.0.1:3102/#home . Server yopilgan bo‘lsa, loyiha ildizida `npm run qa` orqali odatiy ajratilgan sinov serverini 3101 portda ochish mumkin. Testlar jonli bazaga yozilmaydi.

Dalillar va tiklashdan oldingi nusxa: `.cache/restore-mobile-qj0nju0z.1ym/`. Dastlabki eski ko‘rinish nusxasi `.cache/qarshi-mobile-d2xi4yo3.jpr/baseline/` da saqlanadi. `.cache` Git va tarqatishga kirmaydi.

## Chegaralar

Jonli saytga nashr yoki SQL migratsiya bajarilmadi. Tumanlar bo‘yicha alohida hudud modeli keyingi backend bosqichi bo‘lib qoladi; viloyat qiymatlari shunchaki tumanlarga almashtirilmagan. Mavjud tarif kartalari foydalanuvchining eski dizaynni qaytarish talabiga ko‘ra saqlandi. Sinovlar emulyatsiya qilingan brauzer ekranlarida bajarildi; haqiqiy telefon qurilmasida alohida tekshiruv hali bajarilmagan.
