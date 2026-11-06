# Mobil interfeys yangilanishi — 2026-11-04

2026-11-05 yangilanishi: foydalanuvchi talabiga ko‘ra ushbu yangi vizual dizayn avvalgi ko‘rinishga qaytarildi. Amaldagi tiklash va audit tuzatishlari: [eski mobil ko‘rinishni tiklash](MOBIL-TIKLASH-2026-11-05.md). Quyidagi matn 2026-11-04 dagi ishlar tarixidir.

## Natija

ZARURIYAT uchun Qarshida boshlanadigan xizmatlarga mos mobil veb interfeys joriy qilindi. Bosh sahifa qisqartirildi: hudud, koordinatorga murojaat, xizmatlar va kuzatish. Har bir asosiy bo‘lim o‘z manzilida alohida ekran sifatida ochiladi.

Mobil formalar endi `main` ichidagi sahifada ishlaydi. Kompyuterda mavjud dialoglar ishlashda davom etadi. Eski havolalar, API, xizmat IDlari va rol ruxsatlari saqlangan.

- Ochiq sahifalar: bosh sahifa, 14 yo‘nalishli katalog, xizmat tafsiloti, murojaat, kuzatish, paketlar, qanday ishlaydi, savollar, menyu, kirish, ro‘yxatdan o‘tish, tiklash va maxfiylik.
- Mijoz, koordinator, hamkor va rahbar kabinetlari uchun bir xil mobil vizual tizim va vazifaga mos menyular.
- Alohida sarlavha, Ortga tugmasi, faol bo‘lim belgisi va bitta pastki navigatsiya.
- Murojaat qoralamasi boshqa bo‘limdan qaytganda hamda ekran o‘lchami/alifbo almashganda tiklanadi. Ma’lumot faqat sahifa xotirasida; hisob almashganda va muvaffaqiyatli yuborilganda tegishli qoralama tozalanadi.
- Xato sahifalarida navigatsiya va qayta urinish saqlanadi.
- Qarshi xizmat qamrovi sifatida ko‘rsatiladi. Bazadagi mavjud `Qashqadaryo` qiymati va tarix o‘zgartirilmadi.

## Tekshiruv natijalari

| Tekshiruv | Natija |
| --- | --- |
| `npm test` | 117/117 o‘tdi |
| Brauzer ekranlar matritsasi | 259 holat, ochiq muammo 0 |
| Amaliy brauzer jarayonlari | 18/18 o‘tdi |
| Mustaqil dizayn tekshiruvi | Ikkinchi baho: PASS, ochiq muammo yo‘q |
| Kirish sahifasi avtomatik accessibility tekshiruvi | 42 tekshiruv o‘tdi; buzilish 0, yakunlanmagan 0 |
| Sintaksis va `git diff --check` | O‘tdi |
| `npm run check:ready` | Skriptdagi barcha majburiy tekshiruvlar o‘tdi |

Matritsa 320, 390, 430, 768, 820, 821 va 1280 px ekranlarni qamradi. Barcha to‘rt rol tekshirildi. Mobil holatlarda gorizontal chiqish, ochiq dialog yoki takroriy pastki menyu topilmadi. Kompyuter dialoglari uchun o‘lchov ularning orqasidagi inert sahifani yuklanayotgan ekran deb hisoblamaslikka tuzatildi va tegishli 16 holat qayta tekshirildi.

Amaliy jarayonlar: barcha 14 kategoriya tugmasidan mos tafsilotga o‘tish; murojaatga kategoriya biriktirish; qoralama bilan boshqa bo‘limga o‘tib Ortga qaytish; 390 → 821 → 390 px o‘zgarish; murojaat yuborish va tasdiq; maxfiy kalit bilan kuzatish; yuborilgandan keyin qoralama tozalanishi; to‘g‘ridan-to‘g‘ri havola va yangilash; kirill; kirishdan keyin tanlangan checkoutga qaytish; noto‘g‘ri tahrirlash manzilida xato va navigatsiya; koordinator/rahbar murojaatni saqlashi; xodimning shaxsiy ma’lumotlarini mijoz formasiga ko‘chirmaslik.

