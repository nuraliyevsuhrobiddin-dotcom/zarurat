import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {testDatabase} from './helpers/database.mjs';
import {digest} from '../server/security.mjs';
let pg,handler,rejectRecoveryTables=false;const messages=[];
const mockFetch=async(url,options)=>{assert.ok(String(url).startsWith('https://api.telegram.org/bot'));if(String(url).endsWith('/getMe'))return {ok:true,json:async()=>({ok:true,result:{username:'qa_register_bot',is_bot:true}})};messages.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{message_id:messages.length}})}};
const env={PUBLIC_ORIGIN:'https://registration.example',FEATURE_TELEGRAM:'true',FEATURE_TELEGRAM_REGISTRATION:'true',TELEGRAM_BOT_TOKEN:'qa',TELEGRAM_WEBHOOK_SECRET:'qa-secret',SESSION_SECRET:'qa-session',SUPABASE_SERVICE_ROLE_KEY:'qa'};
const input={name:'Verified client',phone:'+998901234567',password:'client-password-2026',consent:true};
async function call(path,body,extra={}){
 const req={url:'/api'+path,method:body===undefined?'GET':'POST',body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...extra},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.data=JSON.parse(s)}};
 const original=globalThis.fetch;globalThis.fetch=mockFetch;
 try{await handler(req,res);return res;}finally{globalThis.fetch=original;}
}
const hook=(message,extra={})=>call('/telegram/webhook',{message},{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET,...extra});
const msg=(id,body)=>({chat:{id,type:'private'},from:{id},...body});
const start=phone=>call('/auth/register/telegram/start',{phone,consent:true});
const begin=(proof,id)=>hook(msg(id,{text:'/start r_'+proof}));
const contact=(id,phone,extra={})=>hook(msg(id,{contact:{phone_number:phone,user_id:id},...extra}));
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 for(const file of ['supabase-schema.sql','migrations/002_accounts_notifications.sql','migrations/006_telegram_recovery.sql','migrations/007_telegram_registration.sql','migrations/008_telegram_contact_recovery.sql','migrations/009_telegram_recovery_retries.sql'])await pg.exec(await readFile(file,'utf8'));
 const database=testDatabase(pg);
 handler=createHandler({db:(resource,options)=>{
  if(rejectRecoveryTables&&['telegram_recovery','telegram_recovery_contacts'].includes(resource))throw new Error('optional recovery migration is unavailable');
  return database(resource,options);
 },env});
});
after(async()=>{await pg?.close()});

test('plain Start and Help answer with site actions without claiming or verifying an account',async()=>{
 for(const text of ['/start','/help','/start@qa_register_bot']){
  const response=await hook(msg(789,{text}));assert.equal(response.statusCode,200);
  const sent=messages.at(-1);assert.equal(sent.chat_id,789);assert.match(sent.text,/ZARURIYAT/);
  assert.equal(sent.reply_markup.inline_keyboard[0][0].url,env.PUBLIC_ORIGIN+'/#register');
  assert.equal(sent.reply_markup.inline_keyboard[1][0].url,env.PUBLIC_ORIGIN+'/#recovery');
 }
 assert.equal((await pg.query('SELECT count(*) AS n FROM users')).rows[0].n,0);
 assert.equal((await pg.query('SELECT count(*) AS n FROM telegram_registrations')).rows[0].n,0);
 for(const text of ['/start r_invalid','/start '+'a'.repeat(64)]){
  assert.equal((await hook(msg(789,{text}))).statusCode,200);
  assert.match(messages.at(-1).text,/havola/);
 }
});

test('required registration rejects direct signup without proof and starts without creating an account',async()=>{
 assert.equal((await call('/auth/options')).data.registrationTelegramRequired,true);
 assert.equal((await call('/auth/register',input)).statusCode,400);
 assert.equal((await call('/auth/register/telegram/start',{phone:input.phone})).statusCode,400);
 assert.equal((await start('invalid')).statusCode,400);
 const r=await start('+998 (90) 123-45-67');assert.equal(r.statusCode,200);assert.match(r.data.challenge,/^[a-f0-9]{48}$/);
 assert.ok(new URL(r.data.url).searchParams.get('start').length<=64);
 const rows=(await pg.query('SELECT * FROM telegram_registrations')).rows;assert.equal(rows.length,1);assert.equal(rows[0].token_hash,digest(r.data.challenge));assert.equal(rows[0].phone,input.phone);assert.ok(!JSON.stringify(rows).includes(input.password));assert.equal((await pg.query('SELECT count(*) AS n FROM users')).rows[0].n,0);
});

