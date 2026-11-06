# Domen va Google tayyorligi — 2026-11-05

## Jonli natija

SEO yangilanishi **https://www.zaruriyat.uz/** ga chiqarildi. Vercel production deployment: `dpl_GFpWo5KXvRAo9eCXqcXME2N2mGt2`. Oldingi production: `dpl_4bX2DCk5X7hFxT2qtnjepzydd3FV`; preview: `dpl_27hnzDNtehcVB4KzRh5fEfhkjzGy`.

Keyingi yangilanish: foydalanuvchi «o‘zing qil» deb davom ettirgach, Downloads ichida Google bergan asl `googled028dbc5cc12ba43.html` fayli topildi. 53 baytli fayl o‘zgartirilmasdan lokal `public/` va izolyatsiyalangan relizga nusxalandi. Yangi production deployment: `dpl_7rdQJQaoUgvYkCFHkT4DgAnKfMD4`. [Jonli tasdiqlash fayli](https://www.zaruriyat.uz/googled028dbc5cc12ba43.html) anonim so‘rovda redirectsiz 200 qaytardi, tanasi asl faylga baytma-bayt mos. Dalil: `.cache/seo-release/google-verification-check.json`.

Google hisobida ochiq foydalanuvchi Chrome oynasiga avtomatizatsiya ulanishi mavjud emas. Shu sababli Search Console’da aynan **«HTML-файл» bo‘limidagi «ПОДТВЕРДИТЬ»** ni foydalanuvchi bosishi qoladi. HTML metatag olish endi shart emas; HTML fayli usuli tayyorlandi. Google egalikni tasdiqlagani yoki sitemap Search Console’da yuborilgani hali tasdiqlanmagan.

Domen boshidan to‘g‘ri ulangan edi: Vercel apex va www domenlarini tasdiqlangan deb qaytardi, DNS `misconfigured=false`, HTTPS ishladi. `http://zaruriyat.uz/` → `https://zaruriyat.uz/` → `https://www.zaruriyat.uz/` yo‘naltirishlari 308. DNS yozuvlari o‘zgartirilmadi; domen Ahost nameserverlarida boshqariladi.

Oldin robots va sitemap 404 edi; endi [robots.txt](https://www.zaruriyat.uz/robots.txt) va [sitemap.xml](https://www.zaruriyat.uz/sitemap.xml) ishlaydi. Sitemap 18 haqiqiy URLni o‘z ichiga oladi: bosh sahifa, xizmatlar katalogi, ishlash tartibi, aloqa va 14 xizmat sahifasi. Hash/private/API URLlari sitemapga kiritilmagan.

Yangi xizmat sahifalarida HTML matni JavaScriptsiz ham o‘qiladi. Alohida title, description, canonical, Open Graph va JSON-LD bor. Schema Organization va Service ma’lumotlari tasdiqlangan telefon/manzil hamda mavjud xizmat mazmuniga tayangan; narx, baho, sharh yoki koordinatalar to‘qib chiqarilmagan. Har bir xizmatdan o‘z yo‘nalishidagi murojaat formasiga o‘tiladi. Xizmatlar mavjudligi va bajarish shartlari koordinator bilan kelishilishi ko‘rsatilgan.

## Chiqarish chegarasi

Bu **faqat SEO relizi**. Mahalliy workspace’da oldindan mavjud mobil tiklash, 011 SQL/API tuzatishi va boshqa ochiq o‘zgarishlar ushbu relizga qo‘shilmadi. Jonli deployment manbalari alohida `.cache/seo-release/source/` ga olinib, SEO unga qo‘shildi. 53 original fayldan 52 tasi aynan saqlandi; `public/index.html` SEO uchun yangilandi va 20 yangi ochiq fayl qo‘shildi. Backend, to‘lov va auth manbalari almashtirilmadi. Production uchun alohida build bajarilib, mavjud production environment ishlatildi.

Vercel MCP source fayllarini qisqartirib qaytargani tekshiruvda aniqlandi; bunday nusxa deploy qilinmadi. To‘liq source CLI orqali qayta olindi va jonli app, HTML, CSS, to‘lov moduli hamda markaz rasmi baytma-bayt solishtirildi.

## Tekshiruvlar

- `npm test`: **135/135 PASS**.
- Mahalliy brauzer: 320, 390, 768, 1280 px da 28 holat; overflow, ko‘rinadigan xato va canonical/JSON-LD muammosi 0.
- Himoyalangan previewda 6 yo‘l 200, kontent source bilan mos. Vercel preview toolbar qo‘shimchasi solishtirishda alohida hisobga olindi.
- Production sitemapdagi **18/18 URL** redirectsiz 200, canonical mos va HTML kutilgan faylga teng.
- Mavjud **28 public asset** eski production bilan baytma-bayt mos.
- `/api/health` OK, auth configured=true; Telegram ro‘yxatdan o‘tish sozlamalari saqlangan; Payme enabled=true, mode=live.
- Noma’lum xizmat URLi haqiqiy 404 qaytardi.
- Jonli brauzerda xizmat sahifasidagi «Murojaat qoldirish» huquqiy yo‘nalishdagi formani ochdi: category=legal, consent required, overflow=0, ko‘rinadigan xato=0. Murojaat yuborilmadi.

Dalillar `.cache/seo-release/` ichida: `source-verification.json`, `preview-check.json`, `browser.json`, `live-check.json`, `live-browser.json`. `.cache` vaqtinchalik bo‘lishi mumkin; asosiy natijalar shu hujjatda.

## Google hisobida qolgan qadam

Foydalanuvchi Search Console’da bu saytni hali qo‘shmaganini tasdiqladi. Yuborgan skrinshotida boshqa resurs — **agmjoural.uz** tanlangan. Unga o‘zgartirish kiritilmadi.

1. [Search Console](https://search.google.com/search-console) da chap yuqoridagi resurs ro‘yxatini ochish.
2. «Добавить ресурс / Add property» ni tanlash.
3. «Ресурс с префиксом в URL / URL prefix» maydoniga **https://www.zaruriyat.uz/** yozib davom etish.
4. «HTML-файл / HTML file» usulini ochish: Google bergan asl fayl allaqachon yuqoridagi manzilga joylandi va tekshirildi.
5. Shu bo‘limda «Подтвердить / Verify» bosish. Natijani Google oynasidan tekshirish.
6. «Файлы Sitemap» bo‘limida `sitemap.xml` yuborish.
7. «Проверка URL» orqali **https://www.zaruriyat.uz/** ni tekshirib, «Запросить индексирование» yuborish. Keyin asosiy xizmat sahifalarini ham tekshirish mumkin.

Google hisobiga kirish, egalikni tasdiqlash, sitemapni Search Console’da yuborish va indekslash so‘rovi ushbu sessiyada bajarilgan deb belgilanmaydi. Oddiy `site:` qidiruvi natija qaytarmadi; bu Search Console’dagi URL Inspection o‘rnini bosmaydi. Google’da chiqish sanasi yoki reytingi kafolatlanmaydi.

Rasmiy manbalar: [sayt egaligini tasdiqlash](https://support.google.com/webmasters/answer/9008080), [sitemap yuborish](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [qayta indekslashni so‘rash](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Keyingi texnik yangilash

Xizmat tavsifi yoki aloqa ma’lumoti o‘zgarsa, `npm run build:search` ochiq sahifalar va sitemapni qayta yaratadi. Generator mavjud tasdiqlash metataglarini saqlaydi. Google bergan haqiqiy verification kodini HTMLga qo‘shgandan keyin ham shu saqlanish regressiya testi bilan tekshiriladi. Ommaviy to‘liq workspace deploymentidan oldin mahalliy boshqa o‘zgarishlar, 011 migratsiya va ilova relizi alohida tekshirilishi kerak.
