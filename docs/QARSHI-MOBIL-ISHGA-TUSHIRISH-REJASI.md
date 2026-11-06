# ZARURIYAT: Qarshi piloti va yangi mobil interfeys rejasi

Reja tuzilgan sana: 2026-11-03. Yangilanish: 2026-11-04 — yangi mobil dizayn mahalliy ilovaga joriy qilindi va tekshirildi; jonli nashr hali bajarilmagan.

2026-11-05: foydalanuvchi talabiga ko‘ra avvalgi mobil vizual ko‘rinish tiklandi, qoralamalar va mustaqil sahifalar saqlandi, auditdagi asosiy qulaylik muammolari tuzatildi. [Amaldagi tiklash hisoboti](MOBIL-TIKLASH-2026-11-05.md).

## Maqsad

Avval Qarshi shahrida mijoz → murojaat → koordinator → hamkor → natija → baho jarayonini to‘liq ishlatish. Keyinchalik Qashqadaryoning boshqa shahar va tumanlarini birma-bir faollashtirish. Mobil interfeys telefon uchun qayta loyihalanadi: har bir bo‘lim o‘z sahifasiga ega bo‘ladi.

Hozirgi ishchi talqin: mobil brauzerda ilovadek ishlaydigan veb interfeys. Android/iOS uchun alohida dastur, APK yoki do‘konda nashr qilish alohida talab sifatida aniqlashtiriladi.

## Boshlang‘ich tekshiruvda aniqlangan holat

- Frontend: statik HTML/CSS/JavaScript. Asosiy boshqaruv `public/app.js`; mobil uslublar `public/mobile-app.css` ichida.
- Server: Node.js, `/api`, Supabase PostgreSQL; mahalliy server va Vercel konfiguratsiyasi mavjud.
- Mijoz, koordinator, hamkor va rahbar kabinetlari, to‘lov hamda Telegram uchun kod mavjud. Bu ularning jonli muhitda sozlanganini tasdiqlamaydi.
- `#services`, `#request`, `#cabinet/case?id=...` kabi manzillar bor. Ayrim mobil sahifalar mavjud dialoglarni to‘liq ekranga aylantirish orqali chiqariladi. Yangi yechimda sahifalar mustaqil ekran sifatida boshqariladi.
- Manifest bor. Uning mavjudligi barcha qurilmalarda o‘rnatish va offline ishlash tayyor degani emas.
- Bazada `region` matn maydoni bor. Tumanlar bo‘yicha faoliyat, mas’ul xodim va qamrovni boshqarish uchun alohida hudud modeli zarurati tekshiriladi.
- Ishchi nusxada avvalgi o‘zgarishlar mavjud, jumladan autentifikatsiya va to‘lov qaytishi. Ular yangi ish bilan aralashtirilmasligi kerak.
- Eski hujjatlardagi funksiyalar holati bir-biridan farq qiladi. Jonli tayyorlik amaldagi kod va tekshiruv natijasi bilan belgilanadi.
- Boshlang‘ich tekshiruv: 2026-11-03 kuni `npm test` — 107 ta test o‘tdi, xato 0. Bu jonli muhit yoki yangi dizayn tekshiruvi emas.

## 1. Boshlang‘ich holat va xavfsiz ish muhiti

1. Mavjud diff va yangi fayllarni inventarizatsiya qilish; foydalanuvchining tugallanmagan ishini saqlash.
2. Dastlabki test natijasini qayd qilish. Mavjud nosozlik bilan yangi o‘zgarish sababli chiqqan nosozlikni ajratish.
3. Mobil o‘zgarishlarni alohida ish tarmog‘ida tayyorlash; amaldagi holatga qaytish nuqtasini saqlash.
4. Brauzer sinovlari uchun `npm run qa` dagi alohida PGlite bazasidan foydalanish.
5. Jonli baza o‘zgarishidan oldin zaxira va tiklash tartibini tekshirish. `.env` qiymatlarini hujjat, skrinshot va loglarga chiqarmaslik.

Natija: qayta tiklanadigan boshlang‘ich holat, test hisoblari va tekshiruv dalillari.

## 2. Mobil sahifalar xaritasi va dizayn

Yo‘nalish: mavjud brendga mos to‘q ko‘k, oq va ko‘k aksent; o‘qilishi oson matnlar, katta bosish maydonlari, bir xil kartochka va formalar. Bosh ekran qisqa bo‘ladi: hudud, asosiy xizmatlar, murojaat yuborish va jarayonni kuzatish.

