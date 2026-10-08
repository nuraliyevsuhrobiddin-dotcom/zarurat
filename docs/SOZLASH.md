# Siz to‘ldiradigan sozlamalar

PowerShell orqali `.env` yarating (agar oldin yaratilmagan bo‘lsa):

```powershell
Copy-Item .env.example .env
```

Mahalliy namuna uchun o‘zgartirish shart emas. `npm start`, `npm run dev`, `npm run backup` va `npm run user:add` `.env` faylini o‘qiydi. PowerShell’da oldin berilgan muhit o‘zgaruvchilari `.env` qiymatlaridan ustun turadi.

Haqiqiy mijozlar bilan ishlash uchun:

1. `DEMO_MODE=false` belgilang.
2. `DATA_DIR=./data-private` belgilang. Bu yangi, demo bazasi bo‘lmagan katalog bo‘lsin.
3. `ADMIN_PHONE` qatorini yoqing va o‘z telefoningizni yozing.
4. `ADMIN_PASSWORD` qatorini yoqing va kamida 14 belgili yangi, maxfiy parol yozing. Namunadagi parol matnini ishlatmang.
5. `npm start` bilan bazani yarating. Rahbar logini: `director`. Keyin `.env` ichidagi `ADMIN_PASSWORD`ni olib tashlashingiz mumkin; bu hisob parolini o‘zgartirmaydi.

`SECURE_COOKIE=false` mahalliy HTTP uchun. HTTPS orqali joylashtirilganda `SECURE_COOKIE=true` kerak. `.env` maxfiy fayl va `.gitignore`da chiqarib tashlangan.

## Ma’lumotlar bazasi

SQLite bazasi avtomatik yaratiladi: `<DATA_DIR>/zaruriyat.sqlite`. Alohida baza serveri, login yoki `DATABASE_URL` kerak emas. Mavjud demo bazasi `data/zaruriyat.sqlite`; haqiqiy o‘rnatishda yangi katalog ishlatiladi. Mavjud ma’lumotlar bu sozlamalar bilan ko‘chirilmaydi va o‘chirilmaydi.

`npm run backup` bazaning izchil nusxasini shu `DATA_DIR` ichidagi `backups` papkasiga yozadi. Avtomatik jadval va boshqa disk/serverga nusxa olish hali sozlanmagan. Baza shaxsiy ma’lumotlar hamda biriktirilgan fayllarni saqlaydi; faylga kirish huquqlari operatsion tizim orqali cheklanadi. Bazaning o‘zi shifrlanmagan.

## Qolgan ishlar

- Telegram bot va tasdiqlangan chat bog‘lanishi, SMS provayder va haqiqiy yuborish adapterlari. Faqat `.env`ga token yozish bularni ishga tushirmaydi.
- Telefonni SMS/OTP bilan tasdiqlash va parolni tiklash.
- To‘lov moduli va provayderdan kelgan tasdiqlarni tekshirish.
- Paket yangilanganda alohida abonement davri va foydalanish tarixi; hozir eski foydalanish nolga tushmaydi.
- Internetga joylash: domen, HTTPS, doimiy server, avtomatik zaxira va monitoring.

## Integratsiyalar holati

Oila paketi tizimga kirgan mijoz hisobidan avtomatik aniqlanadi. Murojaat tafsilotlarida paket nomi, holati va qolgan limit ko‘rinadi: `active`, `expired`, `exhausted`. Mehmon telefon raqami orqali avtomatik abonent deb belgilanmaydi; raqam tasdiqlanmagan. Oila a’zolarining ismlari alohida tasdiqlangan hisoblar emas.

Hamkorning alohida `partner` roli va kabineti bor. Shartnoma holatlari: `pending`, `active`, `expired`. Xizmat holatlari: `pending`, `accepted`, `contacted`, `delivered`, `completed`, `cancelled`. Hamkor faqat o‘ziga biriktirilgan xizmatlarni boshqaradi.

Telegram xabarlari navbatga yoziladi. Haqiqiy yuborish adapteri ulanmagan: yuborish API’lari 503 qaytaradi va xabarni `sent` deb belgilamaydi. Eski `sent` yozuvlari yetkazilganlik isboti emas. SMS adapteri ham mavjud emas.

To‘lov moduli uchun buyurtma va tranzaksiya yozuvlari, provayder xabarlarini tekshirish, takroriy tasdiqlarni bir marta hisoblash va tasdiqlangan to‘lovdan so‘ng paketni faollashtirish kerak. Paket limiti to‘lov balansi emas.

Vercel va VPS sozlash: [SERVERGA-JOYLASH.md](../deploy/SERVERGA-JOYLASH.md).
