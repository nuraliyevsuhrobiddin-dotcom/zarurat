# ZARURIYAT — aniqlashtirilgan talablar

Manba: foydalanuvchi taqdim etgan `зарурият.docx`. Undagi loyiha talablari mahsulot uchun manba sifatida olindi. Interfeys tili foydalanuvchi tanloviga ko‘ra o‘zbek lotin yozuvi.

## Jarayon

Mijoz → murojaat va keys raqami → koordinator → bir yoki bir nechta xizmat → hamkor → natija → mijoz bahosi.

Murojaat va keys ushbu MVPda bitta yozuv hisoblanadi. Shuning uchun bitta raqam bo‘yicha barcha xizmatlar kuzatiladi, alohida ikkinchi keys raqami yaratilmaydi.

## Manba talablarining bajarilishi

| Talab | Dastlabki versiya |
|---|---|
| Ochiq sayt va 14 yo‘nalish | Mavjud |
| Yo‘nalishni aniqlashda yordam | Boshqa yo‘nalishiga murojaat shakli |
| Murojaat, hujjat/foto/ovoz | Mavjud; 3 fayl, har biri 5 MB gacha |
| Avtomatik raqam va holat | Mavjud; maxfiy kod bilan himoyalangan |
| Mijoz kabineti | Ro‘yxatdan o‘tish, o‘z murojaatlari va paketlari |
| Operator kabineti | Barcha keyslar, filtrlash, muddat va mas’ullar |
| Bitta keysda bir nechta xizmat | Mavjud |
| Hamkorlar bazasi | Mavjud; hisob lokal administrator buyrug‘i bilan ochiladi |
| Hamkor kabineti | Faqat biriktirilgan xizmatlar, ketma-ket holatlar |
| Oila paketi va limit | Mavjud; operator qaydi, 1 keys = 1 birlik |
| Rahbar kabineti | Murojaatlar, muddatlar, yo‘nalishlar, mijoz va hamkor statistikasi |
| Baho va izoh | Yakunlangach, bir marta |
| Telegram | Xabarlar navbati mavjud; botga jo‘natish adapteri keyingi bosqich |
| Telefon uchun mos veb-sayt | Adaptiv interfeys |
| Android/iOS va katta AI | Ushbu bosqichga kiritilmadi |

## Hujjatda yetishmagan, amalga oshirilgan jihatlar

1. **Ruxsatlar chegarasi.** Mijoz boshqa mijozning murojaatini ko‘ra olmaydi. Hamkor faqat o‘ziga berilgan xizmatlarni ko‘radi. Bular serverda tekshiriladi.
2. **Kuzatish maxfiyligi.** Ketma-ket raqamning o‘zi yetarli emas; tasodifiy maxfiy kod ham talab etiladi. Kod brauzer URL manziliga yozilmaydi.
3. **Rozilik.** Murojaat va hisob yaratishda rozilik talab qilinadi, murojaatda rozilik vaqti saqlanadi.
4. **SLA boshlang‘ich qoidasi.** Yangi murojaatning nazorat muddati 24 soat. Bu xizmatning kafolatlangan bajarilish vaqti emas; koordinator uni o‘zgartiradi.
5. **Nazorat tarixi.** Holat, mas’ul, muddat, xizmat, paket va ichki izohlarning muallifi hamda vaqti saqlanadi. Ichki izohlar mijozga ko‘rsatilmaydi.
6. **Yakunlash qoidasi.** Kamida bitta faol xizmat bo‘lishi va barcha faol xizmatlar tugashi kerak. Yakunlangan keys qayta ochilmaydi.
7. **Bekor qilish.** Operator sabab yozishi kerak; hali tugamagan xizmatlar bekor qilinadi.
8. **Hamkor shartnomasi.** Faqat faol shartnomali hamkorga yangi xizmat biriktiriladi. Boshlangan xizmat hamkori yashirin almashtirilmaydi.
9. **Paket himoyasi.** Muddati tugagan yoki limiti qolmagan paketdan foydalanish mumkin emas; ayni keysni ikki marta sanashga yo‘l qo‘yilmaydi.
10. **Kiritmalarni tekshirish.** Telefon formati, matn uzunligi, fayl turi/tarkibi/hajmi va ruxsat etilgan holatlar tekshiriladi.
11. **Kirish himoyasi.** Xeshlangan parol, muddati cheklangan server sessiyasi, chiqishda sessiyani bekor qilish, so‘rovlar chastotasi va boshqa saytdan soxta so‘rovlarni cheklash.
12. **Zaxiralash.** Bazadan izchil zaxira nusxa olish buyrug‘i qo‘shildi.

## Ishga chiqarishdan oldin hal qilinadigan biznes masalalari

- Xizmat hududlari, haqiqiy ish vaqti, operator navbatchiligi va javob muddatlari.
- Platforma daromadi: koordinatsiya haqi, hamkor komissiyasi yoki abonement. Narx kim tomonidan tasdiqlanishi va bekor qilinganda hisob-kitob qoidasi.
- Hamkorni tekshirish, malaka hujjatlari, shartnomani kim tasdiqlashi va shikoyatlarni ko‘rib chiqish.
- Paketdagi limit nimani anglatishi: murojaat, alohida xizmat, vaqt yoki mablag‘. Hozirgi 1 keys = 1 birlik qoidasi dastlabki ishchi qaror.
- Mijoz ma’lumotlarini qancha saqlash, kim o‘chira olishi, arxiv muddati va rozilikning yakuniy matni.
- Shoshilinch holatni ajratish va operatorga yetkazish tartibi. Sayt tezkor favqulodda xizmat o‘rnini bosa olmaydi; platforma ichida avtomatik favqulodda dispatch mavjud emas.

## Keyingi texnik ishlar

1. Telefonni SMS/OTP bilan tasdiqlash va xavfsiz parol tiklash.
2. Telegram botni faqat tasdiqlangan mijoz chatiga bog‘lash; retry, jo‘natildi/xato holatlari, dublikatlardan himoya. Shaxsiy tafsilotlarni ochiq guruhlarga yubormaslik.
3. Paket davrlari, hisob-kitob, to‘lov va qaytarish qoidalari asosida billing.
4. Hamkor va xodim hisoblarini yaratish/bloklash uchun rahbar interfeysi.
5. Ma’lumot eksporti/o‘chirish, fayllarni zararli tarkibga tekshirish, avtomatik zaxira va zaxiradan tiklash sinovi.
6. HTTPS bilan joylashtirish, monitoring, katta ma’lumotlar uchun sahifalash va yuklama sinovlari.

Bu ishlar tayyor funksiyalar sifatida ko‘rsatilmaydi; kodning amaldagi chegaralari README’da ham yozilgan.