### Ochiq sahifalar

| Sahifa | Vazifasi |
| --- | --- |
| Bosh sahifa | Qarshi qamrovi, asosiy xizmatlar, yangi murojaat |
| Xizmatlar | Yo‘nalishlar va kerakli xizmatni tanlash |
| Xizmat tafsiloti | Xizmat izohi, shartlari va murojaatga o‘tish |
| Yangi murojaat | Qisqa forma → yuborish → alohida tasdiq sahifasi |
| Kuzatish | Raqam va maxfiy kalit bilan murojaat holati |
| Paketlar | STANDARD, COMFORT, PREMIUM shartlari va xaridga o‘tish |
| To‘lov | Tarif tasdig‘i, provayderga o‘tish va qaytgandagi aniq natija |
| Qanday ishlaydi | Koordinator bilan ishlash jarayoni |
| Kirish, ro‘yxatdan o‘tish, tiklash | Har biri alohida ekran |
| Menyu | Aloqa, savollar, maxfiylik va hisobga o‘tish |

Mijozning pastki menyusi: Bosh sahifa, Xizmatlar, Murojaat, Kuzatish, Kabinet. Boshqa rollar uchun ish vazifasiga mos menyu beriladi.

### Kabinet sahifalari

- Mijoz: murojaatlar ro‘yxati, murojaat tafsiloti va tarixi, paket, bildirishnomalar, profil va xavfsizlik.
- Koordinator: ish ro‘yxati, filtrlar, murojaatni aniqlashtirish, mas’ul hamkor va xizmatlarni biriktirish, muddat va yakunlash.
- Hamkor: o‘ziga biriktirilgan ishlar, ish tafsiloti va ruxsat etilgan holat o‘zgarishlari.
- Rahbar: umumiy holat, murojaatlar, mijozlar, hamkorlar, jamoa, paketlar va hudud qamrovi.

Har bir sahifa uchun yuklanish, bo‘sh ro‘yxat, xato, ruxsat yo‘qligi va muvaffaqiyat holatlari loyihalanadi. Avval bosh sahifa, xizmat tafsiloti, murojaat formasi va kabinet ro‘yxatining namunalari tayyorlanadi; keyin shu tizim qolgan ekranlarga qo‘llanadi.

## 3. Navigatsiyani tartibga keltirish

1. Sahifa manzillari va ularni ochish qoidalarini yagona joyda boshqarish; eski havolalar uchun moslikni saqlash.
2. Mobil formalar va tafsilotlarni dialogga bog‘liq bo‘lmagan sahifa komponentlariga ajratish. Tasdiq talab qiladigan qisqa amallar dialog bo‘lib qolishi mumkin.
3. Har bir ekranda o‘z sarlavhasi, kerakli joyda Ortga tugmasi va faol menyu holati bo‘lishi.
4. To‘g‘ridan-to‘g‘ri havola, sahifani yangilash, brauzerning Ortga/Oldinga tugmalari va kirishdan keyingi qaytishni tekshirish.
5. Murojaat qoralamasi va ro‘yxat filtrlari navigatsiyada saqlanishi; boshqa foydalanuvchiga tegishli ma’lumot qolib ketmasligi.
6. Birinchi bosqichda mavjud hash manzillarini saqlash mumkin: alohida mobil ekran uchun brauzerning yangi tabini ochish talab qilinmaydi.

Natija: bo‘limni bosganda tegishli mustaqil sahifa ochiladi; tagidagi uzun landing sahifa mobil ish jarayoniga aralashmaydi.

## 4. Qarshi va keyingi hududlar

1. Faol xizmat hududi dastlab Qarshi shahri sifatida ko‘rsatiladi.
2. Hali xizmat ko‘rsatilmaydigan hududda xizmat mavjudligi va’da qilinmaydi. Kengayishga qiziqishni yig‘ish kerak bo‘lsa, alohida forma va rozilik belgilanadi.
3. Hudud modeli: barqaror ID, nom, faol holat, xizmat qamrovi va mas’ul jamoa. Qarshi shahri va Qarshi tumani alohida hudud sifatida yuritiladi.
4. Hudud qamrovi serverda tekshiriladi; faqat interfeysdagi cheklovga tayanilmaydi.
5. Mavjud `region` qiymatlari inventarizatsiya qilinadi. Yangi maydonlar qo‘shish va tekshirilgan moslashtirish bilan tarix saqlanadi; noaniq yozuvlar taxminan boshqa tumanga ko‘chirilmaydi.
6. Xodimning qaysi hududlarni ko‘rishi biznes qoidasi sifatida belgilanadi; mavjud koordinator ruxsatlari tasodifan toraytirilmaydi.
7. Keyingi tuman faqat hamkorlar, koordinator, aloqa va ish tartibi tayyor bo‘lganda faollashtiriladi.

