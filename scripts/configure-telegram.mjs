import {telegram,telegramReady} from '../server/providers.mjs';
import {createDatabase} from '../server/db.mjs';
if(!telegramReady(process.env))throw new Error('FEATURE_TELEGRAM va Telegram maxfiy sozlamalari tayyor emas.');
const origin=new URL(process.env.PUBLIC_ORIGIN);
if(origin.protocol!=='https:')throw new Error('HTTPS manzil kerak.');
const db=createDatabase();
// Verify schema existence without submitting SQL or modifying customer rows.
await db('telegram_links',{query:'select=token_hash&limit=0'});
await db('telegram_recovery',{query:'select=id&limit=0'});
if(process.env.FEATURE_TELEGRAM_CASES==='true')await db('telegram_case_drafts',{query:'select=chat_id&limit=0'});
const bot=await telegram('getMe',{},process.env);
if(!bot.is_bot||!bot.username)throw new Error('Telegram bot tekshiruvi o‘tmadi.');
const desired=origin.origin+'/api/telegram/webhook';
const info=await telegram('getWebhookInfo',{},process.env);
if(info.url&&info.url!==desired&&process.env.TELEGRAM_ALLOW_WEBHOOK_REPLACE!=='true')throw new Error('Bot boshqa manzilga ulangan. Mavjud ulanishni almashtirish alohida tasdiqlanishi kerak.');
await telegram('setWebhook',{url:desired,secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false},process.env);
const commands=[{command:'start',description:'Botni boshlash'},{command:'help',description:'Yordam'},{command:'stop',description:'Telegram hisobini uzish'}];
if(process.env.FEATURE_TELEGRAM_CASES==='true')commands.splice(1,0,
 {command:'menu',description:'Asosiy menyu'},
 {command:'new',description:'Murojaat yuborish'},
 {command:'cases',description:'Mening murojaatlarim'},
 {command:'track',description:'Murojaat holatini kuzatish'},
 {command:'rate',description:'Yakunlangan xizmatni baholash'},
 {command:'services',description:'Xizmatlar'},
 {command:'contact',description:'Aloqa va yordam'},
 {command:'cancel',description:'Qoralamani bekor qilish'});
await telegram('setMyCommands',{commands},process.env);
console.log('Telegram webhook sozlandi. Hisobni bog‘lash shaxsiy kabinetdan bajariladi.');
console.log(`Bot: @${bot.username}`);
