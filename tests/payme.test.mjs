import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {handlePaymeWebhook,paymeReady,checkoutUrl} from '../server/payme.mjs';
import {paymentPanel} from '../public/payments.js';
import {testDatabase} from './helpers/database.mjs';
let pg,db,handler,clientId,clientCookie;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'test-session',FEATURE_PAYME:'true',PAYME_MODE:'test',PAYME_MERCHANT_ID:'test-merchant',PAYME_TEST_KEY:'test-key',PAYME_KEY:'live-key'};
const auth={authorization:'Basic '+Buffer.from('Paycom:test-key').toString('base64')};
const txId=n=>n.toString(16).padStart(24,'0');
const rpc=(method,params)=>handlePaymeWebhook({headers:auth},{id:7,method,params},db,env);
async function call(path,{body,cookie,headers={},method=body?'POST':'GET'}={}){
 const req={url:'/api'+path,method,body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(cookie?{cookie}:{}),...headers},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.data=JSON.parse(s);}};
 await handler(req,res);return res;
}
const order=(tier='STANDARD',mode='test',client=clientId)=>db('rpc/zar_create_payment_order',{method:'POST',body:{p_client_id:client,p_tier:tier,p_members:['Test family'],p_mode:mode}});
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(await readFile('migrations/004_payme.sql','utf8'));
 // Migration is rerunnable, with no dropped records or reissued payments.
 await pg.exec(await readFile('migrations/004_payme.sql','utf8'));
 await pg.exec(await readFile('migrations/005_payme_sandbox_errors.sql','utf8'));
 db=testDatabase(pg);handler=createHandler({db,env});
 const res=await call('/auth/register',{body:{name:'Payme client',phone:'+998907771111',password:'test-password',consent:true}});
 assert.equal(res.statusCode,200);clientId=res.data.user.id;clientCookie=res.headers['Set-Cookie'].split(';')[0];
});
after(async()=>{await pg?.close();});
test('payment endpoint requires a client and consent, prices come from SQL and checkout is in tiyin',async()=>{
 assert.equal((await call('/payments/orders',{body:{tier:'STANDARD',members:['Test family'],consent:true}})).statusCode,401);
 assert.equal((await call('/payments/orders',{cookie:clientCookie,body:{tier:'STANDARD',members:['Test family']}})).statusCode,400);
 assert.equal((await call('/payments/orders',{cookie:clientCookie,body:{tier:'STANDARD',members:['aa','bb','cc','dd','ee'],consent:true}})).statusCode,400);
 const res=await call('/payments/orders',{cookie:clientCookie,body:{tier:'STANDARD',amount:1,members:['Test family'],consent:true}});
 assert.equal(res.statusCode,200);assert.equal(res.data.order.amount,9900000);
 const url=new URL(res.data.checkoutUrl);assert.equal(url.origin,'https://test.paycom.uz');
 const params=Buffer.from(url.pathname.slice(1),'base64').toString();
 assert.ok(params.includes('a=9900000'));assert.ok(params.includes('ac.order_id='+res.data.order.id));
 assert.ok(params.includes('c=https://test.example/#cabinet/packages?order='));assert.ok(!params.includes('test-key'));
 for(const [tier,amount] of [['COMFORT',19900000],['PREMIUM',39900000]])assert.equal((await order(tier)).amount,amount);
});
test('Payme auth, malformed params, disabled mode, origin bypass and errors use JSON-RPC HTTP 200',async()=>{
 const bad=await call('/payme',{body:{id:1,method:'GetStatement',params:{from:Date.now()-1000,to:Date.now()}},headers:{origin:'https://payme.example',authorization:'Basic wrong'}});
 assert.equal(bad.statusCode,200);assert.equal(bad.data.error.code,-32504);
 const good=await call('/payme',{body:{id:1,method:'GetStatement',params:{from:Date.now()-1000,to:Date.now()}},headers:{...auth,origin:'https://payme.example'}});
 assert.equal(good.statusCode,200);assert.deepEqual(good.data.result.transactions,[]);
 assert.equal((await rpc('unknown',{})).error.code,-32601);
 assert.equal((await rpc('CreateTransaction',{account:{order_id:'------------------------------------'},amount:9900000,id:txId(1),time:Date.now()})).error.code,-31050);
 assert.equal((await rpc('GetStatement',{from:1,to:0})).error.code,-32602);
 const liveAuth={authorization:'Basic '+Buffer.from('Paycom:live-key').toString('base64')};
 assert.equal((await handlePaymeWebhook({headers:liveAuth},{method:'GetStatement',params:{from:1,to:Date.now()}},db,env)).error.code,-32504);
 assert.equal(paymeReady({...env,PAYME_MODE:'invalid'}),false);
 assert.equal(paymeReady({...env,PAYME_MODE:'live',PUBLIC_ORIGIN:'http://localhost:3000'}),false);
 assert.equal((await call('/payme',{body:'not-json',headers:auth})).data.error.code,-32700);
});
test('create, settlement and refund are idempotent and subscriptions activate only on server confirmation',async()=>{
 const o=await order(),params={id:txId(1),time:Date.now(),amount:o.amount,account:{order_id:o.id}};
 assert.equal((await rpc('CheckPerformTransaction',{...params,amount:1})).error.code,-31001);
 assert.equal((await rpc('CheckPerformTransaction',params)).result.allow,true);
 const first=await rpc('CreateTransaction',params);assert.equal(first.result.state,1);
 assert.deepEqual((await rpc('CreateTransaction',params)).result,first.result);
 assert.equal((await pg.query('SELECT count(*) AS n FROM family_subscriptions')).rows[0].n,0);
 assert.equal((await rpc('CreateTransaction',{...params,id:txId(2)})).error.code,-31050);
 const completed=await rpc('PerformTransaction',{id:params.id});assert.equal(completed.result.state,2);
 assert.deepEqual((await rpc('PerformTransaction',{id:params.id})).result,completed.result);
 assert.equal((await pg.query('SELECT count(*) AS n FROM family_subscriptions')).rows[0].n,1);
 const data=(await call('/payments',{cookie:clientCookie})).data;
 assert.equal(data.subscriptions[0].tier,'STANDARD');assert.equal(data.subscriptions[0].mode,'test');
 assert.ok(new Date(data.subscriptions[0].expires_at)>new Date(data.subscriptions[0].starts_at));
 assert.equal((await rpc('CheckTransaction',{id:params.id})).result.state,2);
 const fiscal={receipt_id:'test-receipt',status_code:0};
 assert.equal((await rpc('SetFiscalData',{id:params.id,type:'PERFORM',fiscal_data:fiscal})).result.success,true);
 await assert.rejects(order(),/Amaldagi abonement/);
 const cancelled=await rpc('CancelTransaction',{id:params.id,reason:5});assert.equal(cancelled.result.state,-2);
 assert.deepEqual((await rpc('CancelTransaction',{id:params.id,reason:5})).result,cancelled.result);
 assert.equal((await rpc('PerformTransaction',{id:params.id})).error.code,-31008);
 assert.equal((await pg.query('SELECT status FROM family_subscriptions')).rows[0].status,'cancelled');
 await rpc('SetFiscalData',{id:params.id,type:'CANCEL',fiscal_data:{receipt_id:'refund'}});
 const f=(await pg.query('SELECT fiscal_perform,fiscal_cancel FROM payme_transactions WHERE payme_id=$1',[params.id])).rows[0];
 assert.equal(f.fiscal_perform.receipt_id,'test-receipt');assert.equal(f.fiscal_cancel.receipt_id,'refund');
});
test('12-hour timeout is persisted, cannot settle later, and a replacement transaction can use a different order',async()=>{
 const o=await order('COMFORT'),p={id:txId(3),time:Date.now(),amount:o.amount,account:{order_id:o.id}};
 assert.equal((await rpc('CreateTransaction',p)).result.state,1);
 await pg.query('UPDATE payme_transactions SET payme_time=$1 WHERE payme_id=$2',[Date.now()-43200001,p.id]);
 assert.equal((await rpc('PerformTransaction',{id:p.id})).error.code,-31008);
 const check=(await rpc('CheckTransaction',{id:p.id})).result;
 assert.equal(check.state,-1);assert.equal(check.reason,4);assert.ok(check.cancel_time>0);
 const replacement=await order('PREMIUM');
 assert.equal((await rpc('CreateTransaction',{id:txId(4),time:Date.now(),amount:replacement.amount,account:{order_id:replacement.id}})).result.state,1);
 const cancelled=await rpc('CancelTransaction',{id:txId(4),reason:3});assert.equal(cancelled.result.state,-1);
});
test('statement is ordered by Payme time inclusively, ownership and anonymous database privileges are enforced',async()=>{
 const list=(await rpc('GetStatement',{from:1,to:Date.now()+1000})).result.transactions;
 assert.equal(list.length,3);assert.ok(list.every((t,i)=>!i||list[i-1].time<=t.time));
 const exact=(await rpc('GetStatement',{from:list[0].time,to:list[0].time})).result.transactions;
 assert.equal(exact.length,1);
 const other=await call('/auth/register',{body:{name:'Other family',phone:'+998907772222',password:'test-password',consent:true}});
 const cookie=other.headers['Set-Cookie'].split(';')[0];
 assert.deepEqual((await call('/payments',{cookie})).data.payments,[]);
 for(const role of ['anon','authenticated']){
  await pg.exec(`SET ROLE ${role}`);
  await assert.rejects(pg.query('SELECT * FROM payment_orders'),/permission denied/);
  await assert.rejects(pg.query("SELECT zar_payme('GetStatement','{}','test','order_id')"),/permission denied/);
  await pg.exec('RESET ROLE');
 }
});
test('test and live callbacks are isolated and presentation escapes family members',async()=>{
 const live=await order('STANDARD','live');
 const liveEnv={...env,PAYME_MODE:'live'};
 assert.equal(new URL(checkoutUrl(live,liveEnv)).origin,'https://checkout.paycom.uz');
 const p={id:txId(8),time:Date.now(),amount:live.amount,account:{order_id:live.id}};
 assert.equal((await rpc('CreateTransaction',p)).error.code,-31050);
 const result=await handlePaymeWebhook({headers:{authorization:'Basic '+Buffer.from('Paycom:live-key').toString('base64')}},{id:8,method:'CreateTransaction',params:p},db,liveEnv);
 assert.equal(result.result.state,1);
 assert.equal((await rpc('CheckTransaction',{id:p.id})).error.code,-31003);
 const html=paymentPanel({subscriptions:[{tier:'STANDARD',mode:'test',status:'active',starts_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),members:['<script>alert(1)</script>'],terms:{}}],payments:[]});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('TEST'));
});
test('monthly consultation usage enforces completion, ownership, role and per-kind limits; consumed subscriptions reject refunds',async()=>{
 const liveEnv={...env,PAYME_MODE:'live'},headers={authorization:'Basic '+Buffer.from('Paycom:live-key').toString('base64')};
 const liveRpc=(method,params)=>handlePaymeWebhook({headers},{id:9,method,params},db,liveEnv);
 assert.equal((await liveRpc('PerformTransaction',{id:txId(8)})).result.state,2);
 const sub=(await pg.query("SELECT * FROM family_subscriptions WHERE mode='live' AND client_id=$1",[clientId])).rows[0];
 const actor=(await pg.query("INSERT INTO users(login,name,phone,password_hash,role) VALUES('coordinator','Test coordinator','+998907773333','test-hash','operator') RETURNING id")).rows[0].id;
 const makeCase=async category=>{
  const value=await db('rpc/zar_create_request',{method:'POST',body:{p_input:{name:'Test family',phone:'+998907771111',region:'Qashqadaryo',category,description:'Monthly consultation test',preferred_time:'Istalgan vaqt',attachments:[]},p_user_id:clientId}});
  await pg.query("UPDATE cases SET status='completed' WHERE id=$1",[value.case.id]);return value.case.id;
 };
 const id=await makeCase('legal');
 const args={p_subscription_id:sub.id,p_case_id:id,p_kind:'legal',p_actor_id:actor};
 await assert.rejects(db('rpc/zar_use_subscription',{method:'POST',body:{...args,p_actor_id:clientId}}),/Ruxsat/);
 await assert.rejects(db('rpc/zar_use_subscription',{method:'POST',body:{...args,p_kind:'psychology'}}),/mos emas/);
 await db('rpc/zar_use_subscription',{method:'POST',body:args});
 const id2=await makeCase('legal');
 await assert.rejects(db('rpc/zar_use_subscription',{method:'POST',body:{...args,p_case_id:id2}}),/limiti tugagan/);
 assert.equal((await liveRpc('CancelTransaction',{id:txId(8),reason:5})).error.code,-31007);
 assert.equal((await liveRpc('CheckTransaction',{id:txId(8)})).result.state,2);
 const data=(await call('/payments',{cookie:clientCookie})).data;
 assert.equal(data.subscriptions.find(s=>s.id===sub.id).used.legal,1);
 assert.equal((await call(`/payments/subscriptions/${sub.id}/use`,{cookie:clientCookie,body:{caseId:id2,kind:'legal'}})).statusCode,403);
});
test('different concurrent reservations cannot pay twice for one family',async()=>{
 const other=(await pg.query("SELECT id FROM users WHERE phone='+998907772222'")).rows[0].id;
 const a=await order('STANDARD','test',other),b=await order('PREMIUM','test',other);
 const results=await Promise.all([a,b].map((o,i)=>rpc('CreateTransaction',{id:txId(20+i),time:Date.now(),amount:o.amount,account:{order_id:o.id}})));
 assert.equal(results.filter(r=>r.result?.state===1).length,1);assert.equal(results.filter(r=>r.error?.code===-31050).length,1);
});
