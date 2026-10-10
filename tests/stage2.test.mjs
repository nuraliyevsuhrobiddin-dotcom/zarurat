import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {smsReady,telegramReady,sendSms} from '../server/providers.mjs';
import {notificationText,handleTelegramWebhook} from '../server/telegram.mjs';

let pg;
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(await readFile('migrations/002_accounts_notifications.sql','utf8'));
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES('boss','Boss','+998901111111',extensions.crypt('long-password',extensions.gen_salt('bf',4)),'director'),('customer','Customer','+998902222222',extensions.crypt('long-password',extensions.gen_salt('bf',4)),'client');`);
});
after(async()=>{await pg?.close();});
test('OTP verification is single use, expires and counts failed attempts',async()=>{
 const id='a'.repeat(64),code='b'.repeat(64);
 assert.equal((await pg.query(`SELECT zar_start_otp('+998902222222','reset',null,$1,$2) AS r`,[code,id])).rows[0].r,null);
 await pg.query(`SELECT zar_start_otp('+998902222222','verify',2,$1,$2)`,[code,id]);
 assert.equal((await pg.query(`SELECT zar_confirm_otp($1,$2,'verify',2,null) AS r`,[id,'c'.repeat(64)])).rows[0].r.ok,false);
 assert.equal((await pg.query('SELECT attempts FROM otp_challenges WHERE id=$1',[id])).rows[0].attempts,1);
 assert.equal((await pg.query(`SELECT zar_confirm_otp($1,$2,'verify',2,null) AS r`,[id,code])).rows[0].r.ok,true);
 assert.equal((await pg.query(`SELECT zar_confirm_otp($1,$2,'verify',2,null) AS r`,[id,code])).rows[0].r.ok,false);
 const expired='d'.repeat(64);await pg.query(`SELECT zar_start_otp('+998902222222','verify',2,$1,$2)`,[code,expired]);
 await pg.query(`UPDATE otp_challenges SET expires_at=now()-interval '1 minute' WHERE id=$1`,[expired]);
 assert.equal((await pg.query(`SELECT zar_confirm_otp($1,$2,'verify',2,null) AS r`,[expired,code])).rows[0].r.ok,false);
});
test('recovery atomically changes the password and revokes sessions',async()=>{
 const id='e'.repeat(64),code='f'.repeat(64);
 await pg.query(`SELECT zar_start_otp('+998902222222','reset',null,$1,$2)`,[code,id]);
 await pg.exec(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(repeat('7',64),2,now()+interval '1 hour')`);
 const result=await pg.query(`SELECT zar_confirm_otp($1,$2,'reset',null,extensions.crypt('new-password',extensions.gen_salt('bf',4))) AS r`,[id,code]);
 assert.equal(result.rows[0].r.ok,true);
 assert.equal((await pg.query('SELECT count(*) AS n FROM sessions WHERE user_id=2')).rows[0].n,0);
 assert.equal((await pg.query(`SELECT zar_login('customer','new-password') AS r`)).rows[0].r.id,2);
});
test('Telegram binding is one-time and notification claiming avoids concurrent delivery',async()=>{
 await pg.exec(`INSERT INTO telegram_links(token_hash,user_id,expires_at) VALUES(repeat('8',64),2,now()+interval '30 minutes')`);
 assert.equal((await pg.query(`SELECT zar_bind_telegram(repeat('8',64),777) AS ok`)).rows[0].ok,true);
 assert.equal((await pg.query(`SELECT zar_bind_telegram(repeat('8',64),999) AS ok`)).rows[0].ok,false);
 const input={name:'Fixture',phone:'+998902222222',region:'Toshkent shahri',category:'legal',description:'Fixture case text',preferred_time:'Istalgan vaqt',attachments:[]};
 await pg.query(`SELECT zar_create_request($1::jsonb,2)`,[JSON.stringify(input)]);
 const rows=(await pg.query(`SELECT zar_claim_notifications('claim-a') AS r`)).rows[0].r;
 assert.equal(rows.length,1);assert.equal(rows[0].chatId,777);
 assert.equal((await pg.query(`SELECT zar_claim_notifications('claim-b') AS r`)).rows[0].r.length,0);
 assert.equal((await pg.query(`SELECT zar_finish_notification($1,'wrong',true,1,null) AS r`,[rows[0].id])).rows[0].r,false);
 assert.equal((await pg.query(`SELECT zar_finish_notification($1,'claim-a',true,1,null) AS r`,[rows[0].id])).rows[0].r,true);
 assert.equal((await pg.query(`SELECT zar_claim_notifications('claim-c') AS r`)).rows[0].r.length,0);
});
test('director blocking revokes sessions, blocks login and cannot block own account',async()=>{
 await pg.query('SELECT zar_set_block(1,2,true)');
 assert.equal((await pg.query(`SELECT zar_login('customer','new-password') AS r`)).rows[0].r,null);
 await assert.rejects(pg.query('SELECT zar_set_block(1,1,true)'));
 await pg.query('SELECT zar_set_block(1,2,false)');
 assert.equal((await pg.query(`SELECT zar_login('customer','new-password') AS r`)).rows[0].r.id,2);
});
test('providers stay disabled until configured and webhook rejects forgery/group chats',async()=>{
 assert.equal(smsReady({SMS_PROVIDER:'twilio'}),false);assert.equal(telegramReady({TELEGRAM_BOT_TOKEN:'test'}),false);
 await assert.rejects(sendSms('+998901111111','123456',{}));
 const env={FEATURE_STAGE2:'true',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_WEBHOOK_SECRET:'secret'};
 await assert.rejects(handleTelegramWebhook({headers:{}},{},()=>{throw new Error('must not run');},env));
 const group=await handleTelegramWebhook({headers:{'x-telegram-bot-api-secret-token':'secret'}},{message:{chat:{type:'group',id:777},from:{id:777},text:'/start '+ 'a'.repeat(64)}},()=>{throw new Error('must not run');},env);
 assert.equal(group.ok,true);
 const msg=notificationText({caseNumber:'ZAR-000001',caseStatus:'received',description:'PRIVATE',phone:'+998901111111'});
 assert.ok(!msg.includes('PRIVATE'));assert.ok(!msg.includes('+998'));
});
