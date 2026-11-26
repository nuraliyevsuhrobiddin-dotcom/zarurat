import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile('public/app.js','utf8');
test('request creation buttons are only available to customers and guests',()=>{
 const fn=source.slice(source.indexOf('const newRequestButton='),source.indexOf('\nfunction stat('));
 for(const role of ['director','operator','partner','client',null]){
  const html=runInNewContext(fn+';newRequestButton();',{state:{user:role?{role}:null,script:'lat'},icon:()=>''});
  if(role==='client'||role===null)assert.match(html,/data-action="request"/);
  else assert.equal(html,'');
 }
});

test('staff opening customer pages are redirected before customer forms render',async()=>{
 const fn=source.slice(source.indexOf('async function renderRoute()'),source.indexOf('\nfunction pageHeading('));
 for(const role of ['director','operator'])for(const path of ['request','checkout','track','family','services','home']){
  const location={hash:'#'+path};let formRendered=false;
  const context={state:{user:{role}},location,routeVersion:0,route:()=>null,rememberRequestDraft(){},clearTimeout(){},paymentReturnTimer:null,cancelApiReads(){},serviceSelection:{clear(){},peek(){}},requestOwner:()=>role,
   app:{classList:{toggle(){}}},mobileViewport:()=>true,renderMobilePage(){formRendered=true;return true;}};
  runInNewContext(fn,context);await context.renderRoute();
  assert.equal(location.hash,'cabinet/overview');assert.equal(formRendered,false);
 }
});

const dialog=source.slice(source.indexOf('function partnerCallList('),source.indexOf('\nasync function refreshSavedCase('));
function render(role,overrides={}){
 let html,title,subtitle;
 const c={id:1,number:'ZAR-000001',status:'reviewing',name:'Client',phone:'+998901234567',category:'legal',description:'Consultation',coordinatorId:null,services:[],attachments:[],history:[],feedback:role==='operator'?{rating:5,comment:'Good service'}:null,...overrides};
 const context={c,state:{user:{role},partners:[{id:1,name:'Legal partner',phone:'+998905555555',category:'legal',region:'Qashqadaryo',hours:'09-18',contractStatus:'active'},{id:2,name:'Doctor',phone:'+998906666666',category:'medical',contractStatus:'active'},{id:3,name:'Expired lawyer',phone:'+998907777777',category:'legal',contractStatus:'expired'}],team:[],authOptions:{},config:{categories:[],regions:[]}},staff:()=>role==='operator',terminal:s=>['completed','cancelled'].includes(s.status),
 pageLabel:lat=>lat,tr:v=>v,esc:v=>String(v??''),badge:(v,service)=>`<span>${service?'SERVICE:':''}${v}</span>`,category:v=>v,date:()=>'',responsibleName:()=>'',money:v=>String(v),
 subscriptionSummary:()=>'',selectField:(name)=>`<select name="${name}"></select>`,statusOptions:()=>'',statusHelp:()=>'',options:()=>'',roleNames:{},
 coordinatorChoices:()=>[],field:(name)=>`<input name="${name}">`,textareaField:(name)=>`<textarea name="${name}"></textarea>`,icon:()=>'',formError:'',toLocalInput:()=>'',packageName:v=>v,attachmentButton:()=>'',
 caseReadOnly:()=>'<div>CLIENT VIEW</div>',timeline:()=>'<div>INTERNAL TIMELINE</div>',feedbackForm:()=>{throw new Error('Staff feedback must be read only');},modalOpen:(heading,sub,content)=>{title=heading;subtitle=sub;html=content;}};
 runInNewContext(dialog+';renderCaseDialog(c);',context);
 return {html,title,subtitle};
}
test('coordinator works by phone: call, matching partner phones, note and close without assigning a partner',()=>{
 const {html,title,subtitle}=render('operator',{status:'received'});
 assert.equal(title,'Murojaat tafsilotlari');assert.match(subtitle,/qo‘ng‘iroq/);
 assert.match(html,/href="tel:\+998901234567"/);assert.match(html,/data-action="case-contact" data-id="1" data-claim="1"/);
 assert.match(html,/Legal partner/);assert.match(html,/href="tel:\+998905555555"/);
 assert.doesNotMatch(html,/Doctor|Expired lawyer/);
 assert.match(html,/data-action="case-finish" data-id="1"/);assert.doesNotMatch(html,/case-finish[^>]*disabled/);
 assert.match(html,/case-update-form/);assert.match(html,/name="note"/);
 assert.doesNotMatch(html,/service-add-form|service-update-form|name="partnerId"|Hamkorni biriktirish/);
 assert.match(html,/INTERNAL TIMELINE/);assert.match(html,/Mijoz bahosi/);assert.doesNotMatch(html,/feedback-form/);
});
test('coordinator records the partner arranged by phone and can remove it',()=>{
 const fresh=render('operator').html;
 assert.match(fresh,/data-action="case-partner" data-id="1" data-partner="1"/);
 // Partners outside the request category are offered in a list; expired ones never.
 assert.match(fresh,/class="partner-picker"/);assert.match(fresh,/data-action="case-partner-pick" data-id="1"/);
 assert.doesNotMatch(fresh,/arranged-partners/);
 const {html}=render('operator',{services:[{id:4,title:'Telefon orqali kelishildi',status:'accepted',partnerId:1,partnerName:'Legal partner',partnerPhone:'+998905555555'},{id:5,title:'Old',status:'cancelled',partnerId:2,partnerName:'Doctor'}]});
 assert.match(html,/Gaplashilgan/);assert.doesNotMatch(html,/data-action="case-contact"/);
 assert.match(html,/Kelishilgan hamkor/);assert.match(html,/<b>Legal partner<\/b> <a href="tel:\+998905555555"/);
 assert.match(html,/data-action="case-partner-remove" data-id="1" data-service="4"/);
 // The arranged partner is not offered again; a removed one is offered again.
 assert.doesNotMatch(html,/data-partner="1"/);assert.doesNotMatch(html,/data-service="5"/);
 assert.doesNotMatch(html,/<form class="service-update-form"|<select name="partnerId"/);
 const closed=render('operator',{status:'completed',services:[{id:4,status:'completed',partnerId:1,partnerName:'Legal partner'}]}).html;
 assert.match(closed,/Kelishilgan hamkor/);assert.doesNotMatch(closed,/case-partner/);
});
test('closed requests and customers get no coordinator controls',()=>{
 const closed=render('operator',{status:'completed'}).html;
 assert.doesNotMatch(closed,/case-update-form|case-finish|case-contact/);assert.match(closed,/Murojaat yopilgan/);
 const client=render('client');
 assert.match(client.html,/CLIENT VIEW/);assert.doesNotMatch(client.html,/case-update-form|INTERNAL TIMELINE|tel:\+998905555555/);
 assert.match(client.subtitle,/Murojaatingiz holati/);
});
test('coordinator sees where the request came from, customers never do',()=>{
 const history=[{id:1,kind:'source',message:'Manba: instagram / cpc / noyabr'}];
 assert.match(render('operator',{history}).html,/Qayerdan keldi<\/dt><dd>instagram \/ cpc \/ noyabr<\/dd>/);
 assert.doesNotMatch(render('operator').html,/Qayerdan keldi/);
 assert.doesNotMatch(render('client',{history}).html,/Qayerdan keldi|instagram/);
});
