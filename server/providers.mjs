import {HttpError} from './db.mjs';
export const stage2=env=>env.FEATURE_STAGE2==='true';
export const smsReady=env=>stage2(env)&&env.SMS_PROVIDER==='twilio'&&Boolean(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM);
export const telegramReady=env=>stage2(env)&&Boolean(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_WEBHOOK_SECRET);

export async function sendSms(phone,code,env,fetcher=fetch){
 if(!smsReady(env))throw new HttpError(503,'SMS xizmati hali ulanmagan.');
 const body=new URLSearchParams({To:phone,From:env.TWILIO_FROM,Body:`ZARURIYAT tasdiqlash kodi: ${code}. 10 daqiqa amal qiladi. Kodni boshqalarga bermang.`});
 const response=await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`,{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Basic '+Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body});
 if(!response.ok)throw new HttpError(503,'SMS yuborish vaqtincha ishlamayapti.');
 return true;
}
export async function telegram(method,body,env,fetcher=fetch){
 if(!telegramReady(env))throw new HttpError(503,'Telegram xizmati hali ulanmagan.');
 const response=await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true)throw new HttpError(503,'Telegram so‘rovi vaqtincha ishlamayapti.');
 return data.result;
}