test('Start alone, stolen contact, forwarded contact and different phone cannot verify registration',async()=>{
 await pg.exec('DELETE FROM rate_limits');const r=await start(input.phone),proof=r.data.challenge;
 const forged=await hook(msg(123,{text:'/start r_'+proof}),{'x-telegram-bot-api-secret-token':'wrong'});assert.equal(forged.statusCode,403);
 await hook({chat:{id:123,type:'group'},from:{id:123},text:'/start r_'+proof});
 assert.equal((await pg.query('SELECT chat_id FROM telegram_registrations WHERE token_hash=$1',[digest(proof)])).rows[0].chat_id,null);
 await begin(proof,123);assert.equal(messages.at(-1).reply_markup.keyboard[0][0].request_contact,true);
 await begin(proof,999);assert.equal((await pg.query('SELECT chat_id FROM telegram_registrations WHERE token_hash=$1',[digest(proof)])).rows[0].chat_id,123);
 assert.equal((await call('/auth/register',{...input,verification:proof})).statusCode,400);
 await contact(123,input.phone,{contact:{phone_number:input.phone,user_id:999}});
 await contact(123,'+998909999999');
 await contact(123,input.phone,{forward_origin:{type:'user'}});
 assert.equal((await pg.query('SELECT verified_at FROM telegram_registrations WHERE token_hash=$1',[digest(proof)])).rows[0].verified_at,null);
 await contact(123,'998901234567');
 assert.ok((await pg.query('SELECT verified_at FROM telegram_registrations WHERE token_hash=$1',[digest(proof)])).rows[0].verified_at);
 assert.equal((await call('/auth/register',{...input,phone:'+998901234568',verification:proof})).statusCode,400);
 const created=await call('/auth/register',{...input,verification:proof,role:'director'});assert.equal(created.statusCode,200);assert.equal(created.data.user.role,'client');
 const user=(await pg.query('SELECT * FROM users WHERE phone=$1',[input.phone])).rows[0];assert.equal(user.telegram_chat_id,123);assert.ok(user.phone_verified_at);assert.ok(user.password_hash.startsWith('$2a$'));assert.ok(!JSON.stringify(created.data).includes(user.password_hash));
 const cookie=created.headers['Set-Cookie'].split(';')[0];const account=await call('/account',undefined,{cookie});assert.equal(account.data.phoneVerified,true);assert.equal(account.data.telegramConnected,true);
 assert.equal((await call('/auth/register',{...input,verification:proof})).statusCode,400);
 assert.equal((await pg.query('SELECT count(*) AS n FROM users')).rows[0].n,1);
});

test('registration webhook works without optional recovery migrations',async()=>{
 await pg.exec('DELETE FROM rate_limits');
 rejectRecoveryTables=true;
 try{
  const r=await start('+998901234571');assert.equal(r.statusCode,200);
  await begin(r.data.challenge,571);assert.equal(messages.at(-1).reply_markup.keyboard[0][0].request_contact,true);
  const verified=await contact(571,'+998901234571');assert.equal(verified.statusCode,200);
  assert.ok((await pg.query('SELECT verified_at FROM telegram_registrations WHERE token_hash=$1',[digest(r.data.challenge)])).rows[0].verified_at);
 }finally{rejectRecoveryTables=false}
});

test('expired proofs and an already registered Telegram cannot create another account',async()=>{
 await pg.exec('DELETE FROM rate_limits');const phone='+998901234568',r=await start(phone);await begin(r.data.challenge,456);await contact(456,phone);
 await pg.query('UPDATE telegram_registrations SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1',[digest(r.data.challenge)]);
 assert.equal((await call('/auth/register',{...input,phone,verification:r.data.challenge})).statusCode,400);
 const r2=await start(phone);await begin(r2.data.challenge,123);await contact(123,phone);
 assert.equal((await call('/auth/register',{...input,phone,verification:r2.data.challenge})).statusCode,400);
 assert.equal((await pg.query('SELECT count(*) AS n FROM users')).rows[0].n,1);
});

test('Stop cancels a pending registration proof',async()=>{
 await pg.exec('DELETE FROM rate_limits');const phone='+998901234570',r=await start(phone);
 await begin(r.data.challenge,777);await contact(777,phone);await hook(msg(777,{text:'/stop'}));
 assert.ok((await pg.query('SELECT consumed_at FROM telegram_registrations WHERE token_hash=$1',[digest(r.data.challenge)])).rows[0].consumed_at);
 assert.equal((await call('/auth/register',{...input,phone,verification:r.data.challenge})).statusCode,400);
});

test('registration fails closed without a bot, rate limits starts and protects proof storage',async()=>{
 env.TELEGRAM_BOT_TOKEN='';try{assert.equal((await call('/auth/register',input)).statusCode,503);}finally{env.TELEGRAM_BOT_TOKEN='qa'};
 await pg.exec('DELETE FROM rate_limits');for(let i=0;i<3;i++)assert.equal((await start('+998901234569')).statusCode,200);assert.equal((await start('+998901234569')).statusCode,429);
 await pg.exec('SET ROLE anon');try{
  await assert.rejects(pg.query('SELECT * FROM telegram_registrations'));
  await assert.rejects(pg.query(`SELECT zar_start_telegram_registration(repeat('a',64),123)`));
  await assert.rejects(pg.query(`SELECT zar_verify_telegram_registration(123,'+998901234567')`));
  await assert.rejects(pg.query(`SELECT zar_register_telegram_verified(repeat('a',64),'+998901234567','Name','hash')`));
 }finally{await pg.exec('RESET ROLE')}
});
