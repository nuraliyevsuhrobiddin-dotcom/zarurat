# ZARURIYAT

Tekshiruv va xavfsizlik tuzatishlari: [docs/TEKSHIRUV.md](docs/TEKSHIRUV.md).
Faol baza Node.js serveridagi SQLite; brauzerdan Supabase’ga bevosita kirish yopilgan.
Eski Supabase bazasidagi ma’lumotlar avtomatik ko‘chirilmaydi.

Sozlamalar va integratsiyalar: [docs/SOZLASH.md](docs/SOZLASH.md). Vercel va VPS’ga joylash: [deploy/SERVERGA-JOYLASH.md](deploy/SERVERGA-JOYLASH.md).

Muammoni murojaatdan natijagacha boshqaradigan, o‘zbek lotin yozuvidagi veb-platformaning ishlaydigan dastlabki versiyasi. `зарурият.docx` asosida yaratildi. Mijoz sayti, operator, hamkor va rahbar kabinetlari bitta ilovada.

## Ishga tushirish

Node.js **24 yoki yuqori** kerak. Tashqi npm kutubxonalarini o‘rnatish talab etilmaydi.

```powershell
cd C:\Users\XE\Desktop\nazoratt
npm start
```

Brauzer: **http://127.0.0.1:3000**. Standart holatda sayt faqat shu kompyuterda ochiladi. To‘xtatish: `Ctrl+C`.

Mahalliy demo birinchi ishga tushishda namunaviy ma’lumotlar bilan to‘ldiriladi. Ma’lumotlar `data/zaruriyat.sqlite` faylida saqlanadi. Serverni qayta ishga tushirish ularni o‘chirmaydi. `data/` katalogini Git’ga qo‘shmang.

| Kabinet | Login | Parol |
|---|---|---|
| Operator | `operator` | `Zaruriyat2026!` |
| Rahbar | `director` | `Zaruriyat2026!` |
| Hamkor | `partner` | `Zaruriyat2026!` |
| Mijoz | `client` | `Zaruriyat2026!` |

Yangi mijoz saytning ro‘yxatdan o‘tish formasidan hisob yaratadi. Telefon raqami login bo‘ladi. Mehmon ham murojaat yubora oladi; unga murojaat raqami va maxfiy kuzatish kodi beriladi. Maxfiy kodni saqlab qo‘yish kerak. Mijoz kabinetidan yuborilgan murojaatlar avtomatik shu hisobga biriktiriladi; telefon mos kelgani uchun eski mehmon murojaatlari hisobga avtomatik ulanmaydi.

## Asosiy imkoniyatlar

- 14 xizmat yo‘nalishi va muammosining yo‘nalishini bilmagan foydalanuvchi uchun alohida yo‘l.
- Murojaat yuborish, foto/PDF/audio biriktirish va brauzer ruxsat bersa ovoz yozish.
- Avtomatik `ZAR-000001` raqami, maxfiy kod bilan kuzatish, holatlar tarixi.
- Rollarga ko‘ra haqiqiy server ruxsatlari; parollar scrypt bilan xeshlanadi, sessiya HttpOnly cookie orqali yuritiladi.
- Koordinator, ustuvorlik, muddat, ichki izohlar, audit tarixi va bitta keys ichidagi ko‘p xizmatlar.
- Faol shartnomali hamkorga biriktirish va hamkor kabinetidan xizmat holatini ketma-ket yangilash.
- Muddati o‘tgan keyslar, statistika, hamkorlar va mijozlar ro‘yxati.
- Oila paketi, oila a’zolari, amal muddati va limit. **Bir yakunlangan murojaat = bitta limit birligi**; operator alohida qayd etadi. Bu billing yoki to‘lov tizimi emas.
- Yakunlangan murojaat uchun bir martalik 1–5 baho va izoh.
- Telegram integratsiyasi uchun bazada xabarlar navbati. Hozir **xabarlar yuborilmaydi**; bot tokeni va tasdiqlangan chat ID ulanishi hali qo‘shilmagan.

