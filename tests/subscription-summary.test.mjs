import{test}from'node:test';
import assert from'node:assert/strict';
import{enrichSubscriptions}from'../server/subscription-summary.mjs';
import{subscriptionSummary}from'../public/subscription-summary.js';
import{paymentPanel}from'../public/payments.js';
import{activeSubscription,displayDate}from'../public/payment-state.js';
const now=new Date('2026-11-13T12:00:00Z');
const sub=(overrides={})=>({id:1,client_id:3,tier:'STANDARD',mode:'live',status:'active',starts_at:'2026-11-01',expires_at:'2026-12-01',terms:{legalConsultations:2,psychologicalConsultations:1,businessConsultations:0},...overrides});
test('staff see current live subscriptions, remaining quotas and recorded case',async()=>{
 const result={clients:[{id:3},{id:4}],cases:[{id:7,clientId:3}]};
 await enrichSubscriptions(result,{role:'operator'},async(table,{query})=>{
  const q=new URLSearchParams(query);assert.equal(q.get('limit'),'500');
  if(table==='family_subscriptions'){
   assert.equal(q.get('mode'),'eq.live');assert.equal(q.get('status'),'eq.active');
   assert.equal(q.get('client_id'),'in.(3,4)');
   return[sub(),sub({id:2,mode:'test'}),sub({id:3,status:'cancelled'}),sub({id:4,expires_at:'2026-11-12'}),sub({id:5,starts_at:'2027-01-01'})];
  }
  return[{subscription_id:1,kind:'legal',case_id:7}];
 },now);
 assert.equal(result.clients[0].subscription.items.length,1);
 assert.deepEqual(result.clients[0].subscription.items[0].remaining,{legal:1,psychology:1,business:0});
 assert.equal(result.clients[1].subscription.state,'none');
 assert.equal(result.cases[0].subscription.items[0].caseRecorded,true);
});
test('failed or missing payment tables are unavailable, never no subscription',async()=>{
 const result={case:{id:8,clientId:3}};
 await enrichSubscriptions(result,{role:'director'},async()=>{throw Error('offline');},now);
 assert.equal(result.case.subscription.state,'unavailable');
 assert.match(subscriptionSummary(result.case.subscription),/olinmadi/);
});
test('customer, partner and public responses never query or expose staff summaries',async()=>{
 for(const role of ['client','partner',undefined]){
  const result={case:{id:8,clientId:3}};
  await enrichSubscriptions(result,{role},()=>assert.fail('unauthorized lookup'),now);
  assert.equal(result.case.subscription,undefined);
 }
});
test('subscription lookups paginate and do not lose benefits after 500 records',async()=>{
 const result={clients:[{id:3}]};let pages=0;
 await enrichSubscriptions(result,{role:'operator'},async(table,{query})=>{
  if(table==='subscription_usage')return[];
  const offset=Number(new URLSearchParams(query).get('offset'));pages++;
  return offset===0?Array.from({length:500},(_,i)=>sub({id:i+1})): [sub({id:501})];
 },now);
 assert.equal(pages,2);assert.equal(result.clients[0].subscription.items.length,501);
});
test('staff subscription dashboard links customers and hides history until opened',()=>{
 const clients=[{id:3,name:'<QA>',phone:'+998901111113',subscription:{state:'active',items:[{id:1,tier:'STANDARD',expiresAt:'2026-12-01',remaining:{legal:2,psychology:1,business:0}}]}}];
 const html=paymentPanel({payments:[{id:'qa-order',tier:'STANDARD',amount:9900000,status:'paid',mode:'live',created_at:'2026-11-13'}],subscriptions:[]},'lat',clients,true);
 assert.match(html,/Faol obunali mijozlar/);assert.match(html,/#cabinet\/cases\?clientId=3/);
 assert.match(html,/&lt;QA&gt;/);assert.doesNotMatch(html,/<QA>/);
 assert.match(html,/<details class="case-extra payment-history-details"><summary>To‘lovlar tarixi/);
 assert.match(html,/data-action="subscription-use"/);
});
test('guest requests say unlinked and never assert that the person has no subscription',async()=>{
 const result={cases:[{id:10,clientId:null}]};await enrichSubscriptions(result,{role:'operator'},async()=>[],now);
 assert.equal(result.cases[0].subscription.state,'unlinked');
 const html=subscriptionSummary(result.cases[0].subscription);assert.match(html,/Hisobga bog‘lanmagan/);assert.doesNotMatch(html,/Faol obuna yo‘q/);
});
test('only current live subscriptions block purchasing and dates have a stable format',()=>{
 const s={mode:'live',status:'active',starts_at:'2026-11-01',expires_at:'2026-12-01'};
 assert.equal(activeSubscription(s,now.getTime()),true);
 for(const overrides of [{mode:'test'},{status:'cancelled'},{starts_at:'2027-01-01'},{expires_at:'2026-11-01'}])assert.equal(activeSubscription({...s,...overrides},now.getTime()),false);
 assert.equal(displayDate('2026-11-12T12:00:00Z'),'12.11.2026');assert.equal(displayDate('invalid'),'—');
});
