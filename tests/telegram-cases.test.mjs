import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {testDatabase} from './helpers/database.mjs';
import {handleTelegramWebhook} from '../server/telegram.mjs';

let pg,db,id=0;
const env={FEATURE_TELEGRAM:'true',FEATURE_TELEGRAM_CASES:'true',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_WEBHOOK_SECRET:'test',PUBLIC_ORIGIN:'https://example.test'};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 for(const f of ['supabase-schema.sql','migrations/002_accounts_notifications.sql','migrations/006_telegram_recovery.sql','migrations/008_telegram_contact_recovery.sql','migrations/009_telegram_recovery_retries.sql','migrations/010_telegram_cases.sql'])await pg.exec(await readFile(f,'utf8'));
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role,telegram_chat_id) VALUES
 ('bot-client','Bot client','+998901111111','test','client',111),
 ('other-client','Other client','+998902222222','test','client',222),
 ('staff','Staff','+998903333333','test','director',333);`);
 db=testDatabase(pg);
});
after(async()=>{await pg?.close();});
const action=(p_action,p_value='',chat=111,message=++id)=>db('rpc/zar_telegram_case_action',{method:'POST',body:{p_chat_id:chat,p_message_id:message,p_action,p_value}});

test('bot requests require category, description and explicit consent; retries never create twice',async()=>{
 assert.equal((await action('new')).state,'category');
 assert.equal((await action('category','invalid')).state,'category');
 assert.equal((await action('category','legal')).state,'description');
 assert.equal((await action('text','short')).state,'description');
 assert.equal((await action('text','Mening huquqiy masalam bo‘yicha yordam kerak.')).state,'confirm');
 assert.equal((await pg.query('SELECT count(*) AS n FROM cases')).rows[0].n,0);
 assert.equal((await action('text','roziman')).state,'confirm');
 const message=++id,result=await action('submit','',111,message);
 assert.equal(result.state,'created');assert.match(result.case.number,/^ZAR-/);
 assert.ok(!JSON.stringify(result).includes('trackingToken'));
 assert.equal((await action('submit','',111,message)).case.number,result.case.number);
 assert.equal((await action('submit')).case.number,result.case.number);
 const rows=(await pg.query('SELECT client_id,name,phone,category FROM cases')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].client_id,1);assert.equal(rows[0].phone,'+998901111111');
 assert.equal((await pg.query('SELECT description FROM telegram_case_drafts WHERE chat_id=111')).rows[0].description,null);
});

test('tracking never exposes another client, staff, blocked accounts, internal notes or tracking secrets',async()=>{
 const list=await action('list');assert.equal(list.cases.length,1);
 const number=list.cases[0].number;
 assert.equal((await action('track',number)).state,'case');
 assert.equal((await action('track',number,222)).state,'missing');
 assert.equal((await action('new','',333)).state,'unlinked');
 assert.equal((await action('new','',999)).state,'unlinked');
 assert.deepEqual(Object.keys((await action('track',number)).case).sort(),['createdAt','number','status','updatedAt']);
 await pg.exec('UPDATE users SET blocked_at=now() WHERE id=1');
 assert.equal((await action('list')).state,'unlinked');
 await pg.exec('UPDATE users SET blocked_at=NULL WHERE id=1');
});

test('draft cancellation, expiry, unlinking and out-of-order updates cannot submit a stale request',async()=>{
 await action('new');await action('category','legal');
 const message=++id;
 await action('text','Yangi murojaat bo‘yicha yordam kerak.',111,message);
 assert.equal((await action('cancel','',111,message-1)).state,'duplicate');
 assert.equal((await action('cancel')).state,'menu');
 assert.equal((await action('submit')).state,'menu');
 await action('new');await action('category','legal');await action('text','Yangi murojaat bo‘yicha yordam kerak.');
 await pg.exec("UPDATE telegram_case_drafts SET expires_at=now()-interval '1 second' WHERE chat_id=111");
 assert.equal((await action('submit')).state,'expired');
 await action('new');await pg.exec('SELECT zar_unlink_telegram(111)');
 assert.equal((await pg.query('SELECT count(*) AS n FROM telegram_case_drafts WHERE chat_id=111')).rows[0].n,0);
 assert.equal((await action('submit')).state,'unlinked');
 await pg.exec('UPDATE users SET telegram_chat_id=111 WHERE id=1');
});

test('webhook offers a working menu, category choices, validation, creation and tracking',async()=>{
 const original=globalThis.fetch,messages=[];
 globalThis.fetch=async(url,options)=>{messages.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 const hook=text=>handleTelegramWebhook({headers:{'x-telegram-bot-api-secret-token':'test'}},{message:{message_id:++id,chat:{id:111,type:'private'},from:{id:111},text}},db,env);
 try{
  await hook('/start');assert.ok(messages.at(-1).reply_markup.keyboard);
  await hook('🌐 Shaxsiy kabinet');
  assert.equal(messages.at(-1).reply_markup.inline_keyboard[1][0].url,env.PUBLIC_ORIGIN+'/#recovery');
  await hook('/new');assert.ok(messages.at(-1).reply_markup.keyboard.some(row=>row[0].text==='❌ Bekor qilish'));
  const categoryButton=messages.at(-1).reply_markup.keyboard.flat().find(b=>b.text.startsWith('⚖️'));
  await hook(categoryButton.text);assert.match(messages.at(-1).text,/10–3500/);
  await hook('Telegram orqali murojaat yuborish uchun sinov matni.');assert.match(messages.at(-1).text,/rozilik/);
  await hook('✅ Roziman, yuborish');assert.ok(messages.some(m=>m.text?.includes('Murojaatingiz qabul qilindi')));
  await hook('/cases');assert.match(messages.at(-1).text,/ZAR-/);
  const caseButton=messages.at(-1).reply_markup.keyboard[0][0].text;
  assert.match(caseButton,/^ZAR-/);
  await hook(caseButton);assert.match(messages.at(-1).text,/Tafsilotlar/);
  await hook('🏠 Asosiy menyu');assert.match(messages.at(-1).text,/Asosiy menyu/);
  await hook('/track ZAR-999999');assert.match(messages.at(-1).text,/topilmadi/);
 }finally{globalThis.fetch=original;}
});

test('unlinked bot menu points to the existing website recovery page',async()=>{
 const original=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 try{
  await handleTelegramWebhook({headers:{'x-telegram-bot-api-secret-token':'test'}},{message:{message_id:++id,chat:{id:999,type:'private'},from:{id:999},text:'/start'}},db,env);
  assert.equal(sent.reply_markup.inline_keyboard.at(-1)[0].url,env.PUBLIC_ORIGIN+'/#recovery');
 }finally{globalThis.fetch=original;}
});

test('webhook retry restores the prompt after a Telegram delivery failure',async()=>{
 const original=globalThis.fetch,message_id=++id;let sent;
 const body={message:{message_id,chat:{id:111,type:'private'},from:{id:111},text:'/new'}};
 const req={headers:{'x-telegram-bot-api-secret-token':'test'}};
 try{
  globalThis.fetch=async()=>{throw new Error('temporary delivery failure');};
  await assert.rejects(handleTelegramWebhook(req,body,db,env),/temporary delivery/);
  globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
  await handleTelegramWebhook(req,body,db,env);
  assert.ok(sent.reply_markup.keyboard.flat().some(b=>b.text.startsWith('⚖️')));
 }finally{globalThis.fetch=original;}
});

test('public roles cannot read bot drafts or invoke actions',async()=>{
 await pg.exec('SET ROLE anon');
 try{await assert.rejects(pg.query('SELECT * FROM telegram_case_drafts'));await assert.rejects(action('list'));}
 finally{await pg.exec('RESET ROLE');}
});

test('ratings require ownership and completion, and cannot overwrite an existing rating',async()=>{
 const number=(await action('list')).cases[0].number;
 const value=JSON.stringify({number,rating:5,comment:'Rahmat'});
 assert.equal((await action('rate',value)).state,'rating_unavailable');
 await pg.query("UPDATE cases SET status='completed' WHERE number=$1",[number]);
 assert.equal((await action('rate',value,222)).state,'rating_unavailable');
 assert.equal((await action('rate',JSON.stringify({number,rating:6}))).state,'invalid');
 assert.equal((await action('rate',value)).state,'rated');
 assert.equal((await action('rate',JSON.stringify({number,rating:1}))).state,'already_rated');
 assert.equal((await pg.query('SELECT rating FROM feedback')).rows[0].rating,5);
});

test('request creation rate limit is enforced atomically',async()=>{
 for(let i=0;i<5;i++){
  await action('new');await action('category','other');await action('text','Sinov murojaati uchun yetarlicha uzun tavsif.');
  const result=await action('submit');
  const count=(await pg.query('SELECT count(*) AS n FROM cases WHERE client_id=1')).rows[0].n;
  if(count===5){assert.ok(['created','limited'].includes(result.state));}
 }
 assert.equal((await action('submit')).state,'limited');
 assert.equal((await pg.query('SELECT count(*) AS n FROM cases WHERE client_id=1')).rows[0].n,5);
});
