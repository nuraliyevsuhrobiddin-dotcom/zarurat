# ZARURIYAT — Payme sozlash

Tariflar: STANDARD 99 000 so‘m/oy (4 nafargacha), COMFORT 199 000 so‘m/oy (5 nafargacha), PREMIUM 399 000 so‘m/oy (6 nafargacha). Summa serverda va SQL funksiyasida belgilanadi, Paymega tiyinlarda yuboriladi. Mijoz kartasi yoki karta kodi saytimizda saqlanmaydi: to‘lov Payme sahifasida bajariladi.

## 1. Baza

Mavjud bazada Supabase SQL Editor orqali [004_payme.sql](../migrations/004_payme.sql) ni bajaring. Oldingi 001 va 003 migratsiyalari o‘rnatilgan bo‘lishi kerak. Yangi baza uchun `supabase-schema.sql` va umumiy tiklash fayli `SUPABASE_TIKLASH.sql` Payme migratsiyasini ham o‘z ichiga oladi. Migratsiyani qayta bajarish mavjud to‘lovlarni o‘chirmaydi.

Yangi jadvallar `payment_orders`, `payme_transactions`, `family_subscriptions`, `subscription_usage`. Ularga brauzer, anon va authenticated rollari bevosita kira olmaydi; server service_role orqali ishlaydi.

## 2. Kalitlar va kassa

`.env` ichida bo‘sh maydonlar qoldirilgan. Haqiqiy qiymatlarni o‘zingiz kiriting:

```dotenv
FEATURE_PAYME=false
PAYME_MODE=test
PAYME_MERCHANT_ID=
PAYME_ACCOUNT_FIELD=order_id
PAYME_TEST_KEY=
PAYME_KEY=
```

`PUBLIC_ORIGIN` — saytingizning aniq manzili, oxirida `/` bo‘lmasin (masalan, `https://zaruriyat.uz`). Mahalliy testda `http://127.0.0.1:3000` mumkin; ishchi rejim HTTPS talab qiladi. Kalitlar Vercel ishlatsa uning server Environment Variables bo‘limiga ham kiritiladi. `.env` Gitga va saytning `public` papkasiga qo‘yilmaydi.

Payme Business kassasida **Merchant API** ni tanlang. Endpoint: `https://SIZNING-DOMEN/api/payme`. Account maydoni `order_id`, turi matn: qiymat buyurtmaning UUID raqami bo‘ladi. Boshqa nom berilgan bo‘lsa, `PAYME_ACCOUNT_FIELD` aynan shu nomga teng bo‘lsin. Test kaliti faqat test rejimida, ishchi kalit faqat live rejimida qabul qilinadi.

Merchant ID va test kaliti kiritilib, baza migratsiyasi bajarilgandan keyin `FEATURE_PAYME=true` qo‘ying. Mahalliy serverni qayta ishga tushiring; Vercelda environment o‘zgargach yangi deployment kerak.

## 3. Sinov

```powershell
npm test
npm run check:ready
```

Mijoz hisobidan tarifni tanlang, oila a’zolarini kiriting va shartlarni tasdiqlang. Payme test sahifasiga o‘tasiz. Test rejimi sahifada va kabinetda aniq belgilanadi; haqiqiy xizmatni yoqmaydi. `https://test.paycom.uz` orqali Merchant API tekshiruvlarini bajaring: CheckPerformTransaction → CreateTransaction → takroriy CreateTransaction → PerformTransaction → takroriy PerformTransaction → CheckTransaction → CancelTransaction. To‘lanmagan tranzaksiyani bekor qilish, noto‘g‘ri summa, 12 soatlik timeout va GetStatement ham tekshirilsin.

`SetFiscalData` kelganda to‘lov va qaytarish fiskal ma’lumotlari alohida saqlanadi. Fiskalizatsiya rekvizitlari va mahsulot tasnifi Payme kassasida xizmatga mos sozlanadi; kod biznes rekvizitlarini o‘zi taxmin qilib yaratmaydi.

