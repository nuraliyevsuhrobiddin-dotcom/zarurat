import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError, query } from './db.mjs';
import { requireRole, rateLimit } from './security.mjs';
import { text, choice, integer } from './validation.mjs';
import { packageTiers } from '../public/package-tiers.js';

export const paymeMode = env => env.PAYME_MODE === 'live' ? 'live' : 'test';
const accountField = env => env.PAYME_ACCOUNT_FIELD || 'order_id';
const activeKey = env => paymeMode(env) === 'live' ? env.PAYME_KEY : env.PAYME_TEST_KEY;
export function paymeReady(env) {
  try {
    const origin = new URL(env.PUBLIC_ORIGIN);
    return env.FEATURE_PAYME === 'true' && ['test','live'].includes(env.PAYME_MODE)
      && /^[a-zA-Z0-9_-]{1,100}$/.test(env.PAYME_MERCHANT_ID || '')
      && /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(accountField(env)) && Boolean(activeKey(env)?.trim())
      && origin.origin === env.PUBLIC_ORIGIN && (origin.protocol === 'https:' || (paymeMode(env) === 'test' && origin.protocol === 'http:'));
  } catch { return false; }
}
export const paymeError = (code, message, data) => ({error:{code,message:{uz:message,ru:message,en:message},...(data === undefined ? {} : {data})}});
function authenticated(req, env) {
  const expected = 'Basic ' + Buffer.from(`Paycom:${activeKey(env)}`).toString('base64');
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(String(req.headers.authorization || '')), hash(expected));
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const timestamp = value => Number.isSafeInteger(value) && value > 0;
const methods = new Set(['CheckPerformTransaction','CreateTransaction','PerformTransaction','CancelTransaction','CheckTransaction','GetStatement','SetFiscalData']);
export async function handlePaymeWebhook(req, body, db, env) {
  const id = typeof body?.id === 'number' || typeof body?.id === 'string' ? body.id : null;
  const reply = value => ({jsonrpc:'2.0',id,...value});
  if (!paymeReady(env)) return reply(paymeError(-32400,'To‘lov xizmati sozlanmagan.'));
  if (!authenticated(req,env)) return reply(paymeError(-32504,'Ruxsat etilmagan.'));
  if (!isObject(body) || typeof body.method !== 'string' || !isObject(body.params)) return reply(paymeError(-32600,'So‘rov noto‘g‘ri.'));
  if (!methods.has(body.method)) return reply(paymeError(-32601,'Usul topilmadi.',body.method));
  const p = body.params, method = body.method;
  if (['CheckPerformTransaction','CreateTransaction'].includes(method)) {
    if (!isObject(p.account) || typeof p.account[accountField(env)] !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.account[accountField(env)])) return reply(paymeError(-31050,'Buyurtma topilmadi.',accountField(env)));
    if (!Number.isSafeInteger(p.amount) || p.amount <= 0) return reply(paymeError(-31001,'To‘lov summasi noto‘g‘ri.'));
  }
  if (!['GetStatement','CheckPerformTransaction'].includes(method) && (typeof p.id !== 'string' || !/^[a-f0-9]{24}$/i.test(p.id))) return reply(paymeError(-32602,'Tranzaksiya raqami noto‘g‘ri.','id'));
  if (method === 'CreateTransaction' && !timestamp(p.time)) return reply(paymeError(-32602,'Vaqt noto‘g‘ri.','time'));
  if (method === 'CancelTransaction' && ![1,2,3,4,5,10].includes(p.reason)) return reply(paymeError(-32602,'Bekor qilish sababi noto‘g‘ri.','reason'));
  if (method === 'GetStatement' && (!timestamp(p.from) || !timestamp(p.to) || p.to < p.from)) return reply(paymeError(-32602,'Davr noto‘g‘ri.'));
  if (method === 'SetFiscalData' && (!['PERFORM','CANCEL'].includes(p.type) || !isObject(p.fiscal_data))) return reply(paymeError(-32602,'Fiskal ma’lumot noto‘g‘ri.'));
  try {
    const result = await db('rpc/zar_payme',{method:'POST',body:{p_method:method,p_params:p,p_mode:paymeMode(env),p_account_field:accountField(env)}});
    return reply(result);
  } catch {
    console.error(JSON.stringify({event:'payme_database_failure',method}));
    return reply(paymeError(-32400,'To‘lovni qayta ishlashda xatolik.'));
  }
}
export function checkoutUrl(order, env) {
  const callback = `${env.PUBLIC_ORIGIN}/#cabinet/packages?order=${order.id}`;
  const params = `m=${env.PAYME_MERCHANT_ID};ac.${accountField(env)}=${order.id};a=${order.amount};l=uz;c=${callback};ct=1500`;
  return `${paymeMode(env)==='live'?'https://checkout.paycom.uz':'https://test.paycom.uz'}/${Buffer.from(params).toString('base64')}`;
}
export async function handlePaymentRoute({path,method,user,body,req,db,env}) {
  if (path === '/payments/options' && method === 'GET') {
    let ready = paymeReady(env);
    if (ready) ready = await db('rpc/zar_payment_ready',{method:'POST',body:{}}).then(value=>value===true).catch(()=>false);
    return {enabled:ready,mode:paymeMode(env)};
  }
  const subscriptionUse=path.match(/^\/payments\/subscriptions\/(\d+)\/(use|eligible)$/);
  if (path !== '/payments' && path !== '/payments/orders' && !subscriptionUse) return undefined;
  requireRole(user,['client','operator','director']);
  if(subscriptionUse){
    requireRole(user,['operator','director']);
    const id=integer(subscriptionUse[1],'Abonement');
    if(subscriptionUse[2]==='use'&&method==='POST'){
      await db('rpc/zar_use_subscription',{method:'POST',body:{p_subscription_id:id,p_case_id:integer(body.caseId,'Murojaat'),p_kind:choice(body.kind,['legal','psychology','business'],'Maslahat'),p_actor_id:user.id}});
      return {ok:true};
    }
    if(subscriptionUse[2]==='eligible'&&method==='GET'){
      const subscriptions=await db('family_subscriptions',{query:query({select:'client_id',id:`eq.${id}`,limit:1})});
      if(!subscriptions.length)throw new HttpError(404,'Abonement topilmadi.');
      const url=new URL(req.url,'http://localhost'),offset=integer(url.searchParams.get('offset')||0,'Sahifa',0,1000000);
      const cases=await db('cases',{query:query({select:'id,number,category',client_id:`eq.${subscriptions[0].client_id}`,status:'eq.completed',category:'in.(legal,documents,psychology,business)',order:'id.desc',limit:51,offset})});
      const usage=cases.length?await db('subscription_usage',{query:query({select:'case_id',case_id:`in.(${cases.map(c=>c.id).join(',')})`})}):[];
      return {cases:cases.slice(0,50).filter(c=>!usage.some(u=>u.case_id===c.id)).map(({id,number,category})=>({id,number,category})),hasMore:cases.length>50,offset:offset+50};
    }
    return undefined;
  }
  if (path === '/payments' && method === 'GET') {
    // Keep existing cabinets working before the payment migration is installed.
    const ready=await db('rpc/zar_payment_ready',{method:'POST',body:{}}).then(value=>value===true).catch(()=>false);
    if (!ready) return {payments:[],subscriptions:[],migrationReady:false};
    const filters={select:'id,client_id,tier,amount,members,mode,status,created_at,paid_at,starts_at,expires_at',order:'created_at.desc',limit:100};
    if (user.role === 'client') filters.client_id=`eq.${user.id}`;
    const payments=await db('payment_orders',{query:query(filters)});
    const subscriptions=await db('family_subscriptions',{query:query({select:'*',order:'created_at.desc',limit:100,...(user.role==='client'?{client_id:`eq.${user.id}`}:{})})});
    const usage=subscriptions.length?await db('subscription_usage',{query:query({select:'subscription_id,kind',subscription_id:`in.(${subscriptions.map(s=>s.id).join(',')})`})}):[];
    for(const s of subscriptions)s.used=Object.fromEntries(['legal','psychology','business'].map(kind=>[kind,usage.filter(u=>u.subscription_id===s.id&&u.kind===kind).length]));
    return {payments,subscriptions,migrationReady:true};
  }
  if (path === '/payments/orders' && method === 'POST') {
    requireRole(user,['client']);
    if (!paymeReady(env)) throw new HttpError(503,'Payme to‘lovi hozircha yoqilmagan.');
    await rateLimit(req,db,'payment',String(user.id));
    const name=choice(body.tier,packageTiers.map(t=>t.name),'Tarif');
    const tier=packageTiers.find(t=>t.name===name);
    if (body.consent !== true) throw new HttpError(400,'To‘lov shartlarini tasdiqlang.');
    if (!Array.isArray(body.members) || body.members.length < 1 || body.members.length > tier.familyMembers) throw new HttpError(400,`Bu tarifda ${tier.familyMembers} nafargacha a’zo bo‘lishi mumkin.`);
    const members=body.members.map(value=>text(value,'Oila a’zosi',2,100));
    const order=await db('rpc/zar_create_payment_order',{method:'POST',body:{p_client_id:user.id,p_tier:tier.name,p_members:members,p_mode:paymeMode(env)}});
    return {order,checkoutUrl:checkoutUrl(order,env),mode:paymeMode(env)};
  }
  return undefined;
}
