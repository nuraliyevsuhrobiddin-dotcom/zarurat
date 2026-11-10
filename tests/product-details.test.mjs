import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {normalizeServiceSearch,serviceMatches,checkoutQuotaRows,createServiceSelection,verifiedContactDetails} from '../public/product-details.js';
import {packageTiers} from '../public/package-tiers.js';

test('service search finds task keywords in Latin and Cyrillic and treats punctuation consistently',()=>{
 assert.equal(normalizeServiceSearch('  ҚАРОВЧИ  '),'qarovchi');
 assert.equal(normalizeServiceSearch('O‘ZGARTIRISH'),normalizeServiceSearch("o'zgartirish"));
 for(const query of ['kadastr','кадастр'])assert.equal(serviceMatches('documents','Hujjatlar','Davlat arizalari',query),true);
 for(const query of ['aliment','алимент'])assert.equal(serviceMatches('legal','Huquqiy maslahat','',query),true);
 assert.equal(serviceMatches('repair','Usta','Elektr ishlari','usta elektr'),true);
 assert.equal(serviceMatches('repair','Usta','Elektr ishlari','usta kadastr'),false);
 assert.equal(serviceMatches('repair','Usta','Elektr ishlari',''),true);
});

test('checkout quotas use the selected tier data and keep zero allowances explicit',()=>{
 for(const tier of packageTiers){
  for(const script of ['lat','cyr']){
   const rows=checkoutQuotaRows(tier,script);
   assert.deepEqual(rows.map(row=>row.count),[tier.legalConsultations,tier.psychologicalConsultations,tier.businessConsultations]);
   assert.deepEqual(rows.map(row=>row.id),['legal','psychology','business']);
   assert.match(rows[0].title,script==='cyr'?/Ҳуқуқий/:/Huquqiy/);
  }
 }
 assert.equal(checkoutQuotaRows(packageTiers[0])[2].count,0);
 assert.equal(checkoutQuotaRows({...packageTiers[0],legalConsultations:7})[0].count,7,'summary must not hard-code public tariff numbers');
});

test('explicit service change copies request fields once and discards old account data',()=>{
 const selection=createServiceSelection();
 const input={name:'QA Customer',phone:'+998901111113',description:'A service request',consent:true,password:'never-copy',token:'never-copy'};
 selection.begin('user:3',input,{packageName:'COMFORT',special:true});
 input.name='Changed outside';
 const selected=selection.consume('user:3');
 assert.equal(selected.values.name,'QA Customer');
 assert.equal('password' in selected.values,false);
 assert.equal('token' in selected.values,false);
 assert.equal(selected.packageName,'COMFORT');
 assert.equal(selected.special,true);
 assert.equal(selection.consume('user:3'),null);
 selection.begin('user:3',input);
 assert.equal(selection.peek('user:4'),null);
 assert.equal(selection.consume('user:3'),null,'switching accounts cannot revive an earlier transfer');
 selection.begin('guest',input);selection.clear();assert.equal(selection.consume('guest'),null);
});

