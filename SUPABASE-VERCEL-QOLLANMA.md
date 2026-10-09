# ZARURIYAT — Vercel + Supabase Qo‘llanmasi

Ushbu loyiha to‘liq **Vercel (Frontend)** va **Supabase (Backend / Ma’lumotlar bazasi)** orqali server (VPS) talab qilmasdan, 100% bepul ishlaydi.

---

## 1-qadam: Supabase bazasini tiklash va ruxsatlarni ochish

Agar saytingizda ma’lumotlar ochilmay qolgan bo‘lsa (401 / permission denied):

1. [https://supabase.com](https://supabase.com) saytiga kiring va o‘z loyihangizni oching.
2. Chap menyudan **"SQL Editor"** bo‘limiga kiring.
3. **"New query"** (Yangi so‘rov) tugmasini bosing.
4. Loyihadagi `SUPABASE_TIKLASH.sql` fayli ichidagi barcha kodni nusxalab, shu yerga tashlang.
5. Yashil **"RUN"** tugmasini bosing.
6. Shunda barcha jadvallar ruxsatlari ochiladi va namunaviy akkauntlar tiklanadi!

---

## 2-qadam: Supabase ulanishini tekshirish

`public/supabase-config.js` faylida loyihangiz ma’lumotlari to‘g‘ri kiritilgan:
- **SUPABASE_URL:** `https://aqjwgflyyiyzaqzmxbwv.supabase.co`
- **SUPABASE_ANON_KEY:** `anon` public kaliti

---

## 3-qadam: Vercel'ga yuklash (Deploy)

1. Loyihadagi barcha o‘zgarishlarni GitHub profilingizga `git push` qiling:
   ```bash
   git add .
   git commit -m "fix: restore vercel and supabase integration"
   git push
   ```
2. Vercel loyihangiz avtomatik yangilanadi va sayt bir necha soniyada ishga tushadi!
3. Hech qanday murakkab server yoki sozlamalar shart emas.

---

## 4-qadam: Tizimga kirish akkauntlari

* **Operator (Koordinator):**
  - Login: `operator` (yoki `+998901234501`)
  - Parol: `Zaruriyat2026!`
* **Direktor (Rahbar):**
  - Login: `director` (yoki `+998901234502`)
  - Parol: `Zaruriyat2026!`
* **Mijoz:**
  - Login: `client` (yoki `+998901234503`)
  - Parol: `Zaruriyat2026!`
* **Hamkor:**
  - Login: `partner` (yoki `+998901234504`)
  - Parol: `Zaruriyat2026!`

Yangi mijozlar saytdan to‘g‘ridan-to‘g‘ri telefon raqamlari orqali ham ro‘yxatdan o‘tishlari mumkin.
