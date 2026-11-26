import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {testDatabase} from './helpers/database.mjs';
import {handleTelegramWebhook} from '../server/telegram.mjs';
import {requiredChannel} from '../server/telegram-cases.mjs';

let pg,db,id=0;
// The mandatory channel check has its own test; other flows run without it.
const env={FEATURE_TELEGRAM:'true',FEATURE_TELEGRAM_CASES:'true',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_WEBHOOK_SECRET:'test',PUBLIC_ORIGIN:'https://example.test',TELEGRAM_REQUIRED_CHANNEL:''};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 for(const f of ['supabase-schema.sql','migrations/002_accounts_notifications.sql','migrations/006_telegram_recovery.sql','migrations/008_telegram_contact_recovery.sql','migrations/009_telegram_recovery_retries.sql','migrations/010_telegram_cases.sql','migrations/014_request_subscription_access.sql','migrations/015_telegram_request_access.sql','migrations/018_telegram_contact_account.sql','migrations/018_telegram_contact_account.sql'])await pg.exec(await readFile(f,'utf8'));
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

test('second Telegram request requires a subscription and preserves its draft until activated',async()=>{
 await action('new');await action('category','legal');await action('text','Ikkinchi murojaat uchun huquqiy yordam kerak.');
 assert.equal((await action('submit')).state,'subscription_required');
 assert.equal((await pg.query('SELECT count(*) AS n FROM cases')).rows[0].n,1);
 const draft=(await pg.query('SELECT stage,description FROM telegram_case_drafts WHERE chat_id=111')).rows[0];
 assert.equal(draft.stage,'confirm');assert.ok(draft.description);
 await pg.exec("SELECT zar_save_package(1,'Start',now()+interval '1 month',5,'[\"Bot client\"]')");
 assert.equal((await action('submit')).state,'created');
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
  assert.deepEqual(messages.at(-1).reply_markup.keyboard.map(row=>row.map(b=>b.text)),[['📝 Murojaat yuborish'],['📋 Murojaatlarim','🗂 Xizmatlar'],['💳 Tariflar','☎️ Aloqa']]);
  await hook('☎️ Aloqa');assert.match(messages.at(-1).text,/\+998 55 406 77 55/);
  assert.ok(messages.at(-1).reply_markup.inline_keyboard.flat().some(b=>b.url===env.PUBLIC_ORIGIN+'/#recovery'));
  await hook('🌐 Shaxsiy kabinet');assert.match(messages.at(-1).text,/ZARURIYAT CENTER/);
  // Tariffs come with the bank QR code as a photo the customer can save to the gallery.
  await hook('💳 Tariflar');assert.match(messages.at(-1).caption,/STANDARD — 99 000/);assert.match(messages.at(-1).caption,/shu QR-kod orqali/);
  assert.equal(messages.at(-1).photo,env.PUBLIC_ORIGIN+'/images/payment-qr.png');assert.ok(messages.at(-1).caption.length<=1024);
  await hook('/new');assert.ok(messages.at(-1).reply_markup.keyboard.some(row=>row[0].text==='❌ Bekor qilish'));
  const categoryButton=messages.at(-1).reply_markup.keyboard.flat().find(b=>b.text.startsWith('⚖️'));
  await hook(categoryButton.text);assert.match(messages.at(-1).text,/kamida 10 belgi/);
  await hook('Telegram orqali murojaat yuborish uchun sinov matni.');assert.match(messages.at(-1).text,/rozilik/);
  assert.match(messages.at(-1).text,/Telegram orqali murojaat yuborish uchun sinov matni/);assert.match(messages.at(-1).text,/\+998901111111/);
  await hook('✅ Roziman, yuborish');assert.ok(messages.some(m=>m.text?.includes('Murojaatingiz qabul qilindi')));
  await hook('/cases');assert.match(messages.at(-1).text,/ZAR-/);
  const caseButton=messages.at(-1).reply_markup.keyboard[0][0].text;
  assert.match(caseButton,/^ZAR-/);
  await hook(caseButton);assert.match(messages.at(-1).text,/Tafsilotlar/);
  await hook('🏠 Asosiy menyu');assert.match(messages.at(-1).text,/Asosiy menyu/);
  await hook('/track ZAR-999999');assert.match(messages.at(-1).text,/topilmadi/);
 }finally{globalThis.fetch=original;}
});

