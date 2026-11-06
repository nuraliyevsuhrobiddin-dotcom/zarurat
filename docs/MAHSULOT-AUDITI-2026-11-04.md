# ZARURIYAT mahsulot auditi — 2026-11-04

2026-11-05 holati: foydalanuvchi talabi bilan oldingi mobil ko‘rinish qaytarildi; UX-01, UX-02, UX-03 ning manba belgisi, UX-04 ning tasdiqlangan manzil/ish vaqti, UX-05 va UX-07 ning qidiruvi tuzatildi. [Tiklash va tekshiruv hisoboti](MOBIL-TIKLASH-2026-11-05.md). Quyidagi kuzatuvlar audit paytidagi tarixiy holatni tasvirlaydi. Tarif kartalari eski ko‘rinishda saqlandi; tuman modeli alohida backend bosqichi bo‘lib qoladi.

## Maqsad va chegaralar

Qarshi piloti oldidan qaysi elementlarni qisqartirish, nimalarni yaxshilash va qanday funksiyalarni qo‘shishni aniqlash. Bu mahsulot va qulaylik tahlili; yangi dizaynni joriy qilish vazifasi emas. Ilova kodi, tarif va aloqa konfiguratsiyasi hamda mahalliy sinov interfeysi asos qilib olindi. Jonli ma’lumotlar o‘zgartirilmaydi va to‘lov yuborilmaydi.

Oldingi 117 avtomatik test va 259 ekran tekshiruvi funksional asosni tekshirgan. Quyidagi ishlar foydalanuvchi qarori, mazmunning aniqligi va xizmatni amalda boshqarishga qaratilgan. Tavsiyalar haqiqiy foydalanuvchilar bilan pilotda tekshirilishi kerak; hozircha konversiya yoki mijoz xulqi bo‘yicha o‘lchangan natija yo‘q.

## Saqlash kerak bo‘lgan qismlar

- Ro‘yxatdan o‘tmasdan qisqa murojaat yuborish.
- Alohida sahifalar, bir xil Ortga harakati va rollarga mos pastki menyu.
- Murojaatning kuzatish raqami/maxfiy kaliti va ichki qaydlarning mijozdan ajratilishi.
- Mijoz, koordinator, hamkor va rahbar kabinetlarining ajratilishi.
- Shaxsiy ma’lumotni browser storage’ga yozmasdan xotirada qoralama saqlash.
- Lotin/kirill va yuborilgandan keyingi aniq tasdiq.

## Dastlabki topilmalar

P1 — pilot/ommaviy savdodan oldin; P2 — qulaylik uchun keyingi navbat; P3 — keyingi rivojlantirish.