## 5. To‘liq ish jarayoni va ishga tushirish tayyorligi

- Mijoz murojaat yuboradi, tasdiq va kuzatish ma’lumotlarini oladi.
- Koordinator murojaatni ko‘radi, hudud va yo‘nalishni aniqlaydi, xizmat va hamkorni biriktiradi.
- Hamkor faqat ruxsat berilgan ishlarni ko‘radi va bajarish holatini yangilaydi.
- Yakunlash qoidalari, paket sarfi va mijoz bahosi tekshiriladi.
- Payme uchun amaldagi sozlamalar, sinov muhiti, takroriy so‘rovlar, qaytish va bekor qilish tekshiriladi. Haqiqiy pul yechish alohida nazoratli sinov bo‘ladi.
- Telegram funksiyalarining yoqilgan holati, migratsiyalari, webhook va yetkazish jarayoni tekshiriladi.
- Domen/origin, server kalitlari mavjudligi, sessiyalar, zaxira va tiklash, foydalanuvchiga ko‘rinadigan aloqa ma’lumotlari tekshiriladi.
- Ish vaqti, xizmat shartlari, tariflar, mas’ul operator va murojaatga javob berish tartibi egasi bilan yakunlanadi; ular taxminan kiritilmaydi.

## 6. Qabul qilish mezonlari

- Har bir menyu va amal to‘g‘ri sahifani ochadi; o‘lik tugma va noto‘g‘ri qaytish yo‘q.
- 320, 390, 430, 768 va 820 px mobil/planshet; 821 va 1280 px kompyuter ko‘rinishlari tekshiriladi.
- Gorizontal chiqish, klaviatura ortida qolgan yuborish tugmasi, ustma-ust menyu va kesilgan matn yo‘q.
- Asosiy bosish maydonlari kamida 44 px; formalar uchun aniq label, xato va fokus holati bor.
- Lotin va kirill, uzun matn, sekin tarmoq, bo‘sh ro‘yxat, server xatosi va tugagan sessiya tekshiriladi.
- Barcha to‘rt rolda tegishli ish jarayoni bajariladi; begona murojaat va faylga kirish rad qilinadi.
- To‘lov qaytishi va autentifikatsiya bo‘yicha mavjud o‘zgarishlar bilan moslik saqlanadi.
- Avtomatik sinovlar va ajratilgan bazadagi brauzer tekshiruvlari o‘tadi. Haqiqiy Android va iPhone qurilmalaridagi tekshiruv alohida qayd qilinadi.
- Natijalar skrinshot va qisqa tekshiruv hisobotida jamlanadi.

## 7. Joriy qilish ketma-ketligi

Boshlang‘ich tekshiruv → mobil dizayn namunalari → sahifa navigatsiyasi → ochiq ekranlar → mijoz kabineti → koordinator/hamkor/rahbar kabinetlari → hudud modeli → integratsiya sinovlari → alohida preview → Qarshi piloti → kuzatuv va tuzatishlar → navbatdagi tuman.

Jonli nashrdan oldin aynan chiqariladigan natija, tekshiruvlar va qaytarish usuli ko‘rsatiladi. Har bosqich ishlaydigan holatda yakunlanadi; saytni butunlay almashtirish uchun barcha o‘zgarishlarni birdan chiqarish talab qilinmaydi.

## Keyingi aniq ish

2026-11-04: mobil interfeys amaldagi ilovaga ulandi; ochiq sahifalar, to‘rt rol kabinetlari, mustaqil mobil formalar va xotiradagi qoralamalar tayyor. 117 avtomatik test, 259 brauzer holati va 18 amaliy tekshiruv o‘tdi. Dizayn bahosi PASS. Jonli nashr va hudud modeli hali bajarilmagan.

Natija, ko‘rinishlar, ko‘rish manzili va ishga tushirish chegaralari: [mobil yangilanish hisoboti](MOBIL-YANGILANISH-2026-11-04.md).
