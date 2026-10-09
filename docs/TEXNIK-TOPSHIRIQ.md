# ZARURIYAT — Texnik Topshiriq

**Versiya:** 1.0  
**Sana:** 2026-yil oktabr  
**Maqsad:** Ijtimoiy yordam murojaatlarini boshqarish veb-platformasi

---

## 1. Loyiha haqida

ZARURIYAT — aholining ijtimoiy yordam, parvarish, reabilitatsiya va boshqa xizmat turlariga bo'lgan murojaatlarini qabul qilib, koordinatorlar orqali tegishli hamkor tashkilotlarga yo'naltirish, jarayonni kuzatish va natijani mijozga yetkazish uchun mo'ljallangan veb-platforma.

**Asosiy jarayon:**

```
Mijoz murojaat yuboradi
       DOWN
Koordinator (operator) keysni qabul qiladi va hamkorga yo'naltiradi
       DOWN
Hamkor xizmat holatini yangilab boradi
       DOWN
Keys yakunlanadi — mijoz baho beradi
```

---

## 2. Texnik arxitektura

### 2.1 Tanlangan yondashuv

| Komponent | Texnologiya | Sabab |
|-----------|-------------|-------|
| Frontend | Vanilla HTML/CSS/JS (ES modules) | Yengil, tashqi framework kerak emas |
| Hosting | Vercel (static CDN) | Bepul, CDN, HTTPS avtomatik |
| Ma'lumotlar bazasi | Supabase (PostgreSQL) | Bepul tier, RLS himoyasi |
| Auth | Custom session (localStorage) | To'liq nazorat, telefon asosida login |
| Fayl saqlash | Supabase attachments jadvali (base64) | MVP uchun yetarli |

### 2.2 Papka tuzilishi

```
nazoratt/
├── public/                 <- Vercel'ga deploylanadigan statik fayl
│   ├── index.html          <- Yagona sahifa (SPA)
│   ├── app.js              <- Asosiy UI logikasi
│   ├── api.js              <- API facade
│   ├── supabase-api.js     <- Supabase so'rovlari (20+ endpoint)
│   ├── supabase-config.js  <- Supabase URL va anon key
│   ├── styles.css          <- Butun dizayn
│   ├── manifest.json       <- PWA manifesti
│   └── images/             <- Ochiq sahifa rasmlari
├── docs/
│   ├── TALABLAR.md         <- Biznes talablar tahlili
│   └── TEXNIK-TOPSHIRIQ.md <- Ushbu hujjat
├── supabase-schema.sql     <- Jadvallar va RLS siyosatlari
├── SUPABASE_TIKLASH.sql    <- Qo'shimcha tuzatmalar
├── SUPABASE-VERCEL-QOLLANMA.md  <- O'rnatish qo'llanmasi
├── vercel.json             <- Vercel konfiguratsiyasi
├── package.json
└── .gitignore
```

---

## 3. Ma'lumotlar bazasi sxemasi

### 3.1 Asosiy jadvallar

| Jadval | Maqsad |
|--------|--------|
| users | Barcha foydalanuvchilar |
| cases | Murojaatlar (keyslar) |
| services | Keysdagi alohida xizmatlar |
| case_history | Audit log |
| attachments | Biriktirilgan fayllar (base64) |
| partners | Hamkor tashkilotlar |
| packages | Oila paketlari |
| package_usage | Paket foydalanish qaydlari |
| feedback | Mijoz baholari (1-5) |
| notifications | Telegram xabar navbati |

### 3.2 Foydalanuvchi rollari

| Rol | Kirish huquqi |
|-----|---------------|
| client | Faqat o'z murojaatlari va paketlari |
| operator | Barcha keyslar, hamkorlar, mijozlar, paketlar |
| director | Operator + jamoa boshqaruvi, statistika |
| partner | Faqat o'ziga biriktirilgan xizmatlar |

