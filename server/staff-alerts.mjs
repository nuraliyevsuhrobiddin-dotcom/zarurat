import {query} from './db.mjs';
import {telegram,telegramReady} from './providers.mjs';
import {publicConfig} from '../public/supabase-api.js';

// Ad or link source of a request, e.g. "instagram / cpc / noyabr". Only short
// marketing labels are kept: letters, digits, dot, dash and underscore.
const sourcePart=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,60);
export function leadSource(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return '';
 const source=sourcePart(value.source);
 if(!source)return '';
 return [source,sourcePart(value.medium),sourcePart(value.campaign)].filter(Boolean).join(' / ');
}

// Kept in the request history, which only staff can read.
export async function recordLeadSource(db,caseId,source,actor){
 if(!caseId||!source)return;
 await db('history',{method:'POST',body:{case_id:caseId,kind:'source',message:`Manba: ${source}`,actor_name:actor}});
}

// New requests reach every coordinator and director who linked Telegram in their
// profile, even when the cabinet is closed. The message carries the number, service,
// first name and source only; phone and request text stay in the cabinet.
export async function alertStaffNewRequest(db,env,{id,source}={}){
 if(!telegramReady(env)||!id||!env.PUBLIC_ORIGIN)return 0;
 const [request]=await db('cases',{query:query({select:'id,number,name,category',id:`eq.${id}`,limit:1})});
 if(!request)return 0;
 const staff=await db('users',{query:query({select:'id,role,telegram_chat_id,blocked_at',role:'in.(operator,director)'})});
 const chats=[...new Set(staff.filter(u=>u.telegram_chat_id&&!u.blocked_at).map(u=>u.telegram_chat_id))];
 if(!chats.length)return 0;
 const origin=new URL(env.PUBLIC_ORIGIN).origin;
 const service=publicConfig.categories.find(c=>c.id===request.category)?.name||'Xizmat aniqlanmagan';
 const firstName=String(request.name||'').trim().split(/\s+/)[0]||'Mijoz';
 const text=`🆕 Yangi murojaat · ${request.number}\n\n🗂 ${service}\n👤 ${firstName}${source?`\n📣 Manba: ${source}`:''}\n\nMijozga qo‘ng‘iroq qiling 👇`;
 const reply_markup={inline_keyboard:[[{text:'📂 Murojaatni ochish',url:`${origin}/#cabinet/case?id=${request.id}`}]]};
 const sent=await Promise.allSettled(chats.map(chat_id=>telegram('sendMessage',{chat_id,text,reply_markup},env)));
 return sent.filter(item=>item.status==='fulfilled').length;
}
