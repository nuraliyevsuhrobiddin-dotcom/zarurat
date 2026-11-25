import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {createSession} from '../server/security.mjs';
import {paymentPanel} from '../public/payments.js';
import {manualPaymentInfo,paymentMethodLabel,cardPaymentNote} from '../public/manual-payment.js';
import {testDatabase} from './helpers/database.mjs';

// Clients who cannot pay in Payme pay the MChJ bank account from any app or in cash.
// Staff confirm the money and activate the same monthly subscription.
let pg,db,handler;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'manual-payment-secret',FEATURE_STAGE2:'true'};
const cookies={};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(await readFile('migrations/002_accounts_notifications.sql','utf8'));
 const upgrade=await readFile('migrations/017_manual_subscription_payment.sql','utf8');
 await pg.exec(upgrade);await pg.exec(upgrade);
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES
 ('director','Director','+998902222221',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'director'),
 ('operator','Operator','+998902222222',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'operator'),
 ('client','Client','+998902222223',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client'),
 ('waiting','Waiting client','+998902222224',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client');`);
 db=testDatabase(pg);handler=createHandler({db,env});
 for(const u of (await pg.query('SELECT id,login FROM users')).rows)cookies[u.login]='zar_session='+await createSession(u,'audit-password',db,env);
});
after(async()=>await pg?.close());
async function call(path,role,body){
 const req={url:'/api'+path,method:body?'POST':'GET',body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(role?{cookie:cookies[role]}:{})},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.data=JSON.parse(value);}};
 await handler(req,res);return res;
}
const activation=(extra={})=>({clientId:3,tier:'COMFORT',members:['Client','Spouse'],method:'bank',reference:'Click 448812',confirm:true,...extra});

test('only staff can activate, and only after confirming the money with a payment reference',async()=>{
 assert.equal((await call('/payments/manual',null,activation())).statusCode,401);
 assert.equal((await call('/payments/manual','client',activation())).statusCode,403);
 for(const bad of [{confirm:false},{method:'payme'},{reference:''},{tier:'GOLD'},{members:['A1','B2','C3','D4','E5','F6']},{clientId:1}]){
  assert.equal((await call('/payments/manual','operator',activation(bad))).statusCode,400,JSON.stringify(bad));
 }
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM family_subscriptions')).rows[0].n,0);
});

test('coordinator activation creates a live one-month subscription that unlocks requests',async()=>{
 // The free first request is used, so the next one needs a subscription.
 const input={name:'Client',phone:'+998902222223',region:'Qashqadaryo',category:'legal',description:'First request text',preferred_time:'Istalgan vaqt',attachments:[]};
 await db('rpc/zar_submit_request',{method:'POST',body:{p_input:input,p_user_id:3}});
 assert.equal((await db('rpc/zar_submit_request',{method:'POST',body:{p_input:input,p_user_id:3}})).subscriptionRequired,true);
 const res=await call('/payments/manual','operator',activation());
 assert.equal(res.statusCode,200);
 const s=res.data.subscription;
 assert.equal(s.mode,'live');assert.equal(s.status,'active');assert.equal(s.tier,'COMFORT');assert.deepEqual(s.members,['Client','Spouse']);
 const days=(Date.parse(s.expires_at)-Date.parse(s.starts_at))/86400000;assert.ok(days>=28&&days<=31,String(days));
 const order=(await pg.query('SELECT * FROM payment_orders WHERE id=$1',[s.order_id])).rows[0];
 assert.equal(order.status,'paid');assert.equal(order.method,'bank');assert.equal(order.reference,'Click 448812');assert.equal(Number(order.amount),19900000);assert.equal(Number(order.confirmed_by),2);
 assert.ok((await db('rpc/zar_submit_request',{method:'POST',body:{p_input:input,p_user_id:3}})).case.id);
 const own=await call('/payments','client');
 assert.equal(own.data.payments[0].method,'bank');assert.equal('confirmed_by' in own.data.payments[0],false);assert.equal('terms' in own.data.payments[0],false);
 assert.equal((await call('/payments','operator')).data.payments[0].confirmed_by,2);
 // No second subscription while this one is active, by hand or through Payme.
 const again=await call('/payments/manual','director',activation({reference:'Cash 2'}));
 assert.equal(again.statusCode,400);assert.match(again.data.error,/amaldagi obuna/);
});