test('verified contact fields omit unknown values and allow safe map search links only',()=>{
 assert.deepEqual(verifiedContactDetails({}),{hours:'',responseTime:'',map:''});
 const contact={hours:{lat:'24/7',cyr:'24/7'},responseTime:{lat:'',cyr:''},mapUrl:'https://www.google.com/maps/search/?api=1&query=Qarshi%20Yoshlar%20texnoparki'};
 assert.equal(verifiedContactDetails(contact,'cyr').hours,'24/7');
 assert.equal(verifiedContactDetails(contact).responseTime,'');
 assert.match(verifiedContactDetails(contact).map,/\/maps\/search\//);
 for(const mapUrl of ['javascript:alert(1)','http://www.google.com/maps','https://www.google.com.evil.test/maps'])assert.equal(verifiedContactDetails({...contact,mapUrl}).map,'');
});

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const familyCards=source.slice(source.indexOf('function familyCards()'),source.indexOf('\nfunction landing()'));
test('mobile tariff cards keep the first benefits visible and expand the rest without hiding plan actions',()=>{
 const render=mobileViewport=>runInNewContext(familyCards+';familyCards();',{
  packageTiers,pageLabel:lat=>lat,icon:()=>'',mobileViewport:()=>mobileViewport
 });
 const mobile=render(true);
 assert.equal((mobile.match(/<details class="package-more">/g)||[]).length,3);
 assert.match(mobile,/Yana 4 ta xizmat/);
 assert.match(mobile,/Yana 5 ta xizmat/);
 assert.match(mobile,/Yana 9 ta xizmat/);
 assert.equal((mobile.match(/data-action="buy-package"/g)||[]).length,3);
 const desktop=render(false);
 assert.equal((desktop.match(/<details class="package-more" open>/g)||[]).length,3);
});
const tracking=source.slice(source.indexOf('function trackingDialog('),source.indexOf('\nfunction registrationVerification('));
test('customer tracking offers owned cases while guests and staff keep the secret-key flow',()=>{
 for(const role of [null,'client','operator','partner','director']){
  let html='';
  runInNewContext(tracking+';trackingDialog();',{
   state:{script:'lat',user:role?{role}:null},pageLabel:lat=>lat,field:()=>'',icon:()=>'',formError:'',
   modalOpen(title,subtitle,content){html=content;}
  });
  assert.match(html,/id="track-form"/);
  if(role==='client')assert.match(html,/href="#cabinet\/cases"/);
  else assert.doesNotMatch(html,/id="my-cases-link"/);
 }
});

const checkout=source.slice(source.indexOf('async function checkoutDialog('),source.indexOf('\nfunction packageCards('));
test('rendered checkout includes consent-facing quota summary for each real tier and both scripts',async()=>{
 for(const tier of packageTiers){
  for(const script of ['lat','cyr']){
   let html='';
   const context={routeVersion:1,packageTiers,checkoutQuotaRows,state:{script,user:{role:'client',name:'QA Customer'}},
    api:async()=>({enabled:true,mode:'test'}),paymentMoney:value=>String(value/100),pageLabel:(lat,cyr)=>script==='cyr'?cyr:lat,
    tr:value=>value,esc:value=>String(value),textareaField:()=>'',formError:'',
    modalOpen(title,subtitle,content){html=content;}};
   await runInNewContext(checkout+`;checkoutDialog('${tier.name}');`,context);
   assert.match(html,/id="checkout-summary"/);
   for(const row of checkoutQuotaRows(tier,script)){
    assert.ok(html.includes(`data-quota="${row.id}"`));assert.ok(html.includes(row.title));
    assert.ok(html.includes(row.count?`${script==='cyr'?'Ойига':'Oyiga'} ${row.count}`:(script==='cyr'?'Пакетга кирмайди':'Paketga kirmaydi')));
   }
   assert.ok(html.indexOf('id="checkout-summary"')<html.indexOf('name="consent"'),'limits must appear before consent');
  }
 }
});

const selectionClick=source.slice(source.indexOf(' const selected=target.closest'),source.indexOf(" if(target.closest('.skip-link'))"));
test('choosing a concrete service after explicit change retains package context and clears unknown-service mode',()=>{
 for(const [category,expectedSpecial] of [['repair',false],['other',true]]){
  const selection=createServiceSelection();selection.begin('guest',{name:'QA Customer',phone:'+998901111113',description:'QA request',consent:true},{packageName:'COMFORT',special:true});
  const location={hash:''};let prevented=false;
  runInNewContext('(function(){const target=e.target;'+selectionClick+'})();',{
   e:{target:{closest:()=>({dataset:{category}})},preventDefault(){prevented=true;}},
   serviceSelection:selection,requestOwner:()=> 'guest',URLSearchParams,location
  });
  const params=new URLSearchParams(location.hash.split('?')[1]);
  assert.equal(params.get('category'),category);assert.equal(params.get('package'),'COMFORT');
  assert.equal(params.has('special'),expectedSpecial);assert.equal(prevented,true);
 }
 const selection=createServiceSelection();selection.begin('user:3',{name:'Private previous account'});
 const location={hash:''};
 runInNewContext('(function(){const target=e.target;'+selectionClick+'})();',{
  e:{target:{closest:()=>({dataset:{category:'repair'}})},preventDefault(){assert.fail('Old account selection must not intercept a normal category click');}},
  serviceSelection:selection,requestOwner:()=> 'user:4',URLSearchParams,location
 });
 assert.equal(location.hash,'');assert.equal(selection.consume('user:3'),null);
});

const request=source.slice(source.indexOf('function requestDialog('),source.indexOf('\nfunction successDialog('));
test('request renders its selected service and consumes explicit draft transfer once',()=>{
 const form={elements:{name:{value:''},phone:{value:''},description:{value:''},consent:{checked:false}}};
 const selection=createServiceSelection();selection.begin('guest',{name:'QA Customer',phone:'+998901111113',description:'Existing draft',consent:true});
 let html='',saved=0;
 runInNewContext(request+";requestDialog('repair');",{
  state:{script:'lat',config:{categories:[{id:'repair',name:'Usta'}]}},requestContact:()=>({name:'',phone:'+998'}),
  staff:()=>false,pageLabel:lat=>lat,esc:value=>String(value),category:()=> 'Usta',modal:{},$:()=>form,
  formError:'',field:()=>'',textareaField:()=>'',icon:()=>'',restoreRequestDraft(){},serviceSelection:selection,requestOwner:()=> 'guest',
  rememberRequestDraft(){saved++;},modalOpen(title,subtitle,content){html=content;}
 });
 assert.match(html,/id="request-service-selection"/);assert.match(html,/>Usta<\/strong>/);
 assert.match(html,/data-action="request-service-change"/);assert.match(html,/name="category" value="repair"/);
 assert.equal(form.elements.name.value,'QA Customer');assert.equal(form.elements.description.value,'Existing draft');
 assert.equal(form.elements.consent.checked,true);assert.equal(saved,1);assert.equal(selection.consume('guest'),null);
});

const packages=source.slice(source.indexOf('function packageCards('),source.indexOf('\nasync function packageDialog('));
test('manual packages disclose source while retaining their original balance and expiry',()=>{
 const record={tier:'Komfort',status:'active',remaining:3,limit:5,used:2,clientName:'QA Customer',expiresAt:'2027-11-05',members:['QA Customer']};
 const html=runInNewContext(packages+';packageCards();',{
  state:{packages:[record],user:{name:'QA Customer',role:'client'}},pageLabel:lat=>lat,esc:value=>String(value),tr:value=>value,
  packageName:()=> 'COMFORT',staff:()=>false,date:value=>value
 });
 assert.match(html,/manual-package-label/);assert.match(html,/Qo‘lda belgilangan paket/);
 assert.match(html,/3 <small>\/ 5/);assert.match(html,/2027-11-05/);
 assert.equal(record.limit,5);assert.equal(record.remaining,3);assert.equal(record.expiresAt,'2027-11-05');
});
