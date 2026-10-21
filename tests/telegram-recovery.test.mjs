import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {handleAccount} from '../server/account.mjs';
import {testDatabase} from './helpers/database.mjs';
import {otpHash} from '../server/account.mjs';
import {smsReady,telegramReady,stage2} from '../server/providers.mjs';

let pg,db;const env={FEATURE_TELEGRAM:'true',TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_WEBHOOK_SECRET:'test-only',OTP_SECRET:'test-only'};
const req={headers:{},socket:{remoteAddress:'127.0.0.1'}};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 for(const file of ['supabase-schema.sql','migrations/002_accounts_notifications.sql','migrations/006_telegram_recovery.sql'])await pg.exec(await readFile(file,'utf8'));
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role,telegram_chat_id) VALUES('tg-client','Telegram client','+998901234567',extensions.crypt('old-password',extensions.gen_salt('bf',4)),'client',12345),('unlinked','Unlinked','+998901234568',extensions.crypt('old-password',extensions.gen_salt('bf',4)),'client',NULL);`);
 db=testDatabase(pg);
});
after(async()=>{await pg?.close();});
const account=(path,body,options={})=>handleAccount({path,method:'POST',body,req,db,env,...options});
const start=async(id,code='123456')=>pg.query(`SELECT zar_start_telegram_recovery('tg-client',$1,$2) AS r`,[otpHash(id,code,env),id]);
const confirm=async(id,code='123456')=>pg.query(`SELECT zar_confirm_telegram_recovery($1,$2,extensions.crypt('new-password',extensions.gen_salt('bf',4))) AS r`,[id,otpHash(id,code,env)]);
const clear=async()=>pg.exec('DELETE FROM telegram_recovery; DELETE FROM rate_limits;');

test('Telegram flag enables Telegram while SMS and staff blocking remain disabled',async()=>{
 assert.equal(telegramReady(env),true);assert.equal(stage2(env),false);
 assert.equal(smsReady({...env,SMS_PROVIDER:'twilio',TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test',TWILIO_FROM:'test'}),false);
 await assert.rejects(account('/users/2',{blocked:true,currentPassword:'test'},{method:'PATCH',user:{id:1,role:'director'}}),/hali faollashtirilmagan/);
 const flags=await handleAccount({path:'/account',method:'GET',user:{id:1,telegram_chat_id:12345},db,env});
 assert.equal(flags.telegramEnabled,true);assert.equal(flags.telegramConnected,true);assert.equal(flags.stage2Enabled,false);assert.equal(flags.smsEnabled,false);
});

test('Telegram recovery works without SMS, hides account existence, resets password and revokes sessions',async()=>{
 const original=globalThis.fetch;const messages=[];
 globalThis.fetch=async(url,options)=>{assert.ok(String(url).startsWith('https://api.telegram.org/bot'));messages.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 try{
  const result=await account('/auth/recovery/telegram/request',{login:' TG-CLIENT '});
  assert.equal(messages.length,1);assert.equal(messages[0].chat_id,12345);
  const code=messages[0].text.match(/\b\d{6}\b/)[0];assert.ok(!JSON.stringify(result).includes(code));
  const absent=await account('/auth/recovery/telegram/request',{login:'unknown'});
  const unlinked=await account('/auth/recovery/telegram/request',{login:'unlinked'});
  assert.deepEqual(Object.keys(absent),Object.keys(result));assert.equal(absent.message,result.message);assert.equal(unlinked.message,result.message);assert.equal(messages.length,1);
  await pg.exec(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(repeat('1',64),1,now()+interval '1 hour');`);
  assert.equal((await account('/auth/recovery/telegram/confirm',{challenge:result.challenge,code,password:'new-password-2026'})).ok,true);
  assert.equal((await pg.query('SELECT count(*) AS n FROM sessions WHERE user_id=1')).rows[0].n,0);
  assert.equal((await pg.query(`SELECT zar_login('tg-client','new-password-2026') AS r`)).rows[0].r.id,1);
  assert.equal((await pg.query('SELECT phone_verified_at FROM users WHERE id=1')).rows[0].phone_verified_at,null);
  await assert.rejects(account('/auth/recovery/telegram/confirm',{challenge:result.challenge,code,password:'new-password-2026'}),/Kod noto/);
 }finally{globalThis.fetch=original;}
});

test('Telegram codes expire and five wrong attempts lock the challenge',async()=>{
 await clear();const id='a'.repeat(64);await start(id);
 for(let i=0;i<5;i++)assert.equal((await confirm(id,'000000')).rows[0].r.ok,false);
 assert.equal((await confirm(id)).rows[0].r.ok,false);
 assert.equal((await pg.query('SELECT attempts FROM telegram_recovery WHERE id=$1',[id])).rows[0].attempts,5);
 await clear();await start(id);await pg.exec(`UPDATE telegram_recovery SET expires_at=now()-interval '1 minute'`);
 assert.equal((await confirm(id)).rows[0].r.ok,false);
});

test('Telegram unlink, blocking and password changes invalidate pending reset codes',async()=>{
 const id='b'.repeat(64);
 for(const change of ['unlink','blocked','password']){
  await clear();await pg.exec('UPDATE users SET telegram_chat_id=12345,blocked_at=NULL WHERE id=1');await start(id);
  if(change==='unlink'){await pg.exec('SELECT zar_unlink_telegram(12345); UPDATE users SET telegram_chat_id=12345 WHERE id=1');}
  if(change==='blocked')await pg.exec('UPDATE users SET blocked_at=now() WHERE id=1');
  if(change==='password')await pg.exec(`UPDATE users SET password_hash=extensions.crypt('different-password',extensions.gen_salt('bf',4)) WHERE id=1`);
  assert.equal((await confirm(id)).rows[0].r.ok,false,change);
 }
});

test('Telegram recovery cooldown covers login and phone; delivery failures remain generic',async()=>{
 await clear();await pg.exec('UPDATE users SET telegram_chat_id=12345,blocked_at=NULL WHERE id=1');
 await start('c'.repeat(64));
 assert.equal((await pg.query(`SELECT zar_start_telegram_recovery('+998901234567',$1,$2) AS r`,['e'.repeat(64),'d'.repeat(64)])).rows[0].r,null);
 await clear();const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('provider unavailable');};
 try{const result=await account('/auth/recovery/telegram/request',{login:'tg-client'});assert.equal(result.ok,true);assert.match(result.challenge,/^[a-f0-9]{64}$/);}finally{globalThis.fetch=original;}
});

test('Telegram recovery rejects disabled provider, malformed codes and public database access',async()=>{
 await assert.rejects(account('/auth/recovery/telegram/request',{login:'tg-client'},{env:{}}),/hali ulanmagan/);
 await assert.rejects(account('/auth/recovery/telegram/confirm',{challenge:'f'.repeat(64),code:'abcdef',password:'long-password'}),/kodi noto/);
 await pg.exec('SET ROLE anon');
 try{
  await assert.rejects(pg.query('SELECT * FROM telegram_recovery'));
  await assert.rejects(start('f'.repeat(64)));
  await assert.rejects(confirm('f'.repeat(64)));
 }finally{await pg.exec('RESET ROLE');}
});
