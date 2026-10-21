import {randomInt,randomBytes,createHmac} from 'node:crypto';
import {HttpError} from './db.mjs';
import {text,phone,password,integer,fail} from './validation.mjs';
import {token,digest,requireRole,rateLimit,hashPassword} from './security.mjs';
import {stage2,smsReady,telegramReady,sendSms,telegram} from './providers.mjs';
import {compare} from 'bcryptjs';
import {normalizeLogin} from '../public/auth-input.js';
import {sendRecoveryCode} from './telegram-recovery-delivery.mjs';

export const otpHash=(id,code,env)=>createHmac('sha256',env.OTP_SECRET||env.SUPABASE_SERVICE_ROLE_KEY).update(`${id}:${code}`).digest('hex');
export async function handleAccount({path,method,user,body,req,db,env}){
 const rpc=(fn,args)=>db(`rpc/${fn}`,{method:'POST',body:args});
 if(path==='/auth/recovery/telegram/request'&&method==='POST'){
  if(!telegramReady(env))throw new HttpError(503,'Telegram orqali tiklash hali ulanmagan.');
  const login=normalizeLogin(text(body.login,'Login yoki telefon',3,100));
  await rateLimit(req,db,'telegram-recovery-request',login,{account:3,ip:20});
  if(body.challenge){
   const id=text(body.challenge,'So‘rov',64,64);
   if(!/^[a-f0-9]{64}$/.test(id))fail('So‘rov noto‘g‘ri.');
   const rows=await db('telegram_recovery',{query:new URLSearchParams({select:'id,user_id,chat_id,password_revision,code_hash,created_at',id:`eq.${id}`,consumed_at:'is.null',expires_at:`gt.${new Date().toISOString()}`,attempts:'lt.5',limit:'1'}).toString()});
   const challenge=rows[0];
   if(challenge&&Date.now()-Date.parse(challenge.created_at)>=60000){
    const users=await db('users',{query:new URLSearchParams({select:'id,login,phone,telegram_chat_id,password_hash',id:`eq.${challenge.user_id}`,blocked_at:'is.null',limit:'1'}).toString()});
    const u=users[0];
    if(u&&u.telegram_chat_id===challenge.chat_id&&u.password_hash===challenge.password_revision&&(normalizeLogin(u.login)===login||normalizeLogin(u.phone)===login)){
     const code=String(randomInt(100000,1000000));
     const changed=await db('telegram_recovery',{method:'PATCH',query:new URLSearchParams({id:`eq.${id}`,code_hash:`eq.${challenge.code_hash}`,consumed_at:'is.null',attempts:'lt.5',expires_at:`gt.${new Date().toISOString()}`}).toString(),body:{code_hash:otpHash(id,code,env),created_at:new Date().toISOString(),expires_at:new Date(Date.now()+600000).toISOString()}});
     if(changed.length)try{await sendRecoveryCode(challenge.chat_id,code,env);}catch(error){console.error(JSON.stringify({event:'telegram_recovery_delivery_failure',category:error.name,providerStatus:error.providerStatus}));}
    }
   }
   return {ok:true,challenge:id,expiresIn:600,message:'Hisob mos bo‘lsa, yangi kod botga yuboriladi. Qayta yuborish oralig‘i kamida 60 soniya. Avvalgi so‘rov oynasida davom eting.'};
  }
  const secret=randomBytes(24).toString('hex'),id=digest(secret),code=String(randomInt(100000,1000000));
  const bot=await telegram('getMe',{},env);
  if(!/^[A-Za-z0-9_]{5,32}$/.test(bot.username||''))throw new HttpError(503,'Telegram bot manzili aniqlanmadi.');
  await rpc('zar_prepare_contact_recovery',{p_id:id,p_login:login});
  const found=await rpc('zar_start_telegram_recovery',{p_login:login,p_code_hash:otpHash(id,code,env),p_id:id});
  if(found){
   try{await sendRecoveryCode(found.chatId,code,env);}
   catch(error){console.error(JSON.stringify({event:'telegram_recovery_delivery_failure',category:error.name,providerStatus:error.providerStatus}));}
  }
  // Do not disclose account existence, binding, cooldown or delivery failures.
  return {ok:true,challenge:id,url:`https://t.me/${bot.username}?start=c_${secret}`,expiresIn:600,message:'Telegram bog‘langan bo‘lsa, kod botga yuboriladi. Kod kelmasa, botni ochib o‘z telefon raqamingizni tasdiqlang. Faqat mijoz hisoblari uchun.'};
 }
 if(path==='/auth/recovery/telegram/confirm'&&method==='POST'){
  if(!telegramReady(env))throw new HttpError(503,'Telegram orqali tiklash hali ulanmagan.');
  const id=text(body.challenge,'So‘rov',64,64),code=text(body.code,'Kod',6,6);
  if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{6}$/.test(code))fail('Tasdiqlash kodi noto‘g‘ri.');
  await rateLimit(req,db,'telegram-recovery-confirm',id,{account:10,ip:30});
  const result=await rpc('zar_confirm_telegram_recovery',{p_id:id,p_code_hash:otpHash(id,code,env),p_password_hash:await hashPassword(password(body.password))});
  if(!result?.ok)fail('Kod noto‘g‘ri, ishlatilgan yoki muddati tugagan.');
  return {ok:true};
 }
 if(path==='/account'&&method==='GET'){
  requireRole(user);
  return {stage2Enabled:stage2(env),phoneVerified:Boolean(user.phone_verified_at),telegramConnected:Boolean(user.telegram_chat_id),smsEnabled:smsReady(env),telegramEnabled:telegramReady(env)};
 }
 if(['/auth/recovery/request','/auth/phone/request'].includes(path)&&method==='POST'){
  if(!smsReady(env))throw new HttpError(503,'SMS orqali tasdiqlash hali ulanmagan.');
  const verify=path==='/auth/phone/request';if(verify)requireRole(user);
  const mobile=phone(verify?user.phone:body.phone);
  await rateLimit(req,db,'otp-request',mobile,{account:3,ip:20});
  const id=token(),code=String(randomInt(100000,1000000));
  const found=await rpc('zar_start_otp',{p_phone:mobile,p_purpose:verify?'verify':'reset',p_user_id:verify?user.id:null,p_code_hash:otpHash(id,code,env),p_id:id});
  if(found){
   try{await sendSms(mobile,code,env);}
   catch(error){
    console.error(JSON.stringify({event:'sms_delivery_failure',category:error.name}));
    if(verify)throw error;
    // Recovery replies do not disclose whether a phone/account exists.
   }
  }
  return {ok:true,challenge:id,expiresIn:600,message:'Hisob mos va telefon tasdiqlangan bo‘lsa, kod SMS orqali yuboriladi.'};
 }
 if(['/auth/recovery/confirm','/auth/phone/verify'].includes(path)&&method==='POST'){
  if(!smsReady(env))throw new HttpError(503,'SMS orqali tasdiqlash hali ulanmagan.');
  const verify=path==='/auth/phone/verify';if(verify)requireRole(user);
  const id=text(body.challenge,'So‘rov',64,64),code=text(body.code,'Kod',6,6);
  if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{6}$/.test(code))fail('Tasdiqlash kodi noto‘g‘ri.');
  await rateLimit(req,db,'otp-confirm',id,{account:10,ip:30});
  const result=await rpc('zar_confirm_otp',{p_id:id,p_code_hash:otpHash(id,code,env),p_purpose:verify?'verify':'reset',p_user_id:verify?user.id:null,p_password_hash:verify?null:await hashPassword(password(body.password))});
  if(!result?.ok)fail('Kod noto‘g‘ri, ishlatilgan yoki muddati tugagan.');
  return {ok:true};
 }
 if(path==='/account/telegram/link'&&method==='POST'){
  requireRole(user);if(!telegramReady(env))throw new HttpError(503,'Telegram bot hali ulanmagan.');
  await rateLimit(req,db,'telegram-link',String(user.id));
  const bot=await telegram('getMe',{},env);
  if(!/^[A-Za-z0-9_]{5,32}$/.test(bot.username||''))throw new HttpError(503,'Telegram bot manzili aniqlanmadi.');
  const secret=token();
  await db('telegram_links',{method:'POST',body:{token_hash:digest(secret),user_id:user.id,expires_at:new Date(Date.now()+1800000).toISOString()}});
  return {url:`https://t.me/${bot.username}?start=${secret}`,expiresIn:1800};
 }
 if(path==='/account/telegram/unlink'&&method==='POST'){
  requireRole(user);if(!telegramReady(env))throw new HttpError(503,'Telegram bot hali ulanmagan.');
  if(user.telegram_chat_id)await rpc('zar_unlink_telegram',{p_chat_id:user.telegram_chat_id});
  return {ok:true};
 }
 if(/^\/users\/\d+$/.test(path)&&method==='PATCH'){
  requireRole(user,['director']);if(!stage2(env))throw new HttpError(503,'Hisob boshqaruvi hali faollashtirilmagan.');
  if(typeof body.blocked!=='boolean')fail('Hisob holati noto‘g‘ri.');
  await rateLimit(req,db,'account-block',String(user.id));
  if(!await compare(password(body.currentPassword,1),user.passwordHash))throw new HttpError(401,'Joriy parol noto‘g‘ri.');
  await rpc('zar_set_block',{p_actor_id:user.id,p_target_id:integer(path.split('/')[2],'Hisob'),p_blocked:body.blocked});
  return {ok:true};
 }
 return undefined;
}
