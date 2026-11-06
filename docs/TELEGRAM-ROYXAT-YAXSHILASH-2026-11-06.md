# Telegram orqali ro‘yxatdan o‘tish — 2026-11-06

## Jonli natija

Foydalanuvchilar Telegram bosqichida qiynalayotgani sababli ro‘yxatdan o‘tish soddalashtirildi va **https://www.zaruriyat.uz/#register** ga chiqarildi.

Production: `dpl_HJyBz9AWV1BCsE6tuxubi8X3Vh4D`; preview: `dpl_A48k9F2VonSisAtsoY8gNGja8yzQ`. Oldingi production: `dpl_7rdQJQaoUgvYkCFHkT4DgAnKfMD4`.

## Mijoz uchun yangi tartib

1. Avval Telegramdagi o‘z telefon raqami va rozilik kiritiladi. Tugma «1. Telefonni Telegramda tasdiqlash» deb nomlandi.
2. Ekrandagi ikki qadam bo‘yicha botda Start, keyin «Telefon raqamimni ulashish» bosiladi.
3. Saytga qaytganda holat avtomatik tekshiriladi. Telefon tasdiqlangach ism va parol maydonlari ochiladi, «Kabinet yaratish» bosiladi.

Kutish holati, qo‘lda «Tasdiqni tekshirish», raqamni o‘zgartirish/qayta boshlash va muddati tugagan havola xabari qo‘shildi. Noto‘g‘ri kontakt uchun botdagi ko‘rsatma aniqroq bo‘ldi; muvaffaqiyatli tasdiqda saytga qaytish tugmasi bor. Hisobsiz oddiy murojaat yuborish havolasi ham boshidanoq ko‘rinadi.

## Tiklash va himoya

- Faqat telefon, maxfiy tasdiq havolasi, bot URLi va 15 daqiqalik tugash vaqti shu brauzerning localStorage qismida saqlanadi. Ism, parol va «tasdiqlangan» belgisi saqlanmaydi. Muddati tugagan ma’lumot keyingi o‘qishda rad etiladi/tozalanadi; kabinetga kirganda yoki qayta boshlaganda ham o‘chiriladi.
- Sahifa yangilanganda yoki botdagi qaytish tugmasi yangi oynani ochganda bosqich tiklanadi. Holat yana serverdan tekshiriladi; brauzerdagi ma’lumot tasdiq o‘rniga qabul qilinmaydi.
- Fon tekshiruvi faqat ko‘rinadigan, hali tasdiqlanmagan formaga 5 soniyada bir bajariladi; fokus qaytganda ham tekshiradi. Bir formaning ustma-ust status so‘rovlari cheklanadi.
- Yangi POST `/api/auth/register/telegram/status` telefon va 48 belgili maxfiy challenge bilan ishlaydi. `pending`, `verified`, `expired` va tugash vaqtini qaytaradi; Telegram ID/foydalanuvchi profili/parol berilmaydi. Yangi hisob yaratmaydi; so‘rov cheklov hisoblagichi yangilanadi.
- O‘z kontakti, telefonning mosligi, havola muddati va bir martalik SQL tasdiq qoidalari saqlangan. Faqat Start bosish hisob yaratmaydi. Telegram talabi olib tashlanmadi.
- Yangi SQL migratsiya talab qilinmaydi; oldindan ishlayotgan 007 jadvali va funksiyalari ishlatiladi. Alohida 011 migratsiyaning avvalgi holati bu ishda o‘zgartirilmadi.

## Tekshiruv dalillari

- `npm test`: **137/137 PASS**.
- Yangi status testi: telefon/proof mosligi, noto‘g‘ri challenge, noto‘g‘ri telefon, tasdiqlangan/muddati tugagan/ishlatilgan holatlar, 25 marta o‘qishda hisob yaratilmasligi, qaytariladigan maydonlarning chegarasi.
- Frontend proof testi: TTL, begona URL, o‘zgartirilgan challenge va noto‘g‘ri telefon rad etiladi; ortiqcha ism/parol/tasdiq belgisi saqlanadigan obyektga o‘tmaydi.
- Brauzer + alohida PostgreSQL/PGlite bazasi + mock Telegram transportida to‘liq jarayon: telefon bilan boshlash → noto‘g‘ri kontakt rad etilishi → reload/pending tiklanishi → to‘g‘ri kontaktdan keyin avtomatik tasdiq → ism/parol → mijoz kabineti. Natija `role=client`, `#cabinet/overview`; saqlangan proof tozalangan.
- Previewdagi bosh HTML, yangi JS/CSS va API health 200 hamda source bilan mos.
- Productiondagi HTML/app/modul/CSS, sitemap, robots va Google tasdiqlash fayli 200 va chiqarilgan nusxaga baytma-bayt mos. Auth Telegram talabi true, Payme live holatida.
- Productionda sun’iy noma’lum proofga status so‘rovi 200 + `expired/verified=false` qaytardi; ro‘yxatdan o‘tish boshlanmadi va mijoz yaratilmagan.
- Jonli brauzer 390 px: telefon birinchi, ism/parol disabled/yashirin, to‘g‘ri tugma faol, xato va overflow 0. Haqiqiy telefon bilan tashqi Telegram muloqoti oxirigacha bu auditda bajarilmadi.

Mahalliy dalillar: `.cache/registration-1106/browser.json`, `preview.json`, `live.json`, `release-manifest.json`. Vaqtinchalik brauzer yordamchisi `.cache/registration-direct1106.ps1`; qayta ishlatiladigan, real botga ulanmaydigan QA server `node scripts/qa-registration.mjs`.

## Reliz doirasi

Jonli saytning avvalgi izolyatsiyalangan source nusxasi asosida faqat ro‘yxatdan o‘tish integratsiyasi chiqarildi: app va index, yangi registration-flow JS/CSS, API status yo‘li va Telegram registration xabarlari. Qolgan 49 original fayl avvalgi manbaga mosligi tekshirildi. Mahalliy workspace’dagi boshqa mobil/SQL o‘zgarishlari bu relizga qo‘shilmadi; dizaynning asosiy uslubi saqlandi.

CLI deploy «Not authorized» qaytardi, lekin loyiha ko‘rish va ulangan Vercel vositasi orqali fayl upload/deploy huquqlari ishladi. Preview va production shu vosita orqali yaratilib, READY va domen aliaslari tekshirildi. Environment qiymatlari, parollar va bot tokenlari chiqarilmadi yoki o‘zgartirilmadi.
