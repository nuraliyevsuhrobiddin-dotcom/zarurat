import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {createSession} from '../server/security.mjs';
import {testDatabase} from './helpers/database.mjs';
import {requestAccessNotice,requestAccessPolicy} from '../public/request-access.js';
import {api} from '../public/api.js';
import {runInNewContext} from 'node:vm';
let pg,db,handler,sequence=0;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'request-access-only'};
const cookies={};
const input=phone=>({name:'Audit Client',phone,region:'Qashqadaryo',category:'legal',description:'Huquqiy maslahat olish uchun murojaat.',preferred_time:'Istalgan vaqt',attachments:[]});
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 const upgrade=await readFile('migrations/014_request_subscription_access.sql','utf8');await pg.exec(upgrade);await pg.exec(upgrade);
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES
 ('director','Director','+998901111111',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'director'),
 ('client','Client','+998901111112',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client'),
 ('other','Other','+998901111113',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client');`);
 db=testDatabase(pg);handler=createHandler({db,env});
 for(const u of (await pg.query('SELECT id,login FROM users')).rows)cookies[u.login]='zar_session='+await createSession(u,'audit-password',db,env);
});
after(async()=>await pg?.close());
async function submit(phone,role,extra={}){
 const req={url:'/api/requests',method:'POST',body:{...input(phone),consent:true,...extra},headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(role?{cookie:cookies[role]}:{})},socket:{remoteAddress:'audit-'+(++sequence)}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.data=JSON.parse(s);}};await handler(req,res);return res;
}
const count=async()=>Number((await pg.query('SELECT count(*) AS n FROM cases')).rows[0].n);
test('one free request per normalized phone survives reload, formatting and forged identity fields',async()=>{
 assert.equal((await submit('+998 90 900 00 01','other')).statusCode,200);const before=await count();
 for(const phone of ['909000001','998909000001','+998 (90) 900-00-01']){
  const r=await submit(phone,'other',{p_actor_id:1,role:'director',subscription:true});assert.equal(r.statusCode,402);assert.equal(r.data.code,'subscription_required');
  assert.equal(r.data.case,undefined);assert.equal(r.data.trackingToken,undefined);
 }
 assert.equal(await count(),before);
 assert.equal((await submit('+998909000002','other')).statusCode,200);
});
test('simultaneous free submissions produce one case; failed creation does not consume the free request',async()=>{
 const results=await Promise.all([submit('+998909000003','other'),submit('909000003','other')]);
 assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,402]);
 const before=await count();
 await assert.rejects(db('rpc/zar_submit_request',{method:'POST',body:{p_input:{...input('+998909000004'),attachments:[{name:'broken',type:'application/pdf',size:'invalid-number',data:''}]},p_user_id:null}}));
 assert.equal(await count(),before);assert.equal((await submit('+998909000004','other')).statusCode,200);
});
test('legacy formatted phone records count as the first request',async()=>{
 await db('rpc/zar_create_request',{method:'POST',body:{p_input:input('90 900 00 05'),p_user_id:null}});
 assert.equal((await submit('+998909000005','other')).statusCode,402);
});
test('only an owned current live subscription unlocks subsequent and family requests',async()=>{
 assert.equal((await submit('+998901111112','client')).statusCode,200);
 assert.equal((await submit('+998901111112','client')).statusCode,402);
 await pg.exec(`INSERT INTO payment_orders(client_id,tier,amount,members,terms,mode,status)VALUES(2,'STANDARD',9900000,'["Client"]','{"legalConsultations":1}','test','paid');
 INSERT INTO family_subscriptions(order_id,client_id,tier,mode,members,terms,starts_at,expires_at)SELECT id,client_id,tier,mode,members,terms,now()-interval '1 day',now()+interval '1 month' FROM payment_orders;`);
 assert.equal((await submit('+998901111112','client')).statusCode,402);
 await pg.exec("UPDATE family_subscriptions SET mode='live',starts_at=now()+interval '1 day'");
 assert.equal((await submit('+998901111112','client')).statusCode,402);
 await pg.exec("UPDATE family_subscriptions SET starts_at=now()-interval '1 day'");
 assert.equal((await submit('+998901111112','client')).statusCode,200);
 // The benefit belongs to the authenticated account, not anyone who types that phone.
 assert.equal((await submit('+998901111112','other',{clientId:2})).statusCode,402);
 // Guests cannot send requests at all; they register first.
 assert.equal((await submit('+998901111112')).statusCode,401);
 assert.equal((await submit('+998909000001','client')).statusCode,200);
 await pg.exec("UPDATE family_subscriptions SET expires_at=now()-interval '1 second'");
 assert.equal((await submit('+998901111112','client')).statusCode,402);
 await pg.exec("UPDATE family_subscriptions SET expires_at=now()+interval '1 day',status='cancelled'");
 assert.equal((await submit('+998901111112','client')).statusCode,402);
});
test('valid manual benefits work and only authenticated staff can perform internal intake',async()=>{
 await pg.exec("SELECT zar_save_package(2,'Start',now()+interval '1 day',1,'[\"Client\"]')");
 assert.equal((await submit('+998901111112','client')).statusCode,200);
 await pg.exec("UPDATE packages SET expires_at=now()-interval '1 second'");
 assert.equal((await submit('+998901111112','client')).statusCode,402);
 assert.equal((await submit('+998901111112','director')).statusCode,200);
 await assert.rejects(db('rpc/zar_submit_request',{method:'POST',body:{p_input:input('+998901111112'),p_user_id:null,p_actor_id:2}}),/Ruxsat/);
 const grants=(await pg.query("SELECT has_function_privilege('anon','zar_submit_request(jsonb,bigint,bigint)','EXECUTE') AS allowed")).rows[0];assert.equal(grants.allowed,false);
});
test('subscription gate exposes real tariffs and preserves the request page by opening checkout separately',()=>{
 for(const script of ['lat','cyr']){
  const html=requestAccessNotice(script);
  for(const name of ['STANDARD','COMFORT','PREMIUM'])assert.ok(html.includes('#checkout?package='+name));
  assert.equal((html.match(/target="_blank"/g)||[]).length,4);assert.ok(html.includes('99 000'));assert.ok(requestAccessPolicy(script));
  assert.doesNotMatch(html,/data-action="buy-package"|<form/);
 }
});
test('frontend API preserves the structured subscription requirement for the request form',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:false,status:402,json:async()=>({error:'Subscription needed',code:'subscription_required'})});
 try{await assert.rejects(api('/requests',{phone:'+998909000001'}),e=>e.status===402&&e.code==='subscription_required');}finally{globalThis.fetch=original;}
});

