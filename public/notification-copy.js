import {requestStatuses} from './interface-copy.js';

export function notificationCopy(row,script='lat') {
 const pick=values=>values[script==='cyr'?1:0];
 const event=row.event;
 const activity={
  'case.assignment_changed':{title:['Mas’ul xodim o‘zgardi','Масъул ходим ўзгарди'],body:['Murojaatni kim boshqarishini tafsilotlardan tekshiring.','Мурожаатни ким бошқаришини тафсилотлардан текширинг.']},
  'case.deadline_changed':{title:['Bajarish muddati o‘zgardi','Бажариш муддати ўзгарди'],body:['Belgilangan vaqt tafsilotlardagi Qo‘shimcha ma’lumotlarda ko‘rsatiladi.','Белгиланган вақт тафсилотлардаги Қўшимча маълумотларда кўрсатилади.']},
  'case.clarified':{title:['Mijoz ma’lumotlari aniqlashtirildi','Мижоз маълумотлари аниқлаштирилди'],body:['Kerakli xizmat, hudud yoki qulay vaqt yangilandi. Murojaat tafsilotlarini oching.','Керакли хизмат, ҳудуд ёки қулай вақт янгиланди. Мурожаат тафсилотларини очинг.']},
  'package.used':{title:['Oila paketidan foydalanildi','Оила пакетидан фойдаланилди'],body:['Bajarilgan murojaat paket hisobiga kiritildi. Qolgan limitni Oila paketlari bo‘limidan ko‘ring.','Бажарилган мурожаат пакет ҳисобига киритилди. Қолган лимитни Оила пакетлари бўлимидан кўринг.']}
 };
 if(activity[event])return {title:pick(activity[event].title),body:pick(activity[event].body)};
 const changed=['case.status_changed','status_changed','case_updated'].includes(event);
 const match=changed?String(row.message||'').match(/:\s*(received|reviewing|searching|arranging|contacted|completed|cancelled)\s*$/):null;
 const status=match?.[1]||(event==='completed'?'completed':null);
 if(status==='completed')return {title:pick(['Ish bajarildi','Иш бажарилди']),body:pick(['Murojaat yopildi. U Murojaatlar → Yakunlangan murojaatlar bo‘limida saqlanadi. Mijoz hisobi va ish tarixi o‘chmaydi.','Мурожаат ёпилди. У Мурожаатлар → Якунланган мурожаатлар бўлимида сақланади. Мижоз ҳисоби ва иш тарихи ўчмайди.'])};
 if(status==='cancelled')return {title:pick(['Murojaat bekor qilindi','Мурожаат бекор қилинди']),body:pick(['Murojaat to‘xtatildi. Sababi ichki qaydlarda, yozuv esa Barcha murojaatlar ro‘yxatida qoladi.','Мурожаат тўхтатилди. Сабаби ички қайдларда, ёзув эса Барча мурожаатлар рўйхатида қолади.'])};
 if(status)return {title:pick(['Murojaat holati yangilandi','Мурожаат ҳолати янгиланди']),body:pick(requestStatuses[status].title)};
 if(['request.created','created','request_created','case_created'].includes(event))return {title:pick(['Yangi murojaat keldi','Янги мурожаат келди']),body:pick(['Murojaatlar → Yangi murojaatlar bo‘limini oching. Mas’ul xodimni belgilang va mijoz bilan bog‘laning.','Мурожаатлар → Янги мурожаатлар бўлимини очинг. Масъул ходимни белгиланг ва мижоз билан боғланинг.'])};
 if(event==='service.assigned')return {title:pick(['Murojaatga xizmat qo‘shildi','Мурожаатга хизмат қўшилди']),body:pick(['Xizmatlar bo‘limida mutaxassis, narx va bajarish holatini tekshiring.','Хизматлар бўлимида мутахассис, нарх ва бажариш ҳолатини текширинг.'])};
 if(['service.status_changed','service_updated'].includes(event))return {title:pick(['Xizmat holati yangilandi','Хизмат ҳолати янгиланди']),body:pick(['Murojaat tafsilotlaridagi Xizmatlar bo‘limini oching. Barcha xizmatlar tugagach murojaatni Bajarildi deb yoping.','Мурожаат тафсилотларидаги Хизматлар бўлимини очинг. Барча хизматлар тугагач мурожаатни Бажарилди деб ёпинг.'])};
 return {title:pick(['Murojaat bo‘yicha xabar','Мурожаат бўйича хабар']),body:row.message||pick(['Murojaat tafsilotlarini oching.','Мурожаат тафсилотларини очинг.'])};
}
