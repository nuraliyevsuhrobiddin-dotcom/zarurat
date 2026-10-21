import {randomInt} from 'node:crypto';
import {digest} from './security.mjs';
import {otpHash} from './account.mjs';
import {telegram} from './providers.mjs';
import {normalizePhone} from '../public/auth-input.js';

export async function handleContactRecovery(message,db,env){
 const rpc=(name,body)=>db(`rpc/${name}`,{method:'POST',body});
 const chat=message.chat.id;
 const start=String(message.text||'').match(/^\/start c_([a-f0-9]{48})$/);
 if(start){
  const opened=await rpc('zar_open_contact_recovery',{p_id:digest(start[1]),p_chat_id:chat});
  await telegram('sendMessage',{chat_id:chat,text:opened?'Parolni tiklash uchun «Telefon raqamimni ulashish» tugmasini bosing. Faqat o‘z Telegram raqamingizni yuboring.':'Havola eskirgan yoki ishlatilgan. Saytda tiklashni qayta boshlang.',reply_markup:opened?{keyboard:[[{text:'Telefon raqamimni ulashish',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}:{remove_keyboard:true}},env);
  return true;
 }
 if(!message.contact)return false;
 const rows=await db('telegram_recovery_contacts',{query:new URLSearchParams({select:'id',chat_id:`eq.${chat}`,consumed_at:'is.null',expires_at:`gt.${new Date().toISOString()}`,limit:'1'}).toString()});
 if(!rows.length)return false;
 const own=message.contact.user_id===message.from.id&&!message.forward_origin&&!message.forward_from&&!message.forward_from_chat&&!message.via_bot;
 const mobile=normalizePhone(message.contact.phone_number);
 let result,code;
 if(own&&/^\+998\d{9}$/.test(mobile)){
  code=String(randomInt(100000,1000000));
  result=await rpc('zar_contact_recovery',{p_id:rows[0].id,p_chat_id:chat,p_phone:mobile,p_code_hash:otpHash(rows[0].id,code,env)});
 }
 await telegram('sendMessage',{chat_id:chat,text:result?`ZARURIYAT parolni tiklash kodi: ${code}\nSaytga qaytib kodni kiriting. Kod 10 daqiqa amal qiladi. Uni hech kimga bermang.`:'Tiklash tasdiqlanmadi. O‘z kontaktingizni ulashing; raqam mijoz hisobidagi raqamga mos bo‘lishi kerak. Kod oldin kelgan bo‘lsa, undan foydalaning. Aks holda bir daqiqadan keyin saytda qayta boshlang yoki yordamga murojaat qiling.',...(result?{reply_markup:{remove_keyboard:true}}:{})},env);
 return true;
}