| ID | Ustuvorlik | Kuzatuv | Taklif |
| --- | --- | --- | --- |
| UX-01 | P1 | Xizmat tafsilotidan murojaatga o‘tganda kategoriya hidden maydonda saqlanadi; foydalanuvchi tanlovini formada ko‘rmaydi. | «Tanlangan xizmat: …» va «O‘zgartirish»ni ko‘rsatish; kategoriya kontekstidagi qoralamani saqlash. |
| UX-02 | P1 | Checkout yakunida narx va a’zolar soni bor, lekin huquqiy/psixologik/tadbirkorlik maslahat limitlari qayta ko‘rsatilmagan; rozilik matni shu limitlarni tilga oladi. | To‘lovdan oldin aynan shu tarifning limitlari, bir oylik muddat va alohida xizmat haqi haqida ixcham xulosa berish. |
| UX-03 | P1 | Payme oylik abonementlari bilan qo‘lda belgilanadigan eski paketlar turlicha yuritiladi; qo‘lda paket yaratish standart holatda bir yil va 5 murojaat taklif qiladi. Ikkalasida ham STANDARD/COMFORT/PREMIUM nomlari ishlatiladi. | Ikkala tur foydalanuvchi va koordinatorga aniq ajratilsin; yangi sotuv uchun yagona model tanlansin. Eski yozuvlar o‘chirilmasin va sotilgan huquqlar o‘zboshimchalik bilan o‘zgartirilmasin. |
| UX-04 | P1 | Markaz manzili faqat «Qashqadaryo, Qarshi shahri»; ish vaqti va murojaatga javobning kutiladigan vaqti berilmagan. | Egasi tasdiqlagan aniq manzil, ish vaqti, qo‘ng‘iroq va xarita havolasi; javob vaqti amaldagi jamoa imkoniyatiga mos belgilanadi. |
| UX-05 | P2 | Bosh sahifadagi kuzatish tugmasi kirgan mijozni ham raqam+maxfiy kalit formasiga olib boradi. | Kirgan mijozga avval «Murojaatlarim», mehmon uchun raqam+kalit usulini saqlash. |
| UX-06 | P2 | Uch tarif kartasida bir xil xizmatlarning uzun ro‘yxati takrorlanadi. | Umumiy imkoniyatlarni bir marta, narx/a’zo soni/maslahat farqlarini ixcham taqqoslashda ko‘rsatish; batafsil shartlarni ochiladigan qismda saqlash. |
| UX-07 | P2 | Katalog ehtiyojlar va auditoriyalarni aralashtiradi: huquqiy yordam, hujjatlar, ayollar, bolalar, keksalar mazmunan kesishadi. | ID va tarixni saqlab, vazifa bo‘yicha kirish yo‘llari va misollar («aliment», «kadastr», «qarovchi») qo‘shish; «qaysi xizmat kerakligini bilmayman» yo‘lini ko‘rinadigan qilish. |
| UX-08 | P2 | Bosh sahifada bir nechta umumiy shior va takroriy kuzatish/kirish havolalari bor; markaz kartasida bevosita telefon yo‘q. | Bir aniq foyda jumlasi, asosiy murojaat amali va 4–6 xizmatga urg‘u; markaz blokini telefon/ish vaqti kabi foydali ma’lumot bilan almashtirish. Takrorlar pilot o‘lchovi bilan qisqartirilsin. |
| UX-09 | P2, kengayishdan oldin | Hamkor yaratish formasida butun O‘zbekiston viloyatlari bor; Qarshi shahri, Qarshi tumani va boshqa Qashqadaryo tumanlari alohida tanlanmaydi. | Hudud uchun barqaror ID, faol qamrov va mas’ul jamoa modeli; Qarshi shahri va Qarshi tumanini ajratish. Tarixiy viloyat qiymatlari saqlansin. |

Jami: 9 ta mahsulot/UX topilmasi — 4 ta P1 va 5 ta P2. Bularning ayrimlari ko‘rinadigan mazmun kamchiligi, ayrimlari esa yaxshilash gipotezasi; ro‘yxatni 9 ta ishlamaydigan funksiya deb talqin qilish kerak emas.

## Muhim farqlar va aniq dalillar

### UX-01 — tanlangan xizmat ko‘rinmaydi

Takrorlash: `#service?category=legal` → murojaat tugmasi → `#request?category=legal`. Formada ism, telefon, bayon va rozilik ko‘rinadi; xizmat nomi ko‘rsatilmagan. `category=legal` hidden maydonda mavjud — kategoriya yo‘qolmagan, foydalanuvchiga ko‘rsatilmayapti.

Dalil: [Huquqiy xizmatdan ochilgan forma](../.cache/qarshi-product-audit-2026-11-04/guest-request-legal.png).

Qabul mezoni: tegishli xizmat nomi ko‘rinsin, uni o‘zgartirish yo‘li bo‘lsin; qisqa forma va qoralama buzilmasin.

### UX-02 — rozilikdan oldin oylik limitlar ko‘rinmaydi

Takrorlash: sinov mijozida `#checkout?package=COMFORT`. 199 000 so‘m/oy, 5 nafargacha a’zo va alohida mutaxassis haqi haqidagi matn bor. Huquqiy, psixologik va tadbirkorlik maslahatlari soni ko‘rsatilmagan, ammo checkbox «oylik limitlar»ga rozilikni so‘raydi.

Dalil: [Checkout](../.cache/qarshi-product-audit-2026-11-04/client-checkout.png).

Qabul mezoni: COMFORT uchun amaldagi tarif manbasidagi 2 huquqiy, 1 psixologik va 1 tadbirkorlik maslahati xulosada ko‘rsatiladi; boshqa tariflar ham o‘z manbasidan olinadi. Amaldagi «har oy alohida to‘lanadi» va alohida mutaxassis haqi izohi saqlanadi.

### UX-03 — bir xil nomdagi ikki xil paket modeli

Takrorlash: mijozda `#cabinet/packages`; rahbarda `#cabinet/package-new`. Sinovga avvaldan qo‘lda berilgan COMFORT 5 murojaat va 04.11.2027 gacha muddat bilan chiqadi. Yangi qo‘lda paket formasining boshlang‘ich qiymati ham 5 murojaat va bir yillik muddat. Ommaviy COMFORT esa oylik, maslahat turlari bo‘yicha limitli mahsulot.

