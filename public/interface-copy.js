// Display text only; existing request IDs and access rules stay stable.
export const categoryTitles = {
 legal:['Huquqiy maslahat','Ҳуқуқий маслаҳат'], psychology:['Psixologik maslahat','Психологик маслаҳат'],
 medical:['Shifokorga yo‘naltirish','Шифокорга йўналтириш'], children:['Bolalar uchun yordam','Болалар учун ёрдам'],
 elderly:['Keksalar uchun yordam','Кексалар учун ёрдам'], women:['Ayollar uchun yordam','Аёллар учун ёрдам'],
 business:['Tadbirkorlik bo‘yicha maslahat','Тадбиркорлик бўйича маслаҳат'], bank:['Bank va kredit bo‘yicha maslahat','Банк ва кредит бўйича маслаҳат'],
 documents:['Hujjatlar bo‘yicha yordam','Ҳужжатлар бўйича ёрдам'], nanny:['Enaga topish','Энага топиш'],
 care:['Qarovchi topish','Қаровчи топиш'], cleaning:['Uy tozalash','Уй тозалаш'],
 repair:['Usta va ta’mirlash','Уста ва таъмирлаш'], other:['Kerakli xizmatni aniqlash','Керакли хизматни аниқлаш']
};
export const requestStatuses = {
 received:{title:['Yangi murojaat','Янги мурожаат'],help:['Murojaat kelib tushdi. Mijoz bilan hali gaplashilmagan.','Мурожаат келиб тушди. Мижоз билан ҳали гаплашилмаган.']},
 reviewing:{title:['Vaziyat aniqlanmoqda','Вазият аниқланмоқда'],help:['Mijoz bilan gaplashib, qanday yordam kerakligini aniqlayapsiz.','Мижоз билан гаплашиб, қандай ёрдам кераклигини аниқлаяпсиз.']},
 searching:{title:['Mutaxassis qidirilmoqda','Мутахассис қидирилмоқда'],help:['Mijozga mos mutaxassis yoki xizmat ko‘rsatuvchi izlanmoqda.','Мижозга мос мутахассис ёки хизмат кўрсатувчи изланмоқда.']},
 arranging:{title:['Narx va vaqt kelishilmoqda','Нарх ва вақт келишилмоқда'],help:['Mijoz va mutaxassis bilan narx, vaqt va ish hajmi kelishilmoqda.','Мижоз ва мутахассис билан нарх, вақт ва иш ҳажми келишилмоқда.']},
 contacted:{title:['Mijoz va mutaxassis bog‘landi','Мижоз ва мутахассис боғланди'],help:['Mijoz va mutaxassis o‘rtasida aloqa o‘rnatildi. Xizmat natijasi hali kutilmoqda.','Мижоз ва мутахассис ўртасида алоқа ўрнатилди. Хизмат натижаси ҳали кутилмоқда.']},
 completed:{title:['Bajarildi','Бажарилди'],help:['Barcha faol xizmatlar yakunlangan bo‘lsa tanlang. Murojaat yopiladi.','Барча фаол хизматлар якунланган бўлса танланг. Мурожаат ёпилади.']},
 cancelled:{title:['Bekor qilindi','Бекор қилинди'],help:['Murojaat davom ettirilmaydi. Sababini ichki qaydga yozing.','Мурожаат давом эттирилмайди. Сабабини ички қайдга ёзинг.']}
};
export const sectionHelp = {
 overview:['Markazga tushgan murojaatlar va bajarilgan ishlarning umumiy hisobi.','Марказга тушган мурожаатлар ва бажарилган ишларнинг умумий ҳисоби.'],
 cases:['Mijozlarning arizalari. Mas’ul xodimni belgilang va ish holatini yangilang.','Мижозларнинг аризалари. Масъул ходимни белгиланг ва иш ҳолатини янгиланг.'],
 partners:['Xizmat ko‘rsatuvchi mutaxassis va tashkilotlar ro‘yxati.','Хизмат кўрсатувчи мутахассис ва ташкилотлар рўйхати.'],
 clients:['Ro‘yxatdan o‘tgan mijozlar. Hisobsiz arizalar Murojaatlar bo‘limida.','Рўйхатдан ўтган мижозлар. Ҳисобсиз аризалар Мурожаатлар бўлимида.'],
 packages:['Mijozning paketi, muddati va qolgan murojaatlar soni. Bu bo‘lim pul yechmaydi.','Мижознинг пакети, муддати ва қолган мурожаатлар сони. Бу бўлим пул ечмайди.'],
 notifications:['Tayyorlangan xabarlar va yuborish holati. SMS yuborish oynasi emas.','Тайёрланган хабарлар ва юбориш ҳолати. SMS юбориш ойнаси эмас.'],
 team:['Saytga kiradigan rahbar, koordinator va hamkor hisoblari. Hisobni faqat rahbar ochadi.','Сайтга кирадиган раҳбар, координатор ва ҳамкор ҳисоблари. Ҳисобни фақат раҳбар очади.']
};
export const copyTranslations=Object.fromEntries([...Object.values(categoryTitles),...Object.values(requestStatuses).map(s=>s.title)]);
