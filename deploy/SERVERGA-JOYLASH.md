# Serverga joylash holati

Tanlangan arxitektura: Vercel’da sayt va API proksi; alohida VPS’da Node.js API va SQLite. Bu katalogdagi Docker/Caddy VPS uchun, ildizdagi `vercel.json` esa Vercel uchun.

## Vercel

Loyihani Vercel’ga import qiling. Framework: Other; loyiha ildizini tanlang. `vercel.json` statik sayt va `api/proxy.mjs` funksiyasini belgilaydi. Vercel Environment Variables’da `API_ORIGIN=https://api.YOUR_DOMAIN` yozing (oxiriga `/api` qo‘shmang). SQLite, administrator paroli va SMS/Telegram/to‘lov tokenlari Vercel’ga yuklanmaydi.

VPS `.env` faylida `DOMAIN=api.YOUR_DOMAIN` va `PUBLIC_ORIGIN=https://YOUR_SITE.vercel.app` belgilang. Saytning yakuniy domeni bilan aynan mos bo‘lsin, oxiriga `/` yozmang. Preview domenlar avtomatik ruxsat olmaydi; preview uchun alohida test API tavsiya qilinadi.

Brauzer `/api/...`ga saytning o‘z domenida murojaat qiladi. Proksi so‘rov va sessiya cookie’sini VPS’ga uzatadi. Cookie sayt domenida saqlanadi. Proksi cheklovi uchun yangi biriktirilgan fayllarning jami hajmi 2.8 MB bilan cheklangan. Oldingi 4 MB dan katta fayllarni proksi orqali yuklab bo‘lmaydi; ular uchun keyin alohida fayl saqlash/yuklash yechimi kerak.

Vercel va VPS’ni sozlagach saytdan yangi hisob, login, murojaat, fayl va logout jarayonlarini tekshirish kerak. Vercel proksi va Docker hali haqiqiy hostingda tekshirilmagan.

## Doimiy diskli server varianti

Serverda Docker Engine va Compose bo‘lishi kerak. Loyihani maxfiy `.env`, `data` va mahalliy zaxiralarsiz yuklang. Serverdagi loyiha ildizida:

```sh
cp deploy/.env.production.example .env
chmod 600 .env
```

`.env`ga haqiqiy `DOMAIN`, `ADMIN_PHONE` va kamida 14 belgili `ADMIN_PASSWORD` kiriting. Domen DNS yozuvlari serverga qarasin; 80 va 443 portlari ochiq bo‘lsin. Keyin:

```sh
docker compose up -d --build
docker compose ps
curl --fail https://YOUR_DOMAIN/api/health
```

Caddy HTTPS sertifikatini oladi va yangilaydi. API tashqi portga alohida chiqarilmaydi. SQLite `app_data` doimiy volume’ida saqlanadi; namuna bazasi Docker image’ga kirmaydi. Birinchi ishga tushishdan keyin `ADMIN_PASSWORD`ni `.env`dan olib tashlab, `docker compose up -d` bajaring. Hisob paroli bazada qoladi.

Docker volume’larini o‘chirmang: `docker compose down -v` baza va HTTPS ma’lumotlarini o‘chiradi. Oddiy kod yangilash uchun `docker compose up -d --build` ishlatiladi.

## Zaxira

```sh
sh deploy/backup.sh /srv/zaruriyat-backups
```

Buyruq SQLite’ning izchil nusxasini konteynerdan server katalogiga chiqaradi. Uni boshqa serverga ham ko‘chirish va jadvalga qo‘yish kerak. Cron misoli (loyiha yo‘lini almashtiring):

```cron
0 2 * * * /bin/sh /srv/zaruriyat/deploy/backup.sh /srv/zaruriyat-backups >> /srv/zaruriyat-backup.log 2>&1
```

Skript eski zaxiralarni o‘chirmaydi. Disk hajmini kuzating. Tiklash serverdagi volume yo‘li aniqlangach, xizmat to‘xtatilgan holatda bajariladi; avval joriy baza va tanlangan zaxira saqlanadi.

## Tekshirish chegaralari

Mahalliy API va production bazasi testlari ishlatilgan. Docker bu ish muhitida mavjud emas; image build, Caddy sertifikati, server portlari va cron haqiqiy serverda tekshirilishi kerak. Bu konfiguratsiya SMS, Telegram yoki to‘lovni ulamaydi.

Manbalar: [Caddy HTTPS](https://caddyserver.com/docs/quick-starts/https), [Compose services](https://docs.docker.com/reference/compose-file/services/), [Vercel va SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
