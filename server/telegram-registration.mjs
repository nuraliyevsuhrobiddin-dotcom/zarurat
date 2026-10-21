import {randomBytes} from 'node:crypto';
import {HttpError} from './db.mjs';
import {digest,rateLimit} from './security.mjs';
import {phone,fail} from './validation.mjs';
import {telegramReady,telegram} from './providers.mjs';
import {normalizePhone} from '../public/auth-input.js';

export const registrationTelegramRequired=env=>env.FEATURE_TELEGRAM_REGISTRATION==='true';
export async function startTelegramRegistration({body,req,db,env}){
 if(!registrationTelegramRequired(env)||!telegramReady(env))throw new HttpError(503,'Telegram orqali ro‘yxatdan o‘tish hali ulanmagan.');
 if(body.consent!==true)fail('Ro‘yxatdan o‘tish uchun rozilik kerak.');
 const mobile=phone(body.phone);
 await rateLimit(req,db,'registration-telegram',mobile,{account:3,ip:20});
 const bot=await telegram('getMe',{},env);
 if(!/^[A-Za-z0-9_]{5,32}$/.test(bot.username||''))throw new HttpError(503,'Telegram bot manzili aniqlanmadi.');
 // Telegram start payloads permit at most 64 characters: r_ + 48 hex characters.
 const secret=randomBytes(24).toString('hex');
 await db('telegram_registrations',{method:'POST',body:{token_hash:digest(secret),phone:mobile,expires_at:new Date(Date.now()+15*60000).toISOString()}});
 return {challenge:secret,url:`https://t.me/${bot.username}?start=r_${secret}`,expiresIn:900};
}

export async function handleRegistrationMessage(message,db,env){
 if(!registrationTelegramRequired(env))return false;
 const rpc=(name,body)=>db(`rpc/${name}`,{method:'POST',body});
 const start=String(message.text||'').match(/^\/start r_([a-f0-9]{48})$/);
 if(start){
  const pending=await rpc('zar_start_telegram_registration',{p_token_hash:digest(start[1]),p_chat_id:message.chat.id});
  const text=!pending?'Havola eskirgan yoki ishlatilgan. Saytga qaytib tasdiqlashni qayta boshlang.':pending.verified?'Raqamingiz tasdiqlangan. Saytga qaytib «Kabinet yaratish» tugmasini bosing.':`ZARURIYAT: ${pending.phone} raqamini tasdiqlash uchun quyidagi «Telefon raqamimni ulashish» tugmasini bosing. Begona kontakt yubormang.`;
  await telegram('sendMessage',{chat_id:message.chat.id,text,...(pending&&!pending.verified?{reply_markup:{keyboard:[[{text:'Telefon raqamimni ulashish',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}}:{reply_markup:{remove_keyboard:true}})},env);
  return true;
 }
 if(!message.contact)return false;
 const own=message.contact.user_id===message.from.id&&!message.forward_origin&&!message.forward_from&&!message.forward_from_chat&&!message.via_bot;
 const mobile=normalizePhone(message.contact.phone_number);
 const matched=own&&/^\+998\d{9}$/.test(mobile)&&await rpc('zar_verify_telegram_registration',{p_chat_id:message.chat.id,p_phone:mobile});
 await telegram('sendMessage',{chat_id:message.chat.id,text:matched?'Telefon raqamingiz tasdiqlandi. Saytga qaytib «Kabinet yaratish» tugmasini bosing.':'Raqam tasdiqlanmadi. Saytda kiritgan raqamingiz Telegramdagi o‘z raqamingiz bilan bir xil bo‘lishi kerak. Faqat «Telefon raqamimni ulashish» tugmasidan foydalaning.',...(matched?{reply_markup:{remove_keyboard:true}}:{})},env);
 return true;
}
