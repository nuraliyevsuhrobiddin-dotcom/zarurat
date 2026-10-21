import {telegramStatuses} from './telegram-status.mjs';
import {timingSafeEqual} from 'node:crypto';
import {HttpError} from './db.mjs';
import {digest,token} from './security.mjs';
import {telegramReady,telegram} from './providers.mjs';
import {handleRegistrationMessage} from './telegram-registration.mjs';
import {handleContactRecovery} from './telegram-contact-recovery.mjs';
import {handleTelegramCases,telegramCasesEnabled} from './telegram-cases.mjs';

export async function handleTelegramWebhook(req,body,db,env){
 if(!telegramReady(env))throw new HttpError(503,'Telegram hali ulanmagan.');
 const supplied=Buffer.from(String(req.headers['x-telegram-bot-api-secret-token']||''));
 const expected=Buffer.from(env.TELEGRAM_WEBHOOK_SECRET);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new HttpError(403,'Ruxsat yo‘q.');
 const m=body.message;
 if(!m||m.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id!==m.from?.id)return {ok:true};
 if(/^\/(start|help)(?:@[A-Za-z0-9_]+)?$/.test(String(m.text||'').trim())){
  if(telegramCasesEnabled(env)){
   await handleTelegramCases({...m,text:'/menu'},db,env);
   return {ok:true};
  }
  const origin=new URL(env.PUBLIC_ORIGIN).origin;
  await telegram('sendMessage',{chat_id:m.chat.id,text:'Assalomu alaykum! Bu ZARURIYAT hisobini tasdiqlash va parolni tiklash boti.\n\nRo‘yxatdan o‘tish uchun avval saytda formani to‘ldiring, keyin «Telegramda tasdiqlash» havolasidan shu botga o‘ting. Shunda telefon raqamingizni ulashish tugmasi chiqadi.\n\nMavjud hisobni bog‘lash: saytda Hisob sozlamalari → Telegramni bog‘lash.\n\nParolni tiklash: saytda «Parolni unutdingizmi?» tugmasini bosing. Hisob oldindan bog‘langan bo‘lsa, kod shu yerga keladi.',reply_markup:{inline_keyboard:[[{text:'Ro‘yxatdan o‘tish',url:origin+'/#register'}],[{text:'Parolni tiklash',url:origin+'/#recovery'}],[{text:'Hisobga kirish',url:origin+'/#login'}]]}},env);
  return {ok:true};
 }
 if(m.text==='/stop'){
  await db('telegram_recovery_contacts',{method:'PATCH',query:new URLSearchParams({chat_id:`eq.${m.chat.id}`,consumed_at:'is.null'}).toString(),body:{consumed_at:new Date().toISOString()}});
  if(env.FEATURE_TELEGRAM_REGISTRATION==='true')await db('telegram_registrations',{method:'PATCH',query:new URLSearchParams({chat_id:`eq.${m.chat.id}`,consumed_at:'is.null'}).toString(),body:{consumed_at:new Date().toISOString()}});
  await db('rpc/zar_unlink_telegram',{method:'POST',body:{p_chat_id:m.chat.id}});
  await telegram('sendMessage',{chat_id:m.chat.id,text:'Telegram hisobingiz saytdan uzildi. Qayta bog‘lash uchun saytdagi Hisob sozlamalariga kiring.',reply_markup:{remove_keyboard:true}},env);
  return {ok:true};
 }
 if(/^\/start r_[a-f0-9]{48}$/.test(String(m.text||''))&&env.FEATURE_TELEGRAM_REGISTRATION==='true')await db('telegram_recovery_contacts',{method:'PATCH',query:new URLSearchParams({chat_id:`eq.${m.chat.id}`,consumed_at:'is.null'}).toString(),body:{consumed_at:new Date().toISOString()}});
 if(await handleContactRecovery(m,db,env))return {ok:true};
 if(await handleRegistrationMessage(m,db,env))return {ok:true};
 const match=String(m.text||'').match(/^\/start ([a-f0-9]{64})$/);
 if(match){
  const linked=await db('rpc/zar_bind_telegram',{method:'POST',body:{p_token_hash:digest(match[1]),p_chat_id:m.chat.id}});
  if(linked){
   try{await telegram('sendMessage',{chat_id:m.chat.id,text:'ZARURIYAT hisobingiz Telegramga ulandi. Xabarlarni to‘xtatish: /stop.'},env);}
   catch(error){console.error(JSON.stringify({event:'telegram_confirmation_failure',category:error.name}));}
  }else await telegram('sendMessage',{chat_id:m.chat.id,text:'Bog‘lash havolasi eskirgan yoki ishlatilgan. Saytdagi Hisob sozlamalari → Telegramni bog‘lash orqali yangi havola oling.'},env);
  return {ok:true};
 }
 if(/^\/start\b/.test(String(m.text||'')))await telegram('sendMessage',{chat_id:m.chat.id,text:'Bu havola yaroqsiz. Saytga qaytib «Telegramda tasdiqlash» yoki «Telegramni bog‘lash» orqali yangi havola oling.'},env);
 else if(await handleTelegramCases(m,db,env)){
  if(m.text==='✅ Roziman, yuborish')await drainNotifications(db,env).catch(error=>console.error(JSON.stringify({event:'notification_queue_failure',category:error.name})));
 }
 return {ok:true};
}

export function notificationText(row){
 // Never send descriptions, phone numbers, notes, documents or tracking keys.
 return `ZARURIYAT\nMurojaat: ${row.caseNumber}\nHolat: ${telegramStatuses[row.caseStatus]||'Yangilandi'}\nTafsilotlarni shaxsiy kabinetingizda ko‘ring.`;
}
export async function drainNotifications(db,env){
 if(!telegramReady(env))return {enabled:false,sent:0};
 const claim=token();
 const rows=await db('rpc/zar_claim_notifications',{method:'POST',body:{p_claim_token:claim}});
 let sent=0,failed=0;
 await Promise.all(rows.map(async row=>{
  try{
   const result=await telegram('sendMessage',{chat_id:row.chatId,text:notificationText(row)+(telegramCasesEnabled(env)?`\nKuzatish: /track ${row.caseNumber}`:'')},env);
   const done=await db('rpc/zar_finish_notification',{method:'POST',body:{p_id:row.id,p_claim_token:claim,p_sent:true,p_provider_id:result.message_id,p_error:null}});
   if(done)sent++;
  }catch{
   failed++;
   await db('rpc/zar_finish_notification',{method:'POST',body:{p_id:row.id,p_claim_token:claim,p_sent:false,p_provider_id:null,p_error:'Telegram delivery failed'}}).catch(()=>{});
  }
 }));
 return {enabled:true,sent,failed};
}
