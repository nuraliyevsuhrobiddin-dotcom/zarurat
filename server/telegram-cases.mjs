import {telegramStatuses} from './telegram-status.mjs';
import {telegram} from './providers.mjs';
import {publicConfig} from '../public/supabase-api.js';

export const telegramCasesEnabled=env=>env.FEATURE_TELEGRAM_CASES==='true';
const keyboard=rows=>({keyboard:rows.map(row=>row.map(text=>({text}))),resize_keyboard:true,is_persistent:true,input_field_placeholder:'Kerakli bo‘limni tanlang'});
const menu=keyboard([['📝 Murojaat yuborish'],['📋 Murojaatlarim','🔎 Kuzatish'],['🗂 Xizmatlar','🌐 Shaxsiy kabinet'],['☎️ Aloqa','❓ Yordam']]);
const cancel=keyboard([['❌ Bekor qilish','🏠 Asosiy menyu']]);
const categoryIcons={legal:'⚖️',psychology:'💬',medical:'🩺',children:'🧒',elderly:'👴',women:'🌷',business:'💼',bank:'🏦',documents:'📄',nanny:'🧸',care:'🤝',cleaning:'🧹',repair:'🛠',other:'📌'};
const categoryLabel=c=>`${categoryIcons[c.id]||'📌'} ${c.name}`;
const pairs=items=>Array.from({length:Math.ceil(items.length/2)},(_,i)=>items.slice(i*2,i*2+2));
const categoryMenu=keyboard([...pairs(publicConfig.categories.map(categoryLabel)),['❌ Bekor qilish','🏠 Asosiy menyu']]);
const statusIcons={received:'📥',reviewing:'🔍',searching:'🤝',arranging:'📅',contacted:'📞',completed:'✅',cancelled:'⛔'};
const statusLabel=status=>`${statusIcons[status]||'🔔'} ${telegramStatuses[status]||'Yangilandi'}`;
const caseMenu=cases=>keyboard([...pairs(cases.map(c=>c.number)),['📋 Murojaatlarim','📝 Murojaat yuborish'],['🏠 Asosiy menyu']]);
export async function handleTelegramCases(m,db,env){
 if(!telegramCasesEnabled(env)||m.contact||String(m.text||'').startsWith('/start '))return false;
 const text=String(m.text||'').trim(),origin=new URL(env.PUBLIC_ORIGIN).origin;
 const send=(text,reply_markup=menu)=>telegram('sendMessage',{chat_id:m.chat.id,text,reply_markup},env);
 if(['/services','🗂 Xizmatlar'].includes(text)){
  await send('🗂 ZARURIYAT · Xizmatlar\n\n'+publicConfig.categories.map(categoryLabel).join('\n')+'\n\nXizmat hajmi, narxi va muddati koordinator bilan kelishiladi.\n\nMurojaat yuborish uchun pastdagi 📝 tugmasini bosing.');return true;
 }
 if(text==='🌐 Shaxsiy kabinet'){
  await send('🌐 Shaxsiy kabinet\n\nMurojaat tafsilotlari, hujjatlar va hisob sozlamalarini saytda ko‘ring.',{inline_keyboard:[[{text:'🌐 Kabinetni ochish',url:origin+'/#login'}],[{text:'🔑 Parolni tiklash',url:origin+'/#recovery'}]]});return true;
 }
 if(['/contact','☎️ Aloqa','🌐 Shaxsiy kabinet','❓ Yordam'].includes(text)){
  await send('ZARURIYAT\n/new — yangi murojaat\n/cases — so‘nggi 20 murojaat\n/track ZAR-000001 — holatini ko‘rish\n/rate ZAR-000001 5 Izoh — yakunlangan xizmatni baholash (1–5)\n/cancel — yuborilmagan qoralamani bekor qilish\n/menu — asosiy menyu\n/stop — Telegramni hisobdan uzish\n\nMurojaat yuborish va ko‘rish uchun mijoz hisobingizni saytdagi Hisob sozlamalari orqali Telegramga bog‘lang. Shaxsiy hujjat yoki parol yubormang.',{inline_keyboard:[[{text:'Shaxsiy kabinet',url:origin+'/#login'}],[{text:'Bog‘lanish va xizmatlar',url:origin+'/#home'}],[{text:'Parolni tiklash',url:origin+'/#recovery'}]]});return true;
 }
 // Private identity is checked again inside the transactional database function.
 if(!Number.isSafeInteger(m.message_id)||m.message_id<=0)return false;
 let action='text',value=text;
 const ratingButton=text.match(/^⭐ ([1-5]) ball · (ZAR-\d+)$/);
 const rating=ratingButton?[ratingButton[0],ratingButton[2],ratingButton[1],'']:text.match(/^\/rate\s+(ZAR-\d+)\s+([1-5])(?:\s+([\s\S]{0,1000}))?$/i);
 if(text.startsWith('/rate')&&!rating){await send('Baho yuborish: /rate ZAR-000001 5 Izoh\nFaqat yakunlangan o‘z murojaatingizni 1–5 ball bilan bir marta baholaysiz. Izoh 1000 belgigacha.');return true;}
 if(['/new','📝 Murojaat yuborish'].includes(text))action='new';
 else if(['/cases','📋 Murojaatlarim','/track','🔎 Kuzatish'].includes(text))action='list';
 else if(['/menu','🏠 Asosiy menyu','/cancel','❌ Bekor qilish'].includes(text))action=['/menu','🏠 Asosiy menyu'].includes(text)?'menu':'cancel';
 else if(rating){action='rate';value=JSON.stringify({number:rating[1].toUpperCase(),rating:Number(rating[2]),comment:rating[3]||''});}
 else if(text==='✅ Roziman, yuborish')action='submit';
 else if(/^\/track\s+/i.test(text)||/^ZAR-\d+$/i.test(text)){action='track';value=text.replace(/^\/track\s+/i,'').toUpperCase();}
 else{
  const category=publicConfig.categories.find(c=>c.name===text||c.id===text||categoryLabel(c)===text);
  if(category){action='category:'+category.id;value=text;}
 }
 const result=await db('rpc/zar_telegram_case_action',{method:'POST',body:{p_chat_id:m.chat.id,p_message_id:m.message_id,p_action:action,p_value:value}});
 const state=result?.state;
 if(state==='duplicate')return true;
 if(state==='unlinked')await send('Bu bo‘lim faqat Telegramga bog‘langan mijoz hisoblari uchun. Saytda ro‘yxatdan o‘ting yoki Hisob sozlamalari → Telegramni bog‘lash orqali ulang. Parolni unutgan bo‘lsangiz, saytdagi tiklash oynasidan boshlang.',{inline_keyboard:[[{text:'Ro‘yxatdan o‘tish',url:origin+'/#register'}],[{text:'Hisobga kirish',url:origin+'/#login'}],[{text:'🔑 Parolni unutdingizmi?',url:origin+'/#recovery'}]]});
 else if(state==='category')await send('📝 Yangi murojaat\n① Yo‘nalish  →  ② Vaziyat  →  ③ Tasdiqlash\n\nQaysi yo‘nalishda yordam kerak?\nPastdagi tugmalardan birini tanlang.\n\n⏳ Qoralama 30 daqiqa saqlanadi.',categoryMenu);
 else if(state==='description')await send('✍️ Vaziyatingizni yozing\n✓ Yo‘nalish  →  ② Vaziyat  →  ③ Tasdiqlash\n\nVaziyatni bitta matnli xabarda yozing (10–3500 belgi).\n\n👤 Ism va telefon bog‘langan hisobdan olinadi.\n📎 Hujjat, ovozli xabar va rasmlar uchun shaxsiy kabinetdan foydalaning.',cancel);
 else if(state==='confirm')await send('📨 Murojaatni tasdiqlash\n✓ Yo‘nalish  →  ✓ Vaziyat  →  ③ Tasdiqlash\n\nYo‘nalish: '+(publicConfig.categories.find(c=>c.id===result.category)?.name||result.category)+'\n\nYuborish orqali murojaatni ko‘rib chiqish, siz bilan bog‘lanish va zarur ma’lumotlarni xizmatni bajaruvchi hamkorga taqdim etish uchun shaxsiy ma’lumotlaringiz qayta ishlanishiga rozilik bildirasiz.\n\n💳 Murojaat yuborish avtomatik to‘lov emas.\n\nMurojaatni yuboramizmi?',keyboard([['✅ Roziman, yuborish'],['❌ Bekor qilish','🏠 Asosiy menyu']]));
 else if(state==='created')await send('✅ Murojaatingiz qabul qilindi!\n\n🎫 '+result.case.number+'\n'+statusLabel(result.case.status)+'\n\nKoordinator siz bilan bog‘lanadi.\nHolatini ko‘rish uchun pastdagi murojaat raqamini bosing.',caseMenu([result.case]));
 else if(state==='list')await send(result.cases.length?'📋 Mening murojaatlarim\n\n'+result.cases.map(c=>'🎫 '+c.number+'\n'+statusLabel(c.status)).join('\n\n')+'\n\nSo‘nggi 20 murojaat. Holatini ko‘rish uchun pastdagi raqamni bosing.':'📭 Hozircha murojaatlaringiz yo‘q.\n\n📝 Murojaat yuborish tugmasi orqali boshlang.',result.cases.length?caseMenu(result.cases):menu);
 else if(state==='case')await send('🎫 '+result.case.number+'\n\n'+statusLabel(result.case.status)+'\n\nTafsilotlar, hujjatlar va jarayon tarixi shaxsiy kabinetda: '+origin+'/#cabinet/cases'+(result.case.status==='completed'?'\n\n⭐ Xizmatni baholang: pastdagi 1–5 ball tugmasini tanlang.':''),result.case.status==='completed'?keyboard([...pairs([1,2,3,4,5].map(n=>`⭐ ${n} ball · ${result.case.number}`)),['📋 Murojaatlarim','🏠 Asosiy menyu']]):caseMenu([result.case]));
 else if(state==='rated')await send('Bahoyingiz saqlandi. Fikringiz uchun rahmat!');
 else if(state==='already_rated')await send('Bu murojaat uchun baho oldin saqlangan.');
 else if(state==='rating_unavailable')await send('Faqat o‘z hisobingizdagi yakunlangan murojaatni baholash mumkin.');
 else if(state==='missing')await send('Murojaat topilmadi yoki hisobingizga tegishli emas. /cases orqali o‘z murojaatlaringizni ko‘ring.');
 else if(state==='limited')await send('Bir soatda 5 tagacha murojaat yuborish mumkin. Keyinroq qayta urinib ko‘ring.',cancel);
 else if(state==='expired')await send('Qoralama muddati tugadi. /new orqali qayta boshlang.');
 else await send('🏠 ZARURIYAT · Asosiy menyu\n\nOilangiz uchun kerakli xizmatni birga tashkil qilamiz.\n\n📝 Murojaat yuborish — yangi so‘rov\n📋 Murojaatlarim — raqamlar va holatlar\n🗂 Xizmatlar — yordam yo‘nalishlari\n\nDavom etish uchun pastdagi tugmani tanlang.');
 return true;
}