test('a new Telegram user confirms the phone once and sends a request like on the website',async()=>{
 const original=globalThis.fetch,messages=[];
 globalThis.fetch=async(url,options)=>{messages.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 const chat=444,send=extra=>handleTelegramWebhook({headers:{'x-telegram-bot-api-secret-token':'test'}},{message:{message_id:++id,chat:{id:chat,type:'private'},from:{id:chat,first_name:'Aziza'},...extra}},db,env);
 try{
  await send({text:'/start'});
  assert.match(messages.at(-1).text,/Asosiy menyu/);assert.ok(messages.at(-1).reply_markup.keyboard);
  await send({text:'📝 Murojaat yuborish'});
  assert.match(messages.at(-1).text,/Telefon raqamingizni tasdiqlang/);
  assert.equal(messages.at(-1).reply_markup.keyboard[0][0].request_contact,true);
  // A forwarded or foreign contact proves nothing.
  await send({contact:{phone_number:'998905556677',user_id:999,first_name:'Other'}});
  assert.match(messages.at(-1).text,/o‘zingizning raqamingizni/);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM users WHERE telegram_chat_id=$1',[chat])).rows[0].n,0);
  await send({contact:{phone_number:'998905556677',user_id:chat,first_name:'Aziza',last_name:'Karimova'}});
  const user=(await pg.query('SELECT id,name,phone,login,role,phone_verified_at FROM users WHERE telegram_chat_id=$1',[chat])).rows[0];
  assert.equal(user.name,'Aziza Karimova');assert.equal(user.phone,'+998905556677');assert.equal(user.login,'+998905556677');assert.equal(user.role,'client');assert.ok(user.phone_verified_at);
  assert.ok(messages.some(m=>/hisobingiz ochildi/.test(m.text||'')));
  assert.ok(messages.at(-1).reply_markup.keyboard.flat().some(b=>b.text.startsWith('⚖️')));
  await send({text:'⚖️ Huquqiy maslahat'});
  await send({text:'Aliment bo‘yicha maslahat kerak, ertaga qulay.'});
  assert.match(messages.at(-1).text,/Aliment bo‘yicha maslahat kerak/);assert.match(messages.at(-1).text,/Aziza Karimova/);
  await send({text:'✅ Roziman, yuborish'});
  assert.ok(messages.some(m=>/Murojaatingiz qabul qilindi/.test(m.text||'')));
  // The bot confirmation is not followed by a duplicate status notification.
  assert.ok(!messages.some(m=>/murojaat holati/.test(m.text||'')));
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM notifications n JOIN cases c ON c.id=n.case_id WHERE c.phone='+998905556677' AND n.event='request.created' AND n.status='sent'")).rows[0].n,1);
  const created=(await pg.query('SELECT client_id,phone,category FROM cases WHERE client_id=$1',[user.id])).rows;
  assert.equal(created.length,1);assert.equal(created[0].phone,'+998905556677');assert.equal(created[0].category,'legal');
  // Sharing again is harmless and keeps the same account.
  await send({contact:{phone_number:'+998905556677',user_id:chat,first_name:'Aziza'}});
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM users WHERE phone='+998905556677'")).rows[0].n,1);
 }finally{globalThis.fetch=original;}
});

test('phone confirmation links an existing client and refuses staff, taken and foreign numbers',async()=>{
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES('+998907770000','Site client','+998907770000','x','client')`);
 const link=(chat,phone)=>db('rpc/zar_telegram_contact_account',{method:'POST',body:{p_chat_id:chat,p_phone:phone,p_name:'Telegram'}});
 assert.equal((await link(555,'998907770000')).state,'linked');
 assert.equal((await pg.query("SELECT telegram_chat_id::int AS c FROM users WHERE phone='+998907770000'")).rows[0].c,555);
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM users WHERE phone='+998907770000'")).rows[0].n,1);
 assert.equal((await link(556,'998907770000')).state,'other_chat');
 assert.equal((await link(557,'998903333333')).state,'staff');
 assert.equal((await pg.query("SELECT telegram_chat_id::int AS c FROM users WHERE phone='+998903333333'")).rows[0].c,333);
 assert.equal((await link(558,'79161234567')).state,'foreign_phone');
 assert.equal((await link(0,'998907770000')).state,'invalid');
 await pg.exec("INSERT INTO users(login,name,phone,password_hash,role,blocked_at) VALUES('+998907771111','Blocked','+998907771111','x','client',now())");
 assert.equal((await link(559,'998907771111')).state,'unavailable');
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM users WHERE telegram_chat_id IN (556,557,558,559)')).rows[0].n,0);
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

test('bot requires channel membership; the check button opens the menu and failures stay open',async()=>{
 const channelEnv={...env,TELEGRAM_REQUIRED_CHANNEL:'https://t.me/zaruriyat_center_murojatlar'};
 const original=globalThis.fetch,calls=[];let status='left',broken=false;
 globalThis.fetch=async(url,options)=>{
  const method=url.split('/').pop(),body=JSON.parse(options.body);calls.push({method,body});
  if(method==='getChatMember'){
   if(broken)return {ok:false,status:400,json:async()=>({ok:false,error_code:400,description:'member list is inaccessible'})};
   return {ok:true,json:async()=>({ok:true,result:{status}})};
  }
  return {ok:true,json:async()=>({ok:true,result:{message_id:50}})};
 };
 const req={headers:{'x-telegram-bot-api-secret-token':'test'}};
 const message=text=>handleTelegramWebhook(req,{message:{message_id:++id,chat:{id:111,type:'private'},from:{id:111},text}},db,channelEnv);
 const check=(data='check_channel',chat=111)=>handleTelegramWebhook(req,{callback_query:{id:'cb'+(++id),data,from:{id:111},message:{message_id:50,chat:{id:chat,type:chat===111?'private':'group'}}}},db,channelEnv);
 try{
  const draftsBefore=(await pg.query('SELECT last_message_id FROM telegram_case_drafts WHERE chat_id=111')).rows[0].last_message_id;
  await message('📝 Murojaat yuborish');
  const prompt=calls.filter(c=>c.method==='sendMessage').at(-1).body;
  assert.match(prompt.text,/kanaliga a’zo bo‘ling/);
  assert.equal(prompt.reply_markup.inline_keyboard[0][0].url,'https://t.me/zaruriyat_center_murojatlar');
  assert.equal(prompt.reply_markup.inline_keyboard[1][0].callback_data,'check_channel');
  assert.equal(calls.find(c=>c.method==='getChatMember').body.chat_id,'@zaruriyat_center_murojatlar');
  // Nothing reaches the request flow before joining.
  assert.equal((await pg.query('SELECT last_message_id FROM telegram_case_drafts WHERE chat_id=111')).rows[0].last_message_id,draftsBefore);
  await check();
  const alert=calls.filter(c=>c.method==='answerCallbackQuery').at(-1).body;assert.equal(alert.show_alert,true);
  assert.equal(calls.filter(c=>c.method==='sendMessage').at(-1).body,prompt);
  status='member';
  await check();
  assert.ok(calls.some(c=>c.method==='editMessageText'&&/a’zo bo‘ldingiz/.test(c.body.text)));
  assert.match(calls.filter(c=>c.method==='sendMessage').at(-1).body.text,/Asosiy menyu/);
  await message('💳 Tariflar');assert.match(calls.filter(c=>c.method==='sendPhoto').at(-1).body.caption,/Oila obunasi/);
  status='restricted';await message('/start');assert.match(calls.filter(c=>c.method==='sendMessage').at(-1).body.text,/kanaliga a’zo/);
  broken=true;await message('/start');assert.match(calls.filter(c=>c.method==='sendMessage').at(-1).body.text,/Asosiy menyu/);
  const count=calls.length;await check('other');await check('check_channel',-100);assert.equal(calls.length,count);
 }finally{globalThis.fetch=original;}
 assert.equal(requiredChannel({TELEGRAM_REQUIRED_CHANNEL:'@zaruriyat_center_murojatlar'}),'zaruriyat_center_murojatlar');
 assert.equal(requiredChannel({}),'zaruriyat_center_murojatlar');
 assert.equal(requiredChannel({TELEGRAM_REQUIRED_CHANNEL:''}),'');
});

test('a bot request alerts linked staff once, records its source and ad links open the menu',async()=>{
 const original=globalThis.fetch,messages=[];
 globalThis.fetch=async(url,options)=>{messages.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 const send=(chat,extra)=>handleTelegramWebhook({headers:{'x-telegram-bot-api-secret-token':'test'}},{message:{message_id:++id,chat:{id:chat,type:'private'},from:{id:chat,first_name:'Nodira'},...extra}},db,env);
 const alerts=()=>messages.filter(m=>m.chat_id===333&&/Yangi murojaat/.test(m.text||''));
 try{
  await send(666,{text:'/start instagram_noyabr'});
  assert.match(messages.at(-1).text,/Asosiy menyu/);assert.doesNotMatch(messages.at(-1).text,/yaroqsiz/);
  await send(666,{contact:{phone_number:'998906660066',user_id:666,first_name:'Nodira'}});
  await send(666,{text:'🩺 Shifokorga yo‘naltirish'});
  await send(666,{text:'Kardiolog ko‘rigiga yozilish kerak, iltimos.'});
  await send(666,{text:'✅ Roziman, yuborish'});
  assert.equal(alerts().length,1);
  const alert=alerts()[0];
  assert.match(alert.text,/Shifokorga yo‘naltirish/);assert.match(alert.text,/Manba: Telegram bot/);assert.doesNotMatch(alert.text,/998906660066|Kardiolog/);
  const caseId=Number(alert.reply_markup.inline_keyboard[0][0].url.match(/id=(\d+)$/)[1]);
  assert.deepEqual((await pg.query("SELECT message FROM history WHERE case_id=$1 AND kind='source'",[caseId])).rows.map(r=>r.message),['Manba: Telegram bot']);
  // The key shown in the cabinet is the same short one as on the website.
  assert.match((await pg.query('SELECT tracking_token FROM cases WHERE id=$1',[caseId])).rows[0].tracking_token,/^[2-9A-HJKMNP-Z]{8}$/);
  // A second tap returns the same request without another alert.
  await send(666,{text:'✅ Roziman, yuborish'});
  assert.equal(alerts().length,1);
  // Staff who linked Telegram get alert guidance instead of the client menu.
  await send(333,{text:'/start'});
  assert.match(messages.at(-1).text,/xodimi sifatida ulangansiz/);
 }finally{globalThis.fetch=original;}
});

test('if Telegram cannot fetch the QR image, tariffs still arrive as text pointing to the site',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  const method=url.split('/').pop();calls.push({method,body:JSON.parse(options.body)});
  if(method==='sendPhoto')return {ok:false,status:400,json:async()=>({ok:false,error_code:400,description:'wrong file identifier/HTTP URL specified'})};
  return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};
 };
 try{
  await handleTelegramWebhook({headers:{'x-telegram-bot-api-secret-token':'test'}},{message:{message_id:++id,chat:{id:111,type:'private'},from:{id:111},text:'💳 Tariflar'}},db,env);
  assert.deepEqual(calls.map(c=>c.method),['sendPhoto','sendMessage']);
  const text=calls[1].body.text;
  assert.match(text,/Oila obunasi/);assert.match(text,/QR-kod saytdagi tarif oynasida/);assert.match(text,/\+998 55 406 77 55/);
  assert.equal(calls[1].body.reply_markup.inline_keyboard[0][0].url,env.PUBLIC_ORIGIN+'/#family');
 }finally{globalThis.fetch=original;}
});