## Tekshirish

```powershell
npm test
npm run check
```

API sinovlari alohida vaqtinchalik bazada ishlaydi. Ular huquqlar, shaxsiy ma’lumotlar, fayl tekshiruvi, ko‘p xizmatli keys, hamkor jarayoni, baholash, paket limiti va sessiyalarni tekshiradi. API shartnomasi: [docs/API.md](docs/API.md).

## Zaxira nusxa

```powershell
npm run backup
```

Bu buyruq SQLite bazasining izchil nusxasini `data/backups/` ichiga yozadi. Nusxada shaxsiy ma’lumotlar va fayllar bor; kirishni cheklang. Tiklash uchun serverni to‘xtating, mavjud `data` papkasini arxivlang, yangi bo‘sh `data` papkasiga tanlangan nusxani `zaruriyat.sqlite` nomi bilan joylashtiring, so‘ng serverni ishga tushiring. Eski `-wal` va `-shm` fayllarini yangi nusxaga ko‘chirmang.

## Demo ma’lumotlarsiz boshlash

Demo bazasini internetga chiqarishdan himoya bor. Demo hisoblaridan foydalanmaydigan o‘rnatish uchun yangi ma’lumotlar katalogi va administrator paroli kerak:

```powershell
$env:DEMO_MODE = 'false'
$env:DATA_DIR = 'C:\Users\XE\Desktop\nazoratt\data-private'
$adminSecret = Read-Host 'Rahbar paroli (kamida 14 belgi)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
npm start
```

Login: `director`. Birinchi ishga tushishdan keyin `ADMIN_PASSWORD` o‘zgaruvchisini o‘chirish mumkin. Bu buyruqni har safar ayni `DEMO_MODE` va `DATA_DIR` bilan ishga tushiring. `PORT` boshqa portni belgilaydi. Internetga chiqarishda HTTPS reverse proxy, `SECURE_COOKIE=true`, zaxira nusxa jadvali, monitoring va quyida ko‘rsatilgan qolgan integratsiyalar kerak. Demo bazasini production rejimida ochish rad etiladi.

## Operator yoki hamkor hisobini yaratish

Hamkorni avval operator kabinetidagi bazaga qo‘shing. Hamkor katalogi yozuvi avtomatik login yaratmaydi. Quyidagi buyruq lokal administrator uchun:

```powershell
$env:NEW_USER_LOGIN = 'hamkor_2'
$env:NEW_USER_NAME = 'Hamkor nomi'
$env:NEW_USER_PHONE = '+998901112233'
$env:NEW_USER_ROLE = 'partner' # operator, director yoki partner
$env:NEW_USER_PARTNER_ID = '2' # faqat partner uchun bazadagi ID
$newUserSecret = Read-Host 'Yangi parol (kamida 14 belgi)' -AsSecureString
$env:NEW_USER_PASSWORD = [System.Net.NetworkCredential]::new('', $newUserSecret).Password
npm run user:add
Remove-Item Env:NEW_USER_PASSWORD
```

Xuddi serverdagi `DATA_DIR` va `DEMO_MODE` ishlatilishi kerak. Parolni faqat hisob egasiga xavfsiz yetkazing.

## Chegaralar va keyingi bosqich

Bu lokal MVP; internetga joylashtirilmagan. SMS/OTP orqali telefon tasdiqlash, parolni tiklash, Telegram bot adapteri, to‘lovlar, avtomatik eskalatsiya, antivirus tekshiruvi, ma’lumotni saqlash/o‘chirish siyosatining ma’muriy interfeysi va keng yuklama sinovlari hali yo‘q. Telefon raqami hisob egasining tasdiqlangan shaxsi sifatida talqin qilinmaydi. Oila paketini yangilash mavjud foydalanish tarixini nolga tushirmaydi; haqiqiy abonement davrlari uchun alohida hisoblash modeli kerak.

Talablar, qo‘shilgan yaxshilanishlar va qolgan ishlar: [docs/TALABLAR.md](docs/TALABLAR.md).
