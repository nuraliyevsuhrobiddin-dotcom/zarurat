# ZARURIYAT — ishga tushirishdan oldingi tekshiruv

Sana: 10.10.2026. Hudud: Qashqadaryo, Qarshi.

## Tuzatilgan kamchiliklar

- STANDARD / COMFORT / PREMIUM nomlari ochiq sahifa, kabinet va API da bir xil.
  Mavjud bazadagi eski paket qiymatlari va foydalanish tarixi saqlanadi.
- Tireli xodim loginlari to‘g‘ri ishlaydi. Telefon +998, 998 yoki 9 raqamli
  mahalliy ko‘rinishda kiritilganda bir xil formatga keltiriladi.
- Koordinator dastlabki murojaatdan keyin yo‘nalish, hudud va qulay vaqtni
  aniqlashtira oladi. Nazorat muddatini olib tashlash ham ishlaydi va tarixga yoziladi.
- Mijoz murojaatlari soni birinchi 50 ta yozuv bilan cheklanmaydi.
- Paketdan foydalanishda aynan shu mijozning yakunlangan murojaatlari olinadi,
  ilgari hisobga olinganlari tanlovdan chiqariladi va qolgan sahifalar yuklanadi.
- Oyna o‘lchami yoki alifbo o‘zgarganda forma qoralamasi, muvaffaqiyat kaliti
  va yuklangan kuzatish natijasi saqlanadi.
- Eskirgan sessiya qayta kirishga yo‘naltiradi. Oldingi hisobdan kechikib kelgan
  API javobi yangi hisobga ko‘rsatilmaydi.
- Escape va yopish tugmasi orqali yopilgan oynalar qayta ochiladi; menyu
  havolalari kerakli sahifaga olib boradi. FAQ mobil menyuga qo‘shildi.
- 821 px dagi menyu chiqib ketishi, planshetda markaz rasmi yo‘qolishi va
  kompyuterda birinchi ekran haddan tashqari cho‘zilishi tuzatildi.
- Markaz rasmi kesilmaydi, telefon qo‘ng‘iroq havolasi ishlaydi, mobil bosh
  sahifadagi takroriy bo‘limlar olib tashlandi.
- Holat ranglari, sarlavha darajalari, ARIA belgilari, klaviatura fokusi,
  kamaytirilgan animatsiya va JavaScriptsiz aloqa ko‘rinishi yaxshilandi.
- Noto‘g‘ri fayl ma’lumoti 500 o‘rniga 400 qaytaradi; mahalliy HTTP server
  bo‘laklangan UTF-8 matnini buzmaydi va statik fayllarga POST ni rad etadi.
- Serverga ulanish cho‘zilganda tushunarli xabar beriladi; ishlamayotgan
  murojaat xizmati haqidagi ogohlantirish sahifa almashganda yo‘qolmaydi.

## Tekshiruv dalillari

- `npm test`: **38/38** test muvaffaqiyatli.
- Brauzer: haqiqiy frontend va server, jonli bazadan ajratilgan vaqtinchalik
  PostgreSQL/PGlite. Rahbar, yangi xodim va mijoz jarayonlari tekshirildi.
- Rahbar kirishi → aniqlashtirish → hamkor va xizmat → yakunlash → paket
  yangilash → foydalanishni qayd etish jarayoni o‘tdi.
- Mijoz ro‘yxatdan o‘tishi, noto‘g‘ri telefon bilan qoralama saqlanishi,
  qisqa murojaat yuborish va kalit orqali kuzatish tekshirildi.
- 22 ta sahifa/formaga kirish tekshirildi. 320/390 px va 1280 px tekshiruvlarda
  sahifa xatosi, singan rasm yoki umumiy gorizontal chiqish topilmadi.
  820/821/1101 px chegaralarda markaz rasmi va menyu ham tekshirildi.
- Lotin va kirill ko‘rinishlari tekshirildi.
- Tanlangan formalar va murojaat tafsilotlarida axe accessibility tekshiruvi
  aniqlangan xatolar tuzatilgach 0 violation qaytardi. Bu to‘liq WCAG sertifikati
  emas; ayrim gradient va ekran chetidagi elementlar kontrasti avtomatik
  tekshiruvda qo‘lda baholash uchun belgilandi.
- Jonli bazaga faqat o‘qish orqali tekshiruv: ulanish ishlaydi,
  anonim `users`, `cases`, `attachments` kirishlari rad etilgan.

## Jonli ishga tushirish uchun qolgan amallar

1. Supabase SQL Editor da `migrations/003_intake_clarification.sql` ni bajaring.
   Jonli tekshiruv yangi funksiyalar hali mavjud emasligini ko‘rsatdi.
   Yozuvlar o‘chirilmaydi; migratsiya takroran bajarishga tekshirildi.
2. Yangilangan loyiha fayllarini birgalikda Vercelga joylashtiring.
3. `npm run check:ready` ni qayta ishga tushiring va jonli saytda yakuniy sinov qiling.

SMS va Telegram provayderlari hozir o‘chirilgan; telefon orqali koordinator
ishlaydigan asosiy jarayon ularsiz ishlaydi. To‘lov avtomatik olinmaydi.
Markazning aniq ko‘cha manzili va haqiqiy koordinator surati berilmagan;
ular `public/site-content.js` orqali keyin qo‘shiladi.

## Qayta tekshirish

```powershell
npm test
npm run check:ready
npm run qa
```

QA manzili: `http://127.0.0.1:3101`. Sinov bazasi server to‘xtaganda yo‘qoladi.
U jonli bazaga yozmaydi. Batafsil joylashtirish: `docs/ISHGA-TUSHIRISH.md`.
