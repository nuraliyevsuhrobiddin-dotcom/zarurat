# ZARURIYAT ' texnik holat, 0.3.0

Statik vanilla HTML/CSS/ES modules frontend, Node.js 24 API, Supabase PostgreSQL.

## Ruxsatlar

Brauzer ' same-origin /api ' server service_role ' baza.
Anon/authenticated jadvallarga kira olmaydi; RLS yoqilgan va ochiq policy yo'q.
Custom auth serverda: bcrypt parol, tasodifiy 256-bit sessiya, bazada SHA-256 xeshi,
12 soat expiry, HttpOnly/SameSite=Lax/Secure cookie. Har endpoint serverda rol tekshiradi.
Ro'yxatdan o'tishda director tayinlanmaydi. Mavjud foydalanuvchi ID va rollari saqlanadi.

## Ma'lumotlar va amallar

users, partners, cases, services, history, attachments, feedback, packages,
package_usage, notifications, sessions, rate_limits.
Murojaat raqami, kod, fayllar, tarix va xabar navbati bitta SQL tranzaksiyasida.
Murojaat/xizmat/paket biznes amallari RPC orqali; funktsiyalar faqat service_role uchun.
Xizmat/murojaat yangilash parent lock bilan yakunlashga qarshi raqobatni oldini oladi.

## API

/auth/me, /auth/login, /auth/register, /auth/logout, /requests, /track, /feedback,
/cases'offset=0, /cases/id, /cases/id/services, /services/id, /partners,
/team, /clients, /users, /packages, /packages/id/use, /notifications, /stats, /files/id.
Fayl sessiya bilan GET, ochiq kuzatish kodi bilan POST body orqali olinadi.
Secrets URL'ga qo'yilmaydi. Xatolar shaxsiy DB tafsilotlarini oshkor qilmaydi.

## Chegaralar

Telegram navbatgina, OTP/reset va billing yo'q; fayl base64 3 ta/jami2.8MiB.
UI filtri yuklangan sahifalar bo'yicha. Monitoring va zaxira tashqi sozlash talab qiladi.
To'liq deploy tartibi: ISHGA-TUSHIRISH.md. Testlar: npm test.