test('rejected submission keeps entered fields and consent while showing the subscription panel',async()=>{
 const source=await readFile('public/app.js','utf8');
 const listener=source.slice(source.indexOf("document.addEventListener('submit',async e=>{"),source.indexOf("\nwindow.addEventListener('hashchange'"));
 let submitHandler,saved=0;
 let focused=false,scrolled;
 const heading={focus(options){focused=options.preventScroll;},scrollIntoView(options){scrolled=options.block;}};
 const box={isConnected:true,innerHTML:'',querySelector:()=>heading,scrollIntoView(){}},button={isConnected:true,disabled:false,innerHTML:'Send'};
 class Form{constructor(){this.id='request-form';this.dataset={};this.isConnected=true;this.values={name:'Saved Client',phone:'+998909000001',description:'Keep this consultation description',consent:'on'};}querySelector(){return button;}}
 const form=new Form(),before={...form.values};
 class Data{constructor(f){this.entries=Object.entries(f.values);}[Symbol.iterator](){return this.entries[Symbol.iterator]();}}
 const context={document:{addEventListener:(name,fn)=>submitHandler=fn},HTMLFormElement:Form,FormData:Data,routeVersion:1,location:{hash:'#request'},
  $:()=>box,tr:v=>v,state:{script:'lat'},rememberRequestDraft:()=>{saved++;return {};},
  requestFormOwners:new WeakMap([[form,{owner:'guest'}]]),pageLabel:lat=>lat,
  api:async path=>{if(path==='/auth/me')return {user:null};throw Object.assign(new Error('Subscribe'),{status:402,code:'subscription_required'});},
  completeRequestDraft:()=>assert.fail('Rejected drafts must not be cleared'),successDialog:()=>assert.fail('Rejected requests cannot show success'),
  requestAccessNotice,getRegistrationFlow:()=>({sync(){}}),presentationRefreshPending:false};
 const helpers=source.slice(source.indexOf('async function submitRequest('),source.indexOf('\nfunction restartSubmittedRequestLink('));
 runInNewContext(helpers+'\n'+listener,context);await submitHandler({target:form,preventDefault(){}});
 assert.deepEqual(form.values,before);assert.equal(saved,2);assert.match(box.innerHTML,/STANDARD/);assert.equal(button.disabled,false);assert.equal(form.dataset.saving,undefined);
 assert.equal(focused,true);assert.equal(scrolled,'start');
});