test('a Payme payment awaiting confirmation blocks a manual activation',async()=>{
 const o=(await pg.query("SELECT zar_create_payment_order(4,'STANDARD','[\"Waiting client\"]'::jsonb,'live') AS o")).rows[0].o;
 await pg.query("INSERT INTO payme_transactions(payme_id,mode,order_id,payme_time,amount,account,create_time,state) VALUES('a1b2c3','live',$1,1,9900000,'{}',1,1)",[o.id]);
 const res=await call('/payments/manual','operator',activation({clientId:4,members:['Waiting client']}));
 assert.equal(res.statusCode,400);assert.match(res.data.error,/Payme/);
});

test('only the director can undo an unused manual activation',async()=>{
 const order=(await pg.query("SELECT id FROM payment_orders WHERE client_id=3 AND method='bank'")).rows[0].id;
 assert.equal((await call(`/payments/manual/${order}/cancel`,'operator',{})).statusCode,403);
 const done=await call(`/payments/manual/${order}/cancel`,'director',{});
 assert.equal(done.statusCode,200);assert.equal(done.data.order.status,'cancelled');
 assert.equal((await pg.query('SELECT status FROM family_subscriptions WHERE order_id=$1',[order])).rows[0].status,'cancelled');
 assert.equal((await call(`/payments/manual/${order}/cancel`,'director',{})).statusCode,400);
 const payme=(await pg.query("SELECT id FROM payment_orders WHERE method='payme' LIMIT 1")).rows[0].id;
 assert.equal((await call(`/payments/manual/${payme}/cancel`,'director',{})).statusCode,400);
 assert.equal((await pg.query('SELECT zar_manual_payment_ready() AS ready')).rows[0].ready,true);
});

test('checkout explains card payment and other apps; bank details show only when filled',()=>{
 assert.match(cardPaymentNote(),/Uzcard yoki Humo/);assert.match(cardPaymentNote(),/Payme ilovasi shart emas/);
 const empty=manualPaymentInfo({price:'199 000',tier:'COMFORT',phone:'+998 55 406 77 55'});
 assert.match(empty,/Click, Uzum/);assert.match(empty,/koordinatordan so‘rang/);assert.match(empty,/href="tel:\+998554067755"/);assert.doesNotMatch(empty,/bank-details|<details[^>]*open/);
 const filled=manualPaymentInfo({price:'199 000',tier:'COMFORT',bank:{company:'"ZARURIYAT" MChJ',account:'20208000123456789001',mfo:'00000',inn:''},open:true,signedIn:false,script:'cyr'});
 assert.match(filled,/20208000123456789001/);assert.match(filled,/&quot;ZARURIYAT&quot; MChJ/);assert.doesNotMatch(filled,/СТИР/);assert.match(filled,/<details class="manual-payment" open>/);assert.match(filled,/рўйхатдан ўтинг/);
 assert.equal(paymentMethodLabel('cash'),'Naqd (markaz kassasi)');assert.equal(paymentMethodLabel(undefined),'Payme');
});

test('payment history labels the method and offers undo only to the director for manual payments',()=>{
 const payments=[{id:'00000000-0000-4000-8000-000000000001',client_id:3,tier:'COMFORT',amount:19900000,status:'paid',mode:'live',method:'bank',reference:'Click 448812',created_at:new Date().toISOString()},{id:'00000000-0000-4000-8000-000000000002',client_id:3,tier:'STANDARD',amount:9900000,status:'paid',mode:'live',method:'payme',created_at:new Date().toISOString()}];
 const client=paymentPanel({payments,subscriptions:[]},'lat');
 assert.match(client,/MChJ hisob raqamiga o‘tkazma/);assert.match(client,/Payme/);assert.doesNotMatch(client,/manual-payment-cancel|Click 448812/);
 const operator=paymentPanel({payments,subscriptions:[]},'lat',[],true,false);
 assert.match(operator,/Click 448812/);assert.doesNotMatch(operator,/manual-payment-cancel/);
 const director=paymentPanel({payments,subscriptions:[]},'lat',[],true,true);
 assert.equal((director.match(/data-action="manual-payment-cancel"/g)||[]).length,1);
});