### 3.3 Birinchi foydalanuvchi qoidasi

Birinchi ro'yxatdan o'tgan foydalanuvchi avtomatik "director" rolini oladi.

### 3.4 RLS siyosati

Hozirgi MVP uchun kengaytirilgan siyosat qo'llanilgan (WITH CHECK (true)). Huquq tekshiruvi ilova kodida amalga oshiriladi. Ishlab chiqarish uchun foydalanuvchiga xos qoidalar tavsiya etiladi.

---

## 4. Foydalanuvchi interfeysi (SPA, #hash routing)

| Hash | Sahifa |
|------|--------|
| #home | Asosiy ochiq sahifa |
| #services | Xizmat yo'nalishlari |
| #how | Qanday ishlaydi |
| #family | Oila paketi |
| #overview | Kabinet bosh sahifasi |
| #cases | Murojaatlar ro'yxati |
| #partners | Hamkorlar (staff) |
| #clients | Mijozlar (staff) |
| #packages | Paketlar |
| #team | Jamoa (director) |
| #notifications | Telegram navbati (staff) |

Lokalizatsiya: O'zbek lotin va kiril yozuvlari almashadi. Tanlov localStorage'da saqlanadi.

---

## 5. Murojaat jarayoni

1. Ism, telefon, hudud, yo'nalish, tavsif kiritiladi
2. Ixtiyoriy: fayl biriktirish, ovoz yozish (MediaRecorder)
3. Rozilik belgisi qo'yiladi
4. Supabase "cases" jadvaliga INSERT
5. Javob: ZAR-XXXXXX raqam + maxfiy kuzatish kodi

Keysning holatlari (tartibli):
received → reviewing → searching → arranging → contacted → completed | cancelled

---

## 6. Xavfsizlik

- Parol: scrypt xesh, users jadvalida
- Session: localStorage da token (client-side)
- Kiritmalar: telefon formati, fayl turi/hajmi, matn uzunligi tekshiriladi
- Rolga asosida kirish: har endpoint uchun rol tekshiriladi

---

## 7. Fayl biriktirish

- Max 3 ta fayl, har biri 5 MB
- Ruxsat etilgan turlar: image/*, application/pdf, audio/*
- Base64 formatida attachments jadvalida saqlanadi
- Yuklash: FileReader API; ovoz yozish: MediaRecorder API

---

## 8. Oila paketi

1 ta yakunlangan murojaat = 1 birlik. Operator qo'lda qayd etadi.
Davr turlari: Start, Komfort, Premium. Muddati va limit belgilanadi.

---

## 9. O'rnatish

**Supabase:**
1. supabase.com da yangi project yarating
2. SQL Editor: supabase-schema.sql ishga tushiring
3. URL va anon key oling, public/supabase-config.js ga yozing

**Vercel:**
1. GitHub reponi vercel.com ga ulang
2. outputDirectory: public (vercel.json da ko'rsatilgan)

---

## 10. Keyingi bosqich

| Vazifa | Muhimlik |
|--------|----------|
| SMS/OTP tasdiqlash va parol tiklash | Yuqori |
| Supabase Auth ga o'tish | Yuqori |
| RLS siyosatlarini mustahkamlash | Yuqori |
| Rahbar: xodim/hamkor hisob yaratish | O'rta |
| Telegram bot adapteri | O'rta |
| Fayllarni Supabase Storage ga ko'chirish | O'rta |
| Billing va paket avtomatligi | O'rta |
| Sahifalash (pagination) | Past |

---

## 11. Versiya tarixi

| Versiya | Sana | O'zgarish |
|---------|------|-----------|
| 0.1.0 | 2026-10 | Dastlabki SQLite + Node.js MVP |
| 0.2.0 | 2026-10 | Vercel + Supabase, demo hisoblar olib tashlandi |

*Manba: zаruriyat.docx (foydalanuvchi taqdim etgan)*
