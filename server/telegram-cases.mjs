import {telegramStatusLabel as statusLabel} from './telegram-status.mjs';
import {telegram} from './providers.mjs';
import {publicConfig} from '../public/supabase-api.js';
import {siteContent} from '../public/site-content.js';
import {packageTiers} from '../public/package-tiers.js';
import {normalizePhone} from '../public/auth-input.js';

// Requests through the bot are on by default; FEATURE_TELEGRAM_CASES=false turns them off.
export const telegramCasesEnabled=env=>env.FEATURE_TELEGRAM_CASES!=='false';

// Mandatory channel membership before the bot menu, request flow and contacts.
export const requiredChannel=env=>String(env.TELEGRAM_REQUIRED_CHANNEL??siteContent.telegramChannel??'').trim().replace(/^(https?:\/\/)?t\.me\//i,'').replace(/^@/,'').replace(/[/?#].*$/,'');
export async function channelMember(userId,env){
 const channel=requiredChannel(env);
 if(!channel)return true;
 try{
  const member=await telegram('getChatMember',{chat_id:'@'+channel,user_id:userId},env);
  return ['creator','administrator','member'].includes(member?.status)||(member?.status==='restricted'&&member.is_member===true);
 }catch(error){
  // If the bot lost its channel admin right, people in need must still reach the centre.
  console.error(JSON.stringify({event:'telegram_channel_check_failure',status:error.providerStatus||null}));
  return true;
 }
}
const channelPrompt=env=>({
 text:'📢 Botdan foydalanish uchun ZARURIYAT CENTER kanaliga a’zo bo‘ling\n\n1️⃣ «📢 Kanalga qo‘shilish» tugmasini bosing va kanalda «Qo‘shilish» ni tanlang.\n2️⃣ Botga qaytib «✅ A’zo bo‘ldim» tugmasini bosing.',
 reply_markup:{inline_keyboard:[[{text:'📢 Kanalga qo‘shilish',url:`https://t.me/${requiredChannel(env)}`}],[{text:'✅ A’zo bo‘ldim',callback_data:'check_channel'}]]}
});

// Reply keyboards stay under the input field, so the bot works like a small app menu.
const keyboard=(rows,placeholder='Kerakli bo‘limni tanlang')=>({keyboard:rows.map(row=>row.map(item=>typeof item==='string'?{text:item}:item)),resize_keyboard:true,is_persistent:true,input_field_placeholder:placeholder});
const B={new:'📝 Murojaat yuborish',cases:'📋 Murojaatlarim',services:'🗂 Xizmatlar',tariffs:'💳 Tariflar',contact:'☎️ Aloqa',home:'🏠 Asosiy menyu',cancel:'❌ Bekor qilish',submit:'✅ Roziman, yuborish',phone:'📱 Raqamni yuborish'};
const menu=keyboard([[B.new],[B.cases,B.services],[B.tariffs,B.contact]]);
const cancel=keyboard([[B.cancel,B.home]],'Vaziyatni shu yerga yozing…');
const phoneRequest=keyboard([[{text:B.phone,request_contact:true}],[B.home]],'Pastdagi tugmani bosing');
const categoryIcons={legal:'⚖️',psychology:'💬',medical:'🩺',children:'🧒',elderly:'👴',women:'🌷',business:'💼',bank:'🏦',documents:'📄',nanny:'🧸',care:'🤝',cleaning:'🧹',repair:'🛠',other:'📌'};
const categoryLabel=c=>`${categoryIcons[c.id]||'📌'} ${c.name}`;
const pairs=items=>Array.from({length:Math.ceil(items.length/2)},(_,i)=>items.slice(i*2,i*2+2));
const categoryMenu=keyboard([...pairs(publicConfig.categories.map(categoryLabel)),[B.cancel,B.home]],'Yo‘nalishni tanlang');
const caseMenu=cases=>keyboard([...pairs(cases.map(c=>c.number)),[B.new,B.home]]);
const money=value=>String(value).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const categoryName=id=>publicConfig.categories.find(c=>c.id===id)?.name||id;
const steps=current=>['Yo‘nalish','Vaziyat','Tasdiqlash'].map((name,i)=>`${i<current?'✓':'①②③'[i]} ${name}`).join('  →  ');

const texts={
 menu:'🏠 ZARURIYAT · Asosiy menyu\n\nAssalomu alaykum! Qarshida oilangiz uchun kerakli mutaxassisni topib beramiz.\n\n📝 Murojaat yuborish — muammoingizni yozing, koordinator sizga qo‘ng‘iroq qiladi\n📋 Murojaatlarim — holatini kuzatish\n🗂 Xizmatlar — yordam yo‘nalishlari\n💳 Tariflar — oila obunasi narxlari\n☎️ Aloqa — telefon va manzil\n\nPastdagi menyudan tanlang 👇',
 phone:'📱 Telefon raqamingizni tasdiqlang\n\nMurojaat yuborish uchun bir marta raqamingizni yuboring — pastdagi «📱 Raqamni yuborish» tugmasini bosing.\n\n• Raqamni Telegram o‘zi tasdiqlaydi, kod kerak emas.\n• Shu raqam bilan ZARURIYAT hisobingiz ochiladi yoki mavjud hisobingiz ulanadi.\n• Koordinator aynan shu raqamga qo‘ng‘iroq qiladi.',
 category:`📝 Yangi murojaat\n${steps(0)}\n\nQaysi yo‘nalishda yordam kerak?\nPastdagi tugmalardan birini tanlang 👇\n\nBilmasangiz — «📌 Kerakli xizmatni aniqlash» ni tanlang.`,
 description:`✍️ Vaziyatingizni yozing\n${steps(1)}\n\nMuammoingizni bitta xabarda qisqacha yozing (kamida 10 belgi).\nMasalan: «Aliment bo‘yicha maslahat kerak, ertaga tushdan keyin qulay».\n\n🎙 Ovozli xabar va rasm qabul qilinmaydi — iltimos, matn bilan yozing.`
};

function servicesText(){
 return '🗂 ZARURIYAT · Xizmatlar\n\n'+publicConfig.categories.map(categoryLabel).join('\n')+'\n\nNarx va vaqt koordinator bilan oldindan kelishiladi.\nMurojaat yuborish uchun «📝 Murojaat yuborish» tugmasini bosing.';
}
function tariffsText(){
 const lines=packageTiers.map(t=>`⭐ ${t.name} — ${money(t.monthlyPrice)} so‘m / oy\n   👨‍👩‍👧 ${t.familyMembers} kishigacha · oyiga ${t.legalConsultations} huquqiy, ${t.psychologicalConsultations} psixolog${t.businessConsultations?`, ${t.businessConsultations} tadbirkorlik`:''} maslahati`);
 return `💳 Oila obunasi\n\n${lines.join('\n\n')}\n\n🎁 Har bir raqamga birinchi murojaat bepul. Keyingilari uchun faol obuna kerak.\n\nTo‘lash:\n• saytda istalgan Uzcard/Humo karta bilan;\n• Click, Uzum yoki bank ilovasidan markaz hisob raqamiga — keyin koordinatorga qo‘ng‘iroq qiling, obunani u yoqadi.`;
}
function contactText(){
 return `☎️ ZARURIYAT CENTER\n\n📞 ${siteContent.phone}\n📍 ${siteContent.address.lat}\n🕐 Murojaat qabul qilish: ${siteContent.hours.lat}\n\nKoordinator murojaatingiz bo‘yicha o‘zi qo‘ng‘iroq qiladi. Shoshilinch bo‘lsa, yuqoridagi raqamga qo‘ng‘iroq qiling.`;
}
const contactButtons=origin=>({inline_keyboard:[[{text:'🗺 Xaritada ochish',url:siteContent.mapUrl}],[{text:'🌐 Sayt va kabinet',url:origin+'/#login'}],[{text:'🔑 Parolni tiklash',url:origin+'/#recovery'}]]});
const contactResults={
 foreign_phone:`Hozircha faqat O‘zbekiston (+998) raqamlari qabul qilinadi. Markazga qo‘ng‘iroq qiling: ${siteContent.phone}`,
 staff:'Bu raqam xodim hisobiga tegishli. Xodimlar ishni saytdagi kabinetda bajaradi.',
 other_chat:'Bu raqam boshqa Telegram hisobiga ulangan. Avvalgi Telegramdan /stop yuboring yoki markazga qo‘ng‘iroq qiling.',
 unavailable:`Hisobni ulab bo‘lmadi. Markazga qo‘ng‘iroq qiling: ${siteContent.phone}`,
 invalid:'Raqamni qabul qilib bo‘lmadi. Qaytadan urinib ko‘ring.'
};

// The «✅ A’zo bo‘ldim» button: check again, then open the main menu.
export async function handleChannelCheck(query,env){
 const chat=query.message.chat.id;
 const answer=body=>telegram('answerCallbackQuery',{callback_query_id:query.id,...body},env).catch(()=>{});
 if(!await channelMember(query.from.id,env)){
  await answer({text:'Siz hali kanalga a’zo bo‘lmadingiz. Avval «📢 Kanalga qo‘shilish» tugmasini bosing.',show_alert:true});
  return;
 }
 await answer({text:'✅ Rahmat!'});
 await telegram('editMessageText',{chat_id:chat,message_id:query.message.message_id,text:'✅ Rahmat! Siz ZARURIYAT CENTER kanaliga a’zo bo‘ldingiz.'},env).catch(()=>{});
 await telegram('sendMessage',{chat_id:chat,text:texts.menu,reply_markup:menu},env);
}
export async function handleTelegramCases(m,db,env){
 if(!telegramCasesEnabled(env)||String(m.text||'').startsWith('/start '))return false;
 const text=String(m.text||'').trim(),origin=new URL(env.PUBLIC_ORIGIN).origin;
 const send=(text,reply_markup=menu)=>telegram('sendMessage',{chat_id:m.chat.id,text,reply_markup},env);
 if(!await channelMember(m.from?.id,env)){const prompt=channelPrompt(env);await send(prompt.text,prompt.reply_markup);return true;}
 const rpc=(name,body)=>db(`rpc/${name}`,{method:'POST',body});
 if(['/services',B.services].includes(text)){await send(servicesText());return true;}
 if(['/tariffs','/tarif',B.tariffs].includes(text)){await send(tariffsText(),{inline_keyboard:[[{text:'💳 Tarifni tanlash',url:origin+'/#family'}]]});return true;}
 // Older keyboards may still show the removed help and cabinet buttons.
 if(['/contact','/help',B.contact,'❓ Yordam','🌐 Shaxsiy kabinet'].includes(text)){await send(contactText(),contactButtons(origin));return true;}
 if(!Number.isSafeInteger(m.message_id)||m.message_id<=0)return false;
 const caseAction=(action,value='')=>rpc('zar_telegram_case_action',{p_chat_id:m.chat.id,p_message_id:m.message_id,p_action:action,p_value:value});
 let result,linkedNow=false;
 if(m.contact){
  // Only the sender's own, non-forwarded contact proves the phone number.
  const own=m.contact.user_id===m.from?.id&&!m.forward_origin&&!m.forward_from&&!m.forward_from_chat&&!m.via_bot;
  if(!own){await send('Iltimos, pastdagi «📱 Raqamni yuborish» tugmasi orqali o‘zingizning raqamingizni yuboring.',phoneRequest);return true;}
  const name=[m.contact.first_name,m.contact.last_name].filter(Boolean).join(' ')||[m.from?.first_name,m.from?.last_name].filter(Boolean).join(' ');
  const account=await rpc('zar_telegram_contact_account',{p_chat_id:m.chat.id,p_phone:normalizePhone(m.contact.phone_number),p_name:name});
  if(!['linked','created'].includes(account?.state)){await send(contactResults[account?.state]||contactResults.invalid,menu);return true;}
  linkedNow=account.state;
  result=await caseAction('new');
 }else{
  let action='text',value=text;
  const ratingButton=text.match(/^⭐ ([1-5]) ball · (ZAR-\d+)$/);
  const rating=ratingButton?[ratingButton[0],ratingButton[2],ratingButton[1],'']:text.match(/^\/rate\s+(ZAR-\d+)\s+([1-5])(?:\s+([\s\S]{0,1000}))?$/i);
  if(text.startsWith('/rate')&&!rating){await send('Baho yuborish: /rate ZAR-000001 5 Izoh\nFaqat yakunlangan o‘z murojaatingizni 1–5 ball bilan bir marta baholaysiz.');return true;}
  if(['/new',B.new].includes(text))action='new';
  else if(['/cases',B.cases,'/track','🔎 Kuzatish'].includes(text))action='list';
  else if(['/menu',B.home].includes(text))action='menu';
  else if(['/cancel',B.cancel].includes(text))action='cancel';
  else if(rating){action='rate';value=JSON.stringify({number:rating[1].toUpperCase(),rating:Number(rating[2]),comment:rating[3]||''});}
  else if(text===B.submit)action='submit';
  else if(/^\/track\s+/i.test(text)||/^ZAR-\d+$/i.test(text)){action='track';value=text.replace(/^\/track\s+/i,'').toUpperCase();}
  else{
   const category=publicConfig.categories.find(c=>c.name===text||c.id===text||categoryLabel(c)===text);
   if(category){action='category:'+category.id;value=text;}
  }
  result=await caseAction(action,value);
  if(result?.state==='unlinked'){
   // Guests can read the menu; anything personal starts with phone confirmation.
   if(['menu','cancel'].includes(action))await send(texts.menu);
   else await send(texts.phone,phoneRequest);
   return true;
  }
 }
 const state=result?.state;
 if(state==='duplicate')return true;
 if(linkedNow)await send(linkedNow==='created'?'✅ Raqamingiz tasdiqlandi va ZARURIYAT hisobingiz ochildi.\nSaytga kirish kerak bo‘lsa, «Parolni tiklash» orqali parol o‘rnatasiz.':'✅ Raqamingiz tasdiqlandi. ZARURIYAT hisobingiz shu Telegramga ulandi.',{remove_keyboard:true});
 if(state==='unlinked')await send(texts.phone,phoneRequest);
 else if(state==='category')await send(texts.category,categoryMenu);
 else if(state==='description')await send(texts.description,cancel);
 else if(state==='confirm')await send(`📨 Murojaatni tekshiring\n${steps(2)}\n\n🗂 Yo‘nalish: ${categoryName(result.category)}\n✍️ Vaziyat: ${result.description||'—'}\n👤 Ism: ${result.name||'—'}\n📞 Telefon: ${result.phone||'—'}\n\nYuborish orqali murojaatni ko‘rib chiqish, siz bilan bog‘lanish va zarur ma’lumotlarni xizmat ko‘rsatuvchiga berish uchun shaxsiy ma’lumotlaringiz qayta ishlanishiga rozilik bildirasiz.\n\nHammasi to‘g‘rimi?`,keyboard([[B.submit],[B.cancel,B.home]]));
 else if(state==='created')await send(`✅ Murojaatingiz qabul qilindi!\n\n🎫 ${result.case.number}\n${statusLabel(result.case.status)}\n\n📞 Koordinator tez orada sizga qo‘ng‘iroq qiladi — telefoningiz yoqiq tursin.\n🔔 Holat o‘zgarsa, shu yerga xabar keladi.`,caseMenu([result.case]));
 else if(state==='list')await send(result.cases.length?'📋 Mening murojaatlarim\n\n'+result.cases.map(c=>`🎫 ${c.number}\n${statusLabel(c.status)}`).join('\n\n')+'\n\nBatafsil ko‘rish uchun pastdagi raqamni bosing 👇':'📭 Hozircha murojaatlaringiz yo‘q.\n\n«📝 Murojaat yuborish» tugmasi orqali boshlang.',result.cases.length?caseMenu(result.cases):menu);
 else if(state==='case')await send(`🎫 ${result.case.number}\n\n${statusLabel(result.case.status)}\n\nTafsilotlar va jarayon tarixi shaxsiy kabinetda: ${origin}/#cabinet/cases`+(result.case.status==='completed'?'\n\n⭐ Xizmatni baholang: pastdagi 1–5 ball tugmasini tanlang.':''),result.case.status==='completed'?keyboard([...pairs([1,2,3,4,5].map(n=>`⭐ ${n} ball · ${result.case.number}`)),[B.cases,B.home]]):caseMenu([result.case]));
 else if(state==='rated')await send('⭐ Bahoyingiz saqlandi. Fikringiz uchun rahmat!');
 else if(state==='already_rated')await send('Bu murojaat uchun baho oldin saqlangan.');
 else if(state==='rating_unavailable')await send('Faqat o‘z hisobingizdagi yakunlangan murojaatni baholash mumkin.');
 else if(state==='missing')await send('Murojaat topilmadi yoki hisobingizga tegishli emas. «📋 Murojaatlarim» orqali o‘z murojaatlaringizni ko‘ring.');
 else if(state==='subscription_required')await send(`💳 Bu raqam uchun birinchi bepul murojaat ishlatilgan. Keyingi murojaat uchun faol obuna kerak.\n\nMurojaatingiz saqlab qo‘yildi. Obuna yoqilgach «${B.submit}» tugmasini qayta bosing.\n\nTo‘lash: saytda karta bilan yoki Click/Uzum orqali markaz hisob raqamiga, keyin koordinatorga qo‘ng‘iroq qiling: ${siteContent.phone}`,{inline_keyboard:[[{text:'💳 Tariflar',url:origin+'/#family'}],[{text:'🔑 Saytga kirish uchun parol',url:origin+'/#recovery'}]]});
 else if(state==='limited')await send('Bir soatda 5 tagacha murojaat yuborish mumkin. Keyinroq qayta urinib ko‘ring.',cancel);
 else if(state==='expired')await send('⏳ Qoralama muddati tugadi. «📝 Murojaat yuborish» orqali qayta boshlang.');
 else await send(texts.menu);
 return true;
}
