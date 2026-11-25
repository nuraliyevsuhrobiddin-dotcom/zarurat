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
 received:{title:['Yangi murojaat','Янги мурожаат'],help:['Murojaat kelib tushdi. Mijozga hali qo‘ng‘iroq qilinmagan.','Мурожаат келиб тушди. Мижозга ҳали қўнғироқ қилинмаган.']},
 reviewing:{title:['Vaziyat aniqlanmoqda','Вазият аниқланмоқда'],help:['Mijoz bilan gaplashdingiz va qanday yordam kerakligini aniqlayapsiz.','Мижоз билан гаплашдингиз ва қандай ёрдам кераклигини аниқлаяпсиз.']},
 searching:{title:['Mutaxassis qidirilmoqda','Мутахассис қидирилмоқда'],help:['Mijozga mos mutaxassis yoki hamkorga qo‘ng‘iroq qilib izlayapsiz.','Мижозга мос мутахассис ёки ҳамкорга қўнғироқ қилиб излаяпсиз.']},
 arranging:{title:['Narx va vaqt kelishilmoqda','Нарх ва вақт келишилмоқда'],help:['Mijoz va mutaxassis bilan narx, vaqt va ish hajmi telefon orqali kelishilmoqda.','Мижоз ва мутахассис билан нарх, вақт ва иш ҳажми телефон орқали келишилмоқда.']},
 contacted:{title:['Mijoz va mutaxassis bog‘landi','Мижоз ва мутахассис боғланди'],help:['Mijozni mutaxassis bilan bog‘lab qo‘ydingiz. Natijani mijozdan telefon orqali so‘rang.','Мижозни мутахассис билан боғлаб қўйдингиз. Натижани мижоздан телефон орқали сўранг.']},
 completed:{title:['Bajarildi','Бажарилди'],help:['Mijozning masalasi hal bo‘lgach tanlang. Murojaat yopiladi.','Мижознинг масаласи ҳал бўлгач танланг. Мурожаат ёпилади.']},
 cancelled:{title:['Bekor qilindi','Бекор қилинди'],help:['Murojaat davom ettirilmaydi. Sababini ichki qaydga yozing.','Мурожаат давом эттирилмайди. Сабабини ички қайдга ёзинг.']}
};
export const sectionHelp = {
 overview:['Markazga tushgan murojaatlar va bajarilgan ishlarning umumiy hisobi.','Марказга тушган мурожаатлар ва бажарилган ишларнинг умумий ҳисоби.'],
 cases:['Mijozlarning murojaatlari. Mijozga qo‘ng‘iroq qiling va natijani belgilang.','Мижозларнинг мурожаатлари. Мижозга қўнғироқ қилинг ва натижани белгиланг.'],
 partners:['Koordinator telefon orqali bog‘lanadigan mutaxassis va tashkilotlar ro‘yxati.','Координатор телефон орқали боғланадиган мутахассис ва ташкилотлар рўйхати.'],
 clients:['Ro‘yxatdan o‘tgan mijozlar. Hisobsiz arizalar Murojaatlar bo‘limida.','Рўйхатдан ўтган мижозлар. Ҳисобсиз аризалар Мурожаатлар бўлимида.'],
 packages:['Faol obunalar, amal qilish muddati va maslahat limitlari.','Фаол обуналар, амал қилиш муддати ва маслаҳат лимитлари.'],
 notifications:['Yangi obunalar, murojaatlar va xabar yetkazish holati.','Янги обуналар, мурожаатлар ва хабар етказиш ҳолати.'],
 team:['Saytga kiradigan rahbar va koordinator hisoblari. Hisobni faqat rahbar ochadi.','Сайтга кирадиган раҳбар ва координатор ҳисоблари. Ҳисобни фақат раҳбар очади.']
};
export const copyTranslations=Object.fromEntries([...Object.values(categoryTitles),...Object.values(requestStatuses).map(s=>s.title)]);
