import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureLeadSource,readLeadSource} from '../public/lead-source.js';
import {leadSource,alertStaffNewRequest} from '../server/staff-alerts.mjs';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),data};};

test('the ad source from the landing link is kept for 30 days and survives sign-up',()=>{
 const storage=memory(),day=24*60*60*1000;
 assert.deepEqual(captureLeadSource('?utm_source=Instagram&utm_medium=cpc&utm_campaign=noyabr<script>',storage,0),{source:'instagram',medium:'cpc',campaign:'noyabrscript'});
 // Later pages without utm keep the stored source.
 assert.deepEqual(captureLeadSource('',storage,5*day),{source:'instagram',medium:'cpc',campaign:'noyabrscript'});
 assert.equal(readLeadSource(storage,31*day),null);
 assert.equal(captureLeadSource('?fbclid=abc',memory(),0).source,'facebook');
 assert.equal(captureLeadSource('?gclid=abc',memory(),0).source,'google');
 assert.equal(captureLeadSource('?ref=x',memory(),0),null);
 const broken={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(captureLeadSource('?utm_source=x',broken,0),null);assert.equal(readLeadSource(broken),null);
});

test('server keeps only short marketing labels as the request source',()=>{
 assert.equal(leadSource({source:'Instagram',medium:'CPC',campaign:'Noyabr 2026!'}),'instagram / cpc / noyabr2026');
 assert.equal(leadSource({source:'',medium:'cpc'}),'');
 for(const value of [null,'instagram',['instagram'],{source:'<>'}])assert.equal(leadSource(value),'');
});

test('staff alert reaches linked coordinators without the client phone or request text',async()=>{
 const env={FEATURE_TELEGRAM:'true',TELEGRAM_BOT_TOKEN:'t',TELEGRAM_WEBHOOK_SECRET:'s',PUBLIC_ORIGIN:'https://www.zaruriyat.uz'};
 const db=async(resource)=>resource==='cases'
  ?[{id:42,number:'ZAR-000042',name:'Dilnoza Karimova',category:'legal'}]
  :[{id:1,role:'director',telegram_chat_id:100},{id:2,role:'operator',telegram_chat_id:200},{id:3,role:'operator',telegram_chat_id:null},{id:4,role:'operator',telegram_chat_id:400,blocked_at:'2026-01-01'}];
 const original=globalThis.fetch,sent=[];
 globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 try{
  assert.equal(await alertStaffNewRequest(db,env,{id:42,source:'instagram / cpc'}),2);
  assert.deepEqual(sent.map(m=>m.chat_id).sort(),[100,200]);
  const message=sent[0];
  assert.match(message.text,/ZAR-000042/);assert.match(message.text,/Huquqiy maslahat/);assert.match(message.text,/Dilnoza/);assert.match(message.text,/instagram \/ cpc/);
  assert.doesNotMatch(message.text,/Karimova|\+998/);
  assert.equal(message.reply_markup.inline_keyboard[0][0].url,'https://www.zaruriyat.uz/#cabinet/case?id=42');
  assert.equal(await alertStaffNewRequest(db,{...env,FEATURE_TELEGRAM:'false'},{id:42}),0);
 }finally{globalThis.fetch=original;}
});
