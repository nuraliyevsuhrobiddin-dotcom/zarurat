import {telegram} from './providers.mjs';

// Retrying the same code is safe even when Telegram accepted a timed-out request.
// Never generate a different code during transport retries.
export async function sendRecoveryCode(chat,code,env){
 const body={chat_id:chat,text:`ZARURIYAT parolni tiklash kodi: ${code}\nKod 10 daqiqa amal qiladi. Uni hech kimga bermang. Saytga qaytib kodni kiriting. So‘rovni siz yubormagan bo‘lsangiz, xabarni e’tiborsiz qoldiring.`,reply_markup:{remove_keyboard:true}};
 for(let attempt=0;;attempt++){
  try{return await telegram('sendMessage',body,env);}
  catch(error){
   const retryable=!error.providerStatus||error.providerStatus>=500;
   if(attempt>=1||!retryable)throw error;
  }
 }
}
