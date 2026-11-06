# Ishga tushirish holati — 2026-11-06

## Qaror

Cheklangan nazorat sinoviga texnik asos tayyor. Katta reklama oqimiga tayyorlik hali tasdiqlanmagan: faol shartnomali hamkor yo‘q, haqiqiy mijoz bilan butun ish zanjiri jonli muhitda bajarilmagan.

## Hozir tasdiqlangan

- `npm run check:ready` qayta bajarildi: **barcha tekshiruvlar PASS**, jumladan **011 faol koordinator SQL tuzatishi**. Bu `.env` bilan ulangan masofaviy baza natijasi. Oldingi «011 hali yo‘q» holati endi shu ulanish uchun eskirgan.
- Jonli saytdagi Telegramning ikki bosqichli formasi, status endpointi va boshlang‘ich matn chaqnashi tuzatishlari saqlangan. Ochiq fayllar reliz nusxasiga mos va 200.
- Production Payme enabled=true, mode=live. Mahalliy konfiguratsiya test rejimida ekanligi bundan alohida.
- Jonli rahbar hisobiga vaqtinchalik kirish ishladi; o‘qish tugagach sessiya yopildi. 2 faol operator va 1 faol rahbar bor.
- Oxirgi to‘liq kod testi 137/137 o‘tgan. So‘nggi faqat HTML/startup tuzatishidan keyingi 3 SEO testi ham o‘tgan; qayta funksional o‘zgarish bo‘lmagani sababli butun to‘plam bu auditda yana takrorlanmadi.

## Ishga tushirishdan oldin hal qilinadiganlar

1. **5 hamkorning barchasi pending, faol shartnoma 0.** Reklama qilinadigan xizmatlar uchun haqiqiy hamkor va kelishilgan ish shartlari tasdiqlanishi kerak. Audit ularni avtomatik faollashtirmadi.
2. **18 ochiq murojaatning 18 tasi overdue, completed 0.** Sinov yozuvlari bo‘lishi mumkin; ularni haqiqiy ishlar bilan ajratish va haqiqiy ishlarning mas’ulini belgilash kerak. Ommaviy yopish/o‘chirish bajarilmadi.
3. **Jonli zanjirni haqiqiy ishtirokchilar bilan tasdiqlash:** telefon/Telegram ro‘yxati → murojaat → koordinatorning ko‘rishi va qo‘ng‘irog‘i → hamkor → yakun. Avvalgi muvaffaqiyatli to‘liq sinovlar alohida QA bazasi va mock Telegram transportida bajarilgan.
4. Agar reklama pullik paketga yo‘naltirilsa, haqiqiy karta to‘lovi va to‘lovdan saytga qaytish alohida kelishilgan nazorat sinovidan o‘tkazilishi kerak. Hozirgi live flag va kalit tekshiruvi haqiqiy pul yechish testi emas.

Xabarlar namunasida 20 queued, 6 recorded, 1 sent. Bu sonlar koordinatorga xabar yetib kelganini tasdiqlamaydi va o‘zi Telegram buzilganini ham isbotlamaydi; mijozning Telegram bog‘lanishi kabi yuborish shartlari bor.

Google Search Console’dagi egalik tasdig‘i va indekslash so‘rovi foydalanuvchi oynasidan hali tasdiqlanmagan. Bu saytni ishlatishga texnik to‘siq emas, Google orqali topilish bo‘yicha ochiq qadam. Haqiqiy hosting quvvati bo‘yicha ko‘p foydalanuvchili yuklama sinovi ham alohida qoladi.

Dalillar: `.cache/launch-1106/live-ops.json`, `npm run check:ready` natijasi, `.cache/registration-1106/live.json`, `startup-fix.json`. Tekshiruvda yangi haqiqiy mijoz/murojaat/to‘lov yoki tashqi xabar yaratilmagan.
