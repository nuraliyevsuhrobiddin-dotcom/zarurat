# ZARURIYAT

Ijtimoiy yordam murojaatlarini boshqaradigan veb-platforma.  
Mijoz → murojaat → koordinator → hamkor → natija.

**Arxitektura:** Statik frontend (Vercel) + Supabase (PostgreSQL + Auth emas, custom auth)  
**Hujjatlar:** [docs/TALABLAR.md](docs/TALABLAR.md) · [SUPABASE-VERCEL-QOLLANMA.md](SUPABASE-VERCEL-QOLLANMA.md) · [Texnik Topshiriq](docs/TEXNIK-TOPSHIRIQ.md)

---

## Arxitektura

```
Foydalanuvchi brauzer
       │
       ▼
  Vercel CDN (static)
  public/index.html
  public/app.js
  public/api.js          ← API facade
  public/supabase-api.js ← Supabase client
       │
       ▼
  Supabase (PostgreSQL)
  - users, cases, partners
  - services, history, attachments
  - packages, feedback, notifications
```

Server taraf kodi yo'q. Barcha so'rovlar brauzerdan to'g'ridan-to'g'ri Supabase'ga boradi.

---

## Sozlash

### 1. Supabase

1. [supabase.com](https://supabase.com) da yangi project yarating
2. SQL Editor → `supabase-schema.sql` ni ishga tushiring
3. Project Settings → API → `URL` va `anon key` ni oling

### 2. Vercel

1. [vercel.com](https://vercel.com) da GitHub repo ulanadi
2. **Root Directory:** `public` (yoki `vercel.json` ni tekshiring)
3. Environment Variables:
   - `SUPABASE_URL` = `https://xxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `eyJhb...`

### 3. Lokal test

```powershell
# public/ papkasini statik server bilan ochish:
npx serve public
```

Brauzer: `http://localhost:3000`

---

## Birinchi foydalanuvchi (Rahbar)

Demo akkauntlar yo'q. Birinchi ro'yxatdan o'tgan foydalanuvchi avtomatik ravishda `director` (rahbar) rolini oladi. Keyingi foydalanuvchilar `client` bo'lib qo'shiladi. Operator va hamkor rollarini rahbar kabineti orqali tayinlash mumkin (keyingi bosqich).

---

## Asosiy imkoniyatlar

- 14 xizmat yo'nalishi + yo'nalishni bilmaganlar uchun alohida yo'l
- Murojaat yuborish, foto/PDF/audio biriktirish, ovoz yozish
- `ZAR-000001` raqami va maxfiy kod bilan kuzatish
- Rol asosida kirish: mijoz, operator, hamkor, rahbar
- Keysda bir nechta xizmat, hamkor biriktirib, holatlar ketma-ket yangilanadi
- Oila paketi tizimi (limit, muddati, a'zolar)
- Yakunlangan murojaat uchun 1–5 baho
- Telegram xabar navbati (bot hali ulanmagan)
- O'zbek lotin/kiril yozuvi almashtirish

---

## Ma'lumotlar bazasi tiklash

Supabase bazasi yo'qolsa yoki yangi project ochilda:

```sql
-- SQL Editor'da ishga tushiring:
-- 1. supabase-schema.sql   ← jadvallar va RLS siyosatlari
-- 2. SUPABASE_TIKLASH.sql  ← qo'shimcha tuzatmalar (agar kerak bo'lsa)
```

---

## Chegaralar (keyingi bosqich)

- SMS/OTP orqali telefon tasdiqlash va parol tiklash
- Telegram bot integratsiyasi (navbat tayyor, yuborish adapteri yo'q)
- Billing, to'lov va paket avtomatligi
- Rahbar interfeysi orqali xodim va hamkor hisoblarini yaratish
- Antivirus, yuklama sinovlari va kengaytirilgan audit loglari

---

Texnik topshiriq: [docs/TEXNIK-TOPSHIRIQ.md](docs/TEXNIK-TOPSHIRIQ.md)
