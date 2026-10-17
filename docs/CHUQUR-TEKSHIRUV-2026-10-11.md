# Chuqur tekshiruv va tuzatishlar

Sinovlar alohida, xotiradagi PostgreSQL bazasida bajarildi. Jonli foydalanuvchi, murojaat va xodim hisoblariga sinov yozuvlari kiritilmadi.

## Tuzatilgan kamchiliklar

1. **Hisob almashganda yashirin filtr qolishi.** Rahbar «Yakunlangan»ni tanlagach boshqa mijoz hisobiga kirganda uning faol murojaati ko‘rinmay qolardi. Yangi kirish va sessiya tugashida filtrlar, sahifalash va xususiy kabinet keshi tozalanadi. Oldin: API bitta o‘z murojaatini qaytaradi, ekranda nol; keyin: shu murojaat ko‘rinadi. Dalil: `.cache/deep-audit/screenshots/account-filter-before.png`, `account-filter-after.png`.
2. **Mobil forma ustidagi pastki menyu.** Uzun ro‘yxatdan o‘tish formasidagi yuborish tugmasi menyu bilan to‘qnashardi. Endi menyu dialog ichida o‘z joyini egallaydi; forma alohida aylantiriladi. Yuborish tugmalari 320/390/430/820/821/1280 ekranlarda tekshirildi.
3. **Muddatni olib tashlashning noto‘g‘ri muvaffaqiyati.** Baza imkoniyati yoqilmagan holatda bo‘sh muddat yuborilmas, eski sana qolardi. Endi foydalanuvchiga aniq xabar chiqadi va boshqa o‘zgarishlar ham yashirincha saqlanmaydi. Baza imkoniyati yoqilganda muddatni tozalash ishlashi alohida tekshirildi. Dalil: `legacy-date-before.png`, `legacy-date-after.png`.
4. **Buzilgan yozuvlar.** «Xizmat yo?nalishi», «Muddati o?tgan» va maxfiylik havolasidagi `?` belgilar to‘g‘rilandi; kirill tarjimalari qo‘shildi.
5. **Hisobsiz murojaat yo‘qolgandek ko‘rinishi.** Bo‘sh mijoz kabineti va murojaatlar ro‘yxatiga tushuntirish va oldingi murojaatni raqam/maxfiy kalit bilan kuzatish tugmasi qo‘shildi. Telefonning o‘zi bilan begona murojaatni hisobga biriktirish amalga oshirilmaydi.

## Tekshirilgan jarayonlar

- 49 ta sahifa/rol holati: ommaviy sahifalar, rahbar, koordinator, mijoz va mutaxassis kabinetlari. Gorizontal chiqish, ortiqcha ko‘rinadigan mobil menyu va nomlanmagan forma maydonlari aniqlanmadi.
- Xizmat tanlash → noto‘g‘ri telefon rad etilishi → haqiqiy sinov murojaati → kuzatish. Qoralama, rozilik, kategoriya, kuzatish kaliti va kuzatish natijasi ekran almashganda saqlandi.
- Qo‘shimcha boshqaruv maydonlari, eski va yangilangan baza imkoniyatlari, hisob almashish, ro‘yxatdan o‘tish va uzun formalar.
- Kompyuterda Escape orqali tafsilotlarni yopib, ro‘yxatga qaytish ishlaydi.
- Tanlangan forma/kabinetlarda axe tekshiruvi: 0 aniq violation. Gradient va ko‘rinish sohasi sabab ayrim kontrast tekshiruvlari avtomatik aniqlanmagan; bu son «barcha sahifalarda to‘liq accessibility sertifikati» degani emas.
- 45/45 avtomatik sinov o‘tdi, jumladan rol/ruxsatlar, mijoz egaligi, xizmatlarni yakunlash, hisob keshi va muddat cheklovi.

## Amaldagi cheklovlar

Jonli 003 migratsiyasi hanuz qo‘llanmagan. Shu sabab qo‘shimcha aniqlashtirish maydonlari yashiriladi va mavjud muddatni olib tashlash aniq xabar bilan cheklanadi. SMS/Telegram hali ulanmagan. Koordinatorlar avvalgi ruxsat bilan umumiy murojaatlar ro‘yxatini ko‘ra oladi; ushbu tekshiruv ruxsat siyosatini o‘zgartirmadi.

QA dalillari va marshrut ma’lumotlari `.cache/deep-audit/` papkasida, jonli tarqatiladigan fayllardan tashqarida saqlanadi.

## Jonli tekshiruv

Tuzatishlar https://zarurat-inky.vercel.app saytiga chiqarildi: dpl_4fWXk3JgX93HVbiF1edmAwcnBVie. Oltita yangilangan faylning jonli nusxasi SHA-256 bilan solishtirildi; `/api/health` muvaffaqiyatli javob berdi. Jonli ro‘yxatdan o‘tish sahifasida menyu forma aylanish sohasidan tashqarida ekanligi, yuborish tugmasi bosish uchun ochiqligi va gorizontal chiqish yo‘qligi tekshirildi. Jonli sahifada yuborish tugmasi bosilmadi va hisob ochilmadi.
