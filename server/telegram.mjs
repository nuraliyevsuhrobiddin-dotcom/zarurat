import {timingSafeEqual} from 'node:crypto';
import {HttpError} from './db.mjs';
import {digest,token} from './security.mjs';
import {telegramReady,telegram} from './providers.mjs';

export async function handleTelegramWebhook(req,body,db,env){
 if(!telegramReady(env))throw new HttpError(503,'Telegram hali ulanmagan.');
 const supplied=Buffer.from(String(req.headers['x-telegram-bot-api-secret-token']||''));
 const expected=Buffer.from(env.TELEGRAM_WEBHOOK_SECRET);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new HttpError(403,'Ruxsat yo‘q.');
 const m=body.message;
 if(!m||m.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id!==m.from?.id)return {ok:true};
 if(m.text==='/stop'){
  await db('rpc/zar_unlink_telegram',{method:'POST',body:{p_chat_id:m.chat.id}});
  return {ok:true};
 }
 const match=String(m.text||'').match(/^\/start ([a-f0-9]{64})$/);
 if(match){
  const linked=await db('rpc/zar_bind_telegram',{method:'POST',body:{p_token_hash:digest(match[1]),p_chat_id:m.chat.id}});
  if(linked){
   try{await telegram('sendMessage',{chat_id:m.chat.id,text:'ZARURIYAT hisobingiz Telegramga ulandi. Xabarlarni to‘xtatish: /stop.'},env);}
   catch(error){console.error(JSON.stringify({event:'telegram_confirmation_failure',category:error.name}));}
  }
 }
 return {ok:true};
}

const statuses={received:'Qabul qilindi',reviewing:'O‘rganilmoqda',searching:'Hamkor izlanmoqda',arranging:'Kelishilmoqda',contacted:'Aloqa o‘rnatildi',completed:'Yakunlandi',cancelled:'Bekor qilindi'};
export function notificationText(row){
 // Never send descriptions, phone numbers, notes, documents or tracking keys.
 return `ZARURIYAT\nMurojaat: ${row.caseNumber}\nHolat: ${statuses[row.caseStatus]||'Yangilandi'}\nTafsilotlarni shaxsiy kabinetingizda ko‘ring.`;
}
export async function drainNotifications(db,env){
 if(!telegramReady(env))return {enabled:false,sent:0};
 const claim=token();
 const rows=await db('rpc/zar_claim_notifications',{method:'POST',body:{p_claim_token:claim}});
 let sent=0,failed=0;
 await Promise.all(rows.map(async row=>{
  try{
   const result=await telegram('sendMessage',{chat_id:row.chatId,text:notificationText(row)},env);
   const done=await db('rpc/zar_finish_notification',{method:'POST',body:{p_id:row.id,p_claim_token:claim,p_sent:true,p_provider_id:result.message_id,p_error:null}});
   if(done)sent++;
  }catch{
   failed++;
   await db('rpc/zar_finish_notification',{method:'POST',body:{p_id:row.id,p_claim_token:claim,p_sent:false,p_provider_id:null,p_error:'Telegram delivery failed'}}).catch(()=>{});
  }
 }));
 return {enabled:true,sent,failed};
}