## 4. Ishchi rejim

Payme testlari muvaffaqiyatli tugab, ishchi kalit kiritilgach:

```dotenv
FEATURE_PAYME=true
PAYME_MODE=live
```

Deployment/restart qiling. Endpoint va kassaning ishchi rejimini tekshiring. Saytdagi «Oila paketim» va xodimning «Oila paketlari» bo‘limlari to‘lov va abonement holatini bazadan oladi. Paymedan qaytish URL parametri hech qachon to‘lov tasdig‘i hisoblanmaydi; abonement faqat autentifikatsiyadan o‘tgan PerformTransaction so‘rovi bilan faollashadi. Holat kechiksa «Holatni yangilash» ni bosing.

Abonement tasdiqlangan paytdan **bir kalendar oy** amal qiladi. Faol abonement tugamasdan yangi abonement xaridi rad etiladi; avtomatik karta yechimi yo‘q. Har oy mijoz yangi to‘lov qiladi. Mavjud qo‘lda belgilangan murojaat paketlari alohida ishlashda davom etadi; ularning umumiy limiti oylik maslahat limitlariga aylantirilmaydi.

## 5. Maslahatlar va bekor qilish

Koordinator/rahbar «Oila paketlari» ichidagi faol ishchi abonementda «Maslahatni qayd etish» tugmasini bosadi va shu mijozning yakunlangan murojaatini tanlaydi. Huquqiy (shu jumladan hujjatlar), psixologik yoki tadbirkorlik maslahatining tegishli limiti tekshiriladi. Bir murojaat ikki marta hisoblanmaydi; test, muddati tugagan yoki bekor qilingan abonementdan foydalanish qayd etilmaydi. Qolgan maslahatlar mijoz va xodim kabinetida ko‘rinadi.

Payme CancelTransaction yuborganda foydalanilmagan abonement bekor qilinadi, to‘lov tarixida saqlanadi. Maslahatdan foydalanilgan bo‘lsa, `-31007` qaytariladi — bunday qaytarish markaz va Payme orqali alohida ko‘rib chiqiladi. Pul qaytarishni sayt tugmasi o‘zi boshlamaydi. To‘lov holatini, abonementni va maslahatni qayd etish bazada atomar bajariladi; takroriy Payme so‘rovi ikkinchi abonement yaratmaydi.

Zaxiralashga to‘lovlar, tranzaksiyalar, abonementlar va foydalanish hisobi ham kiritilgan. Zaxira hali ham jadvalma-jadval olinadigan shifrlangan nusxa; moliyaviy bazaning nuqtaviy tiklanishi uchun Supabase/PostgreSQL backup infratuzilmasidan foydalaniladi.

## Izolyatsiyalangan brauzer sinovi

Haqiqiy `.env` va ishlab turgan bazaga ulanmaydigan test serveri:

```powershell
$env:QA_PORT='3107'
$env:QA_PAYME='true'
npm run qa
```

`http://127.0.0.1:3107` da `qa-client / qa-password-2026` hisobidan to‘lov formasi tekshiriladi. Bu serverdagi merchant va kalitlar soxta, haqiqiy to‘lov uchun yaroqsiz. Backend testlari Payme so‘rovlarini shu izolyatsiyalangan PostgreSQL bilan mashq qiladi.

Rasmiy manbalar: [Merchant API](https://developer.help.paycom.uz/protokol-merchant-api/), [checkout URL](https://developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/), [CreateTransaction va timeout](https://developer.help.paycom.uz/metody-merchant-api/createtransaction/), [GetStatement](https://developer.help.paycom.uz/metody-merchant-api/getstatement/), [SetFiscalData](https://developer.help.paycom.uz/metody-merchant-api/setfiscaldata/).


## Sandbox account-state compatibility

For databases that already applied migration 004, apply `migrations/005_payme_sandbox_errors.sql`. It returns account error -31050 with data=order_id for unavailable orders and competing reservations, as expected by the Payme sandbox. Transaction state errors remain -31008.
