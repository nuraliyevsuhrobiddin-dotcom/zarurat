import {randomBytes} from 'node:crypto';
import {HttpError} from './db.mjs';
import {digest,rateLimit} from './security.mjs';
import {phone,text,fail} from './validation.mjs';
import {telegramReady,telegram} from './providers.mjs';
import {normalizePhone} from '../public/auth-input.js';

// Kept for backwards-compatible API responses. Account creation no longer
// depends on Telegram; the legacy environment flag is intentionally ignored.
export const registrationTelegramRequired=()=>false;
export async function telegramRegistrationStatus({body,req,db,env}){
 if(!registrationTelegramRequired(env)||!telegramReady(env))throw new HttpError(503,'Telegram orqali ro‘yxatdan o‘tish hali ulanmagan.');
 const challenge=text(body.challenge,'Tasdiqlash havolasi',48,48),mobile=phone(body.phone);
 if(!/^[a-f0-9]{48}$/.test(challenge))fail('Tasdiqlash havolasi noto‘g‘ri.');
 await rateLimit(req,db,'registration-status',digest(challenge),{ip:600,account:300});
 const [proof]=await db('telegram_registrations',{query:new URLSearchParams({select:'verified_at,expires_at,consumed_at',token_hash:`eq.${digest(challenge)}`,phone:`eq.${mobile}`,limit:'1'}).toString()});
 if(!proof||proof.consumed_at||Date.parse(proof.expires_at)<=Date.now())return {status:'expired',verified:false};
 return {status:proof.verified_at?'verified':'pending',verified:!!proof.verified_at,expiresAt:proof.expires_at};
}
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
  const text=!pending?'Havola eskirgan yoki ishlatilgan. Saytga qaytib tasdiqlashni qayta boshlang.':pending.verified?'Raqamingiz tasdiqlangan. Saytga qayting: tasdiq avtomatik tekshiriladi. Keyin ism va parolni kiritib kabinet yarating.':`ZARURIYAT: ${pending.phone} raqamini tasdiqlash uchun avval quyidagi «Telefon raqamimni ulashish» tugmasini bosing. Keyin saytga qayting. Faqat Telegramdagi o‘z raqamingiz qabul qilinadi.`;
  await telegram('sendMessage',{chat_id:message.chat.id,text,...(pending&&!pending.verified?{reply_markup:{keyboard:[[{text:'Telefon raqamimni ulashish',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}}:{reply_markup:{remove_keyboard:true}})},env);
  return true;
 }
 if(!message.contact)return false;
 // Registration only depends on migration 007. Check that flow before handing
 // a contact to optional password-recovery handlers (migrations 006/008).
 const pending=await db('telegram_registrations',{query:new URLSearchParams({select:'token_hash,phone',chat_id:`eq.${message.chat.id}`,consumed_at:'is.null',expires_at:`gt.${new Date().toISOString()}`,order:'started_at.desc',limit:'1'}).toString()});
 if(!pending.length)return false;
 const own=message.contact.user_id===message.from.id&&!message.forward_origin&&!message.forward_from&&!message.forward_from_chat&&!message.via_bot;
 const mobile=normalizePhone(message.contact.phone_number);
 const matched=own&&mobile===pending[0].phone&&await rpc('zar_verify_telegram_registration',{p_chat_id:message.chat.id,p_phone:mobile});
 await telegram('sendMessage',{chat_id:message.chat.id,text:matched?'Telefon raqamingiz tasdiqlandi. Saytga qayting — tasdiq avtomatik aniqlanadi. Ism va parolni kiritib, «Kabinet yaratish»ni bosing.':'Raqam tasdiqlanmadi. Saytdagi raqam Telegramdagi o‘z raqamingiz bilan bir xil bo‘lishi kerak. Saytda «Raqamni o‘zgartirish» orqali to‘g‘rilang yoki botdagi «Telefon raqamimni ulashish» tugmasidan foydalaning.',...(matched?{reply_markup:{inline_keyboard:[[{text:'Saytga qaytish',url:new URL('/#register',env.PUBLIC_ORIGIN).href}]]}}:{})},env);
 return true;
}
