# Mobil va planshet tekshiruvi — 17.10.2026

Mavjud ishchi nusxa tahlil qilindi. Tuzatishlar `public/styles.css`, `public/mobile-app.css` va CSS versiyalari uchun `public/index.html` fayllariga kiritildi.

## Topilgan va tuzatilgan muammolar

1. **821 px ekran kengligida kabinet ekrandan chiqishi.** Rahbarning umumiy paneli sahifani 123 px kengaytirardi. 1100 px gacha statistika ikki ustunga o'tkazildi, grid ustunlari va kartochkalar kichrayishga moslashtirildi. Qayta tekshiruvda chiqish 0 px.
2. **Filtr checkboxi katta maydonga aylanishi.** `.filters input` barcha inputlarga 100% kenglik va 46 px balandlik berardi. Matn maydonlari checkbox/radiodan ajratildi; checkbox 20×20 px, uni bosish uchun label kamida 44 px.
3. **Pastki navigatsiya xavfsiz ekran chetiga sig'masligi.** Eski qat'iy balandlik yangi padding va elementlarning minimal balandligi bilan to'qnashardi. Endi balandlik tarkib va pastki xavfsiz bo'shliqqa moslashadi; forma ichida menyu alohida joy egallaydi.
4. **Yuqori sarlavhalar kesilishi va ekran chetiga yaqinligi.** Qat'iy balandliklar olib tashlandi, uzun sarlavhalar yangi qatorga o'tadi, yuqoridagi xavfsiz bo'shliq hisobga olinadi. Kabinetning hisob tugmalari 44×44 px.
5. **Mobil forma izohlari yo'qolishi.** `.modal-head` butunlay yashirilgani uchun foydali izohlar ham ko'rinmasdi. Izohlar qaytarildi, to'liq sahifaga tegishli bo'lmagan dialog tutqichi olib tashlandi.
6. **Maydon fokusida avtomatik kattalashish xavfi.** Qidiruv va autentifikatsiya maydonlarining shriftlari 14 px edi; mobil holatda 16 px qilindi.
7. **Qatlamlar va planshet kartochkalari.** To'liq ekran flex qoidasi faqat ochiq dialogga qo'llanadi; formalar ochiqligida tashqi sahifa aylanishi to'xtatiladi. 600–820 px da kartochkalarning ikki ustunli gridini bosib ketgan flex qoidasi olib tashlandi.
8. **Planshetdagi logotip va panel sarlavhasi.** Logotipning flex ichida siqilishi to'xtatildi, yuqori paneldagi logo va nom bir qatorga keltirildi. 821–1100 px da sarlavha bilan amal tugmalari alohida qatorlarga o'tadi; tugmalar kerak bo'lganda o'raladi.

## Tekshiruv dalillari

- `npm test`: 53/53 o'tdi.
- Ommaviy sahifalar: home, services, family, menu, request, register; 320, 390, 430, 768, 820, 821, 1280 px — 42 holat. Gorizontal chiqish yo'q; mobil holatda bitta pastki menyu, desktopda mobil menyu yo'q.
- Rahbar, koordinator, mijoz va hamkor kabinetlari: 320, 600, 820, 821 px — 92 holat. Gorizontal chiqish va ko'rinadigan xato xabarlari yo'q. Jadval va tablarning o'z konteynerida gorizontal aylanishi saqlanadi.
- Forma qoralamasi: ism, telefon, izoh va rozilik 320 → 821 → 390 px almashganda saqlandi.
- Yuqori 44 px va pastki 34 px xavfsiz chet CSS orqali simulyatsiya qilindi: menyu elementlari sig'di, tashqi sahifada ortiqcha scroll yo'q, yuborish tugmasiga ichki scroll orqali yetib boriladi.
- Lotin/kirill tekshirildi; autentifikatsiya maydonlarida hisoblangan shrift 16 px. Brauzerning JavaScript xatolari ro'yxati bo'sh.
- O'zgartirilgan fayllarda `git diff --check` o'tdi.

Tekshiruv alohida PGlite bazali `node scripts/qa-server.mjs` orqali mahalliy Chromium brauzerida bajarildi. Haqiqiy iPhone/Android qurilmasida klaviatura va operatsion tizim xatti-harakati tekshirilmagan. Jonli saytga chiqarilmadi.

Tekshiruv skriptlari va JSON dalillar `.cache/repair-audit.mjs`, `.cache/repair-roles.mjs`, `.cache/repair-checks.mjs` va `.cache/repair1017/` ichida. Yakuniy tasvirlar: `after-home.png`, `after-register.png`, `after-family.png`, `after-cases-320.png`, `after-request-safe-area.png`, `after-register-cyr.png`, `after-overview-821.png`. `.cache` Git va tarqatishga kirmaydi.

## Qo'shimcha forma tuzatishlari

- Xodim murojaat yuborgach tasdiq oynasi qayta render bilan yopilib ketishi to'xtatildi. Mijozga beriladigan raqam va kalitni nusxalash tugmasi ochiq qoladi.
- Mobil dialog tarkibi yangilanganda yuqoridagi sahifa sarlavhasi ham yangilanadi.
- Xodim yaratish formasida ekran almashganda hamkor roli va tashkiloti tiklansa, tashkilot maydonining disabled/required holati ham tiklanadi.
- Ushbu holatlar alohida mahalliy brauzer sinovida tekshirildi; JavaScript xatolari yo'q. Tekshiruv: `.cache/remaining-checks.mjs`.
