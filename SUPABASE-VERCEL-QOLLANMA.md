# ZARURIYAT — Vercel + Supabase Qo‘llanmasi

Ushbu loyiha endi to‘liq **Vercel (Frontend)** va **Supabase (Backend / Baza)** da ishlashga moslandi. Sizga hech qanday VPS server yoki oylik to‘lov kerak emas. Barchasi 100% bepul ishlaydi!

---

## 1-qadam: Supabase loyihasini ochish

1. [https://supabase.com](https://supabase.com) saytiga kiring va o‘z hisobingizga kiring.
2. **"New Project"** (Yangi loyiha) tugmasini bosing.
3. Loyiha nomini yozing (masalan: `zaruriyat`) va kuchli ma’lumotlar bazasi parolini belgilang.
4. Mintaqa sifatida O‘zbekistonga eng yaqin joyni tanlang (masalan, `Frankfurt (EU Central)`).
5. **"Create new project"** tugmasini bosing va 1-2 daqiqa kutasiz.

---

## 2-qadam: Baza jadvallarini yaratish (SQL Editor)

1. Supabase boshqaruv panelida chap menyudan **"SQL Editor"** bo‘limiga kiring.
2. **"New query"** (Yangi so‘rov) tugmasini bosing.
3. Loyihangizdagi `supabase-schema.sql` fayli ichidagi barcha kodlarni nusxalab (Copy), bu yerga tashlang (Paste).
4. Pastdagi yashil **"Run"** tugmasini bosing.
5. `Success. No rows returned` yozuvi chiqsa, barcha jadvallar (`users`, `cases`, `services`, `partners`...) va namunaviy akkauntlar tayyor bo‘ldi!

---

## 3-qadam: Supabase kalitlarini olish va ulash

1. Supabase chap menyusining eng pastidagi tishli g‘ildirak **"Project Settings"** (Sozlamalar) ga kiring.
2. **"API"** bo‘limini oching.
3. U yerda ikkita ma’lumotni nusxalang:
   * **Project URL**: (masalan: `https://abcdefghijkl.supabase.co`)
   * **Project API Keys -> `anon` `public`**: (uzun maxfiy kalit)

4. Ushbu ma’lumotlarni loyihangizdagi `public/supabase-config.js` fayliga yozing:
```javascript
export const SUPABASE_URL = 'https://aqjwgflyyiyzaqzmxbwv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxandnZmx5eWl5emFxem14Ynd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzI2MTUsImV4cCI6MjEwNzAwODYxNX0.TO48NibwvdLAoALXqLPhl3yrLQUlSgReTbsr82XHFH0';
```
*(Yoki sayt ochilganda yuqori menyudagi **"⚡ Supabase"** tugmasini bosib to‘g‘ridan-to‘g‘ri kiritishingiz ham mumkin!)*

---

## 4-qadam: Vercel'ga yuklash (Deploy)

1. Loyihani o‘zingizning **GitHub** profilingizga yuklang (Push qiling).
2. [https://vercel.com](https://vercel.com) saytiga kiring.
3. **"Add New..."** -> **"Project"** ni bosing.
4. GitHub'dagi loyihangizni tanlang.
5. **Framework Preset**: `Other` qilib qoldiring.
6. **"Deploy"** tugmasini bosing!

---

## 5-qadam: Tayyor! Tizimga kirish

Saytingiz `https://zaruriyat.vercel.app` manzilida ishga tushadi.

Namunaviy tizimga kirish login/parollari:
* **Operator (Koordinator):** login: `operator` / parol: `Zaruriyat2026!`
* **Direktor (Rahbar):** login: `director` / parol: `Zaruriyat2026!`
* **Mijoz:** login: `client` / parol: `Zaruriyat2026!
* **Hamkor:** login: `partner` / parol: `Zaruriyat2026!`

Yangi mijozlar saytdan to‘g‘ridan-to‘g‘ri telefon raqami bilan ro‘yxatdan o‘ta oladilar.