Dalillar: [Mijoz paketi](../.cache/qarshi-product-audit-2026-11-04/client-packages.png), [qo‘lda paket yaratish](../.cache/qarshi-product-audit-2026-11-04/director-package-new.png).

Bu sinov ma’lumotlari; jonli mijozlarning huquqlari noto‘g‘ri deb xulosa qilinmadi. Xavf — ikki modelning bir xil nom ostida tushuntirilmasligi.

Qabul mezoni: «Oylik abonement» va «Qo‘lda berilgan paket» manbasi aniq ko‘rsatiladi; qolgan maslahat/murojaat birligi va muddat bir ma’noli bo‘ladi. Egasi yagona yangi sotuv qoidalarini tasdiqlaydi. Mavjud paketlar alohida moslashtirish rejasiz o‘zgartirilmaydi.

### UX-04 — amaliy aloqa ma’lumotlari kam

Menyuda telefon va shahar bor, lekin aniq ko‘cha/manzil va markazning ish vaqti yo‘q. Bosh sahifaning o‘zida `tel:` havolasi soni 0; qo‘ng‘iroq qilish menyu yoki xizmat tafsilotida mavjud.

Dalillar: [Menyu](../.cache/qarshi-product-audit-2026-11-04/guest-menu.png), [bosh sahifa](../.cache/qarshi-product-audit-2026-11-04/guest-home.png).

Qabul mezoni: tasdiqlangan telefon, aniq manzil, ish vaqti va xarita; murojaatdan keyingi kutiladigan vaqt egasi bilan belgilanadi. «15 daqiqada javob» yoki «24/7» kabi tasdiqlanmagan va’da qo‘shilmaydi. Dastlabki formaga majburiy maydonlarni ko‘paytirish shart emas.

### UX-05 — kirgan mijozga maxfiy kalitdan boshlash noqulay

Takrorlash: sinov mijozida bosh sahifa → kuzatish. Sahifada hali ham bo‘sh raqam va kalit maydonlari chiqadi; hisobga bog‘langan murojaatlar mavjud.

Dalil: [Kirgan mijozning kuzatish sahifasi](../.cache/qarshi-product-audit-2026-11-04/client-track.png).

Qabul mezoni: kirgan mijozga «Murojaatlarim» asosiy amal bo‘ladi. Mehmon murojaatini yoki boshqa kalitli murojaatni kuzatish uchun raqam+kalit usuli ikkilamchi yo‘l sifatida qoladi. Telefon raqamini bilishning o‘zi bilan begona murojaat ochilmaydi.

### UX-06 — uzun tarif kartalari

390×844 px da paketlar sahifasi 3136 px, taxminan 3.7 ekran. Bu o‘z-o‘zidan xato emas, ammo umumiy xizmatlar uch marta takrorlanib, farqlarni solishtirishni qiyinlashtiradi. Alohida mutaxassis haqi haqidagi umumiy izoh kartalardan keyin joylashgan.

Dalil: [Tariflar](../.cache/qarshi-product-audit-2026-11-04/guest-family.png), to‘liq matn va o‘lchovlar — quyidagi `screens.json`.

Taklif: uchta ixcham tarif xulosasi + umumiy imkoniyatlar + ochiladigan batafsil shartlar. «Cheksiz» aynan koordinatorga murojaat/yo‘naltirishga tegishli ekanini narx yonida tushuntirish. Mavjud xizmat shartlari yo‘qotilmasin.

### UX-07 va UX-08 — axborot tuzilmasini soddalashtirish

Katalog 1983 px uzunlikda; qidiruv yo‘q. «Ayollar uchun yordam»dagi oilaviy/huquqiy masalalar huquqiy maslahat bilan, hujjatlar boshqa yo‘nalishlar bilan kesishadi. Qaysi bo‘limni tanlash qiyinligi hali real mijozlarda o‘lchanmagan.

Dalillar: [Katalog](../.cache/qarshi-product-audit-2026-11-04/guest-services.png), [bosh sahifa](../.cache/qarshi-product-audit-2026-11-04/guest-home.png).

Taklif: oddiy qidiruv va vazifa misollari; 14 kategoriya IDsi hamda tarix saqlanadi. Bosh sahifadagi shiorlar qisqartirilib, foyda va keyingi amal aniqroq aytiladi. Pastki menyu va mazmun ichidagi foydali takroriy havolalar barchasi birdan olib tashlanmaydi.

