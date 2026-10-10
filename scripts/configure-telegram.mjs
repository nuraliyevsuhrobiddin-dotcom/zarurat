import {telegram,telegramReady} from '../server/providers.mjs';
import {createDatabase} from '../server/db.mjs';
if(!telegramReady(process.env))throw new Error('FEATURE_STAGE2 va Telegram maxfiy sozlamalari tayyor emas.');
const origin=new URL(process.env.PUBLIC_ORIGIN);
if(origin.protocol!=='https:')throw new Error('HTTPS manzil kerak.');
const db=createDatabase();
// Verify schema existence without submitting SQL or modifying customer rows.
await db('telegram_links',{query:'select=token_hash&limit=0'});
const desired=origin.origin+'/api/telegram/webhook';
const info=await telegram('getWebhookInfo',{},process.env);
if(info.url&&info.url!==desired&&process.env.TELEGRAM_ALLOW_WEBHOOK_REPLACE!=='true')throw new Error('Bot boshqa manzilga ulangan. Mavjud ulanishni almashtirish alohida tasdiqlanishi kerak.');
await telegram('setWebhook',{url:desired,secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false},process.env);
console.log('Telegram webhook sozlandi. Hisobni bog‘lash shaxsiy kabinetdan bajariladi.');