Barcha yozuvchi brauzer sinovlari `scripts/qa-server.mjs` dagi ajratilgan PGlite bazasida bajarildi. Jonli bazaga sinov murojaatlari yozilmadi.

## Ko‘rish

Mahalliy sinov manzili: http://127.0.0.1:3101/#home

Server yopilgan bo‘lsa, loyiha ildizida `npm run qa` buyrug‘ini bajaring. U `.env` ni yuklamaydi.

Quyidagi hisoblar faqat shu sinov serverida mavjud. Hammasining paroli: `qa-password-2026`.

| Rol | Sinov logini |
| --- | --- |
| Mijoz | `qa-client` |
| Koordinator | `qa-operator` |
| Hamkor | `qa-partner` |
| Rahbar | `qa-director` |

Ko‘rinishlar:

- [Mobil bosh sahifa](../.cache/qarshi-mobile-d2xi4yo3.jpr/screenshots/home-390.png)
- [Yakuniy xizmatlar katalogi](../.cache/qarshi-mobile-d2xi4yo3.jpr/screenshots/services-final-390.png)
- [Murojaat formasi](../.cache/qarshi-mobile-d2xi4yo3.jpr/screenshots/request-390.png)
- [Yakuniy kirish sahifasi](../.cache/qarshi-mobile-d2xi4yo3.jpr/screenshots/login-final-390.png)
- [Kompyuterdagi bosh sahifa](../.cache/qarshi-mobile-d2xi4yo3.jpr/screenshots/home-1280.png)

Mahalliy dalillar `.cache/qarshi-mobile-d2xi4yo3.jpr/` ichida; bu katalog Git va tarqatishga kirmaydi. Asosiy natijalar `browser-matrix.json` va `workflow-results.json` da.

## O‘zgargan manbalar

- `public/app.js`, `public/index.html` — sahifalar, forma hayot sikli va yangi aktivlarni ulash.
- `public/presentation.js` — mobil sahifa va kompyuter dialogi uchun umumiy boshqaruv.
- `public/mobile-screens.js`, `public/mobile-experience.css` — mobil ekranlar va uslublar.
- `public/request-drafts.js` — foydalanuvchi va murojaat konteksti bo‘yicha xotiradagi qoralamalar.
- `tests/presentation.test.mjs`, `tests/request-drafts.test.mjs` — 10 ta qo‘shimcha regressiya sinovi.

Avvalgi autentifikatsiya/to‘lov modullari (`auth-navigation.js`, `payment-return.js`, `payments.js`), API adapteri va rol moduli boshlang‘ich nusxaga SHA-256 orqali solishtirilib, o‘zgarmagani tekshirildi. Server va SQL bu mobil yangilanish doirasida o‘zgartirilmadi.

## Jonli ishga tushirish holati

Yangi mobil versiya hali jonli saytga joylashtirilmagan. Tayyorlik skripti baza ulanishi, ko‘rsatilgan migratsiyalar, anonim kirish cheklovlari va zaxira konfiguratsiyasini tasdiqladi. Telegram sozlangan, SMS o‘chirilgan. Payme **test rejimida**.

Bu tekshiruvlar haqiqiy to‘lov, real Telegram yetkazilishi, zaxiradan tiklash mashqi yoki haqiqiy iPhone/Android qurilmasidagi sinov o‘rnini bosmaydi. Jismoniy telefonning klaviaturasi va tizimdagi o‘rnatish xatti-harakati hali tekshirilmagan.

Keyingi joriy qilish ishlari: yakuniy versiyaning preview nashri, jonli muhit parametrlarini tekshirish, qaytarish nuqtasi bilan Qarshi piloti. Tumanlarni faollashtirish uchun alohida hudud modeli va mas’ul jamoalarni sozlash [asosiy reja](QARSHI-MOBIL-ISHGA-TUSHIRISH-REJASI.md) bo‘yicha keyingi bosqichda bajariladi.