### UX-09 — viloyat tanlash tumanlar qamrovini boshqarmaydi

Takrorlash: rahbar → hamkor qo‘shish → Hudud. 14 ta viloyat/shahar darajasidagi variant bor. Qarshi shahar/tuman variantlari yo‘q.

Dalil: [Hamkor qo‘shish formasi](../.cache/qarshi-product-audit-2026-11-04/director-partner-new.png).

Bu Qashqadaryo bo‘yicha kengayishdan oldingi arxitektura ishi; dropdown nomlarini shunchaki tumanlarga almashtirish bazadagi mavjud qiymatlar bilan moslikni buzishi mumkin.

## Qo‘shiladigan funksiyalar uchun tartib

1. Tanlangan xizmat ko‘rsatkichi va checkout shartlari xulosasi.
2. Kirgan mijozning shaxsiy murojaatlariga tez yo‘l.
3. Tasdiqlangan aloqa/ish vaqti va yuborilgandan keyingi keyingi qadam.
4. Qisqa tarif taqqoslash va xizmat qidiruvi/misollar.
5. Qarshi shahri va boshqa tumanlarni alohida boshqarish: faol qamrov, mas’ul jamoa va xizmat mavjudligi. Amaldagi viloyat qiymatlarini tuman deb ishlatmaslik.
6. Pilot o‘lchovlari: murojaatni boshlash/yuborish, tashlab ketish, birinchi javob va yakunlash vaqti. Analitikaga ism, telefon, izoh yoki kuzatish kaliti yuborilmasin.

Hozircha AI-chat, ochiq reytingli marketplace, murakkab bonuslar yoki tasdiqlanmagan hamkorlar vitrinasini qo‘shish tavsiya qilinmaydi. Avval asosiy xizmat yo‘li va haqiqiy operatsion jarayon tekshirilsin. «Shaxsiy kurator», «ustuvor navbat» va «hamkor imtiyozlari» kabi tarif va’dalari egasi va jamoa tomonidan amalda ta’minlanishi tasdiqlansin; buning mavjudligi faqat UI matnidan aniqlanmaydi.

## Eng yaqin ish paketi

1. **Kichik interfeys tuzatishlari:** tanlangan xizmat ko‘rsatkichi, checkout limitlari, mijoz uchun «Murojaatlarim» yo‘li.
2. **Egasi bilan aniqlashtirish:** paketlarning yagona sotuv qoidasi, markaz manzili/ish vaqti va kutiladigan javob vaqti. Bu ma’lumotlar taxminan to‘ldirilmaydi.
3. **Soddalashtirish:** tariflarni ixcham taqqoslash, katalog qidiruvi va vazifa misollari, bosh sahifada amaliy aloqa.
4. **Kengayish:** hudud modeli va jamoalar; keyin tumanlarni birma-bir faollashtirish.

Avval interfeysni boshqatdan buzib qayta qurish talab qilinmaydi. Tekshirilgan navigatsiya, qisqa murojaat va rollar saqlanib, yuqoridagi o‘zgarishlar kichik bosqichlarda qilinadi.

## Dalillar

Yangi tekshiruv 390×844 px da mehmon, mijoz va rahbar uchun 16 ta ekran holatini qamradi. Barcha kuzatilgan ekranlarda gorizontal chiqish 0 bo‘ldi. Koordinator/hamkor rollari bo‘yicha mazkur safar yangi amaliy sinov bajarilmadi; ular oldingi funksional tekshiruvda qamralgan.

Muhit: `http://127.0.0.1:3102`, alohida PGlite, Payme yo‘li faqat sinov konfiguratsiyasi bilan ochildi. Xarid yoki to‘lov yuborilmadi. Sinovdagi hisoblar va paket qiymatlari ishlab chiqarish bazasi haqida dalil emas.

To‘liq brauzer matnlari, fieldlar va o‘lchovlar: [screens.json](../.cache/qarshi-product-audit-2026-11-04/screens.json). Skrinshotlar shu katalogda. Dalillar `.cache` ichida va Git/tarqatishga kirmaydi.

Ilova fayllari va jonli baza bu auditda o‘zgartirilmadi. Qo‘shimcha avtomatik test yozish yoki avvalgi suite’ni qayta ishga tushirish talab qilinmadi: kod o‘zgarishi bajarilmadi.
