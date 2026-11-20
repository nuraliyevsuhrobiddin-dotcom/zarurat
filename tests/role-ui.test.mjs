import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {partnerServiceCounts} from '../public/workspace-roles.js';

const source=await readFile('public/app.js','utf8');
test('request creation buttons are only available to customers and guests',()=>{
 const fn=source.slice(source.indexOf('const newRequestButton='),source.indexOf('\nfunction stat('));
 for(const role of ['director','operator','partner','client',null]){
  const html=runInNewContext(fn+';newRequestButton();',{state:{user:role?{role}:null,script:'lat'},icon:()=>''});
  if(role==='client'||role===null)assert.match(html,/data-action="request"/);
  else assert.equal(html,'');
 }
});

test('staff and partners opening customer pages are redirected before customer forms render',async()=>{
 const fn=source.slice(source.indexOf('async function renderRoute()'),source.indexOf('\nfunction pageHeading('));
 for(const role of ['director','operator','partner'])for(const path of ['request','checkout','track','family','services','home']){
  const location={hash:'#'+path};let formRendered=false;
  const context={state:{user:{role}},location,routeVersion:0,route:()=>null,rememberRequestDraft(){},clearTimeout(){},paymentReturnTimer:null,cancelApiReads(){},serviceSelection:{clear(){},peek(){}},requestOwner:()=>role,
   app:{classList:{toggle(){}}},mobileViewport:()=>true,renderMobilePage(){formRendered=true;return true;}};
  runInNewContext(fn,context);await context.renderRoute();
  assert.equal(location.hash,'cabinet/overview');assert.equal(formRendered,false);
 }
});

test('partner cards use each assigned service status rather than the coordinator case status',()=>{
 const fn=source.slice(source.indexOf('function partnerCaseCards('),source.indexOf('\nfunction responsibleName('));
 const context={pageLabel:lat=>lat,esc:v=>String(v??'').replaceAll('<','&lt;'),badge:(status,service)=>`${service?'SERVICE':'CASE'}:${status}`,empty:(a,b,c)=>a+b+c};
 runInNewContext(fn,context);
 const html=context.partnerCaseCards([{id:1,number:'ZAR-1',status:'cancelled',name:'Customer',phone:'+998901234567',description:'Need support',services:[{title:'Assigned consultation',status:'accepted'},{title:'Assigned document help',status:'completed'}]}]);
 assert.match(html,/Assigned consultation/);assert.match(html,/Assigned document help/);assert.match(html,/SERVICE:accepted/);assert.match(html,/SERVICE:completed/);assert.doesNotMatch(html,/CASE:cancelled/);assert.match(html,/href="tel:\+998901234567"/);assert.match(html,/data-action="case" data-id="1"/);
 assert.match(context.partnerCaseCards([]),/Sizga xizmat hali biriktirilmagan/);
});
const dialog=source.slice(source.indexOf('function renderCaseDialog('),source.indexOf('\nasync function refreshSavedCase('));
function render(role){
 let html,title;
 const c={id:1,number:'ZAR-000001',status:'reviewing',name:'Client',phone:'+998901234567',category:'legal',description:'Consultation',services:[{id:4,title:'Own consultation',status:'accepted',partnerId:1,partnerName:'Partner'}],attachments:[],history:[],feedback:role==='operator'?{rating:5,comment:'Good service'}:null};
 const context={c,state:{user:{role},partners:[{id:1,contractStatus:'active'}],team:[],authOptions:{}},staff:()=>role==='operator',terminal:()=>false,
 pageLabel:lat=>lat,tr:v=>v,esc:v=>String(v??''),badge:v=>`<span>${v}</span>`,category:v=>v,date:()=>'',responsibleName:()=>'',
 subscriptionSummary:()=>'',coordinatorActions:()=>'<div>COORDINATOR ACTIONS</div>',selectField:()=>'',statusOptions:()=>'',statusHelp:()=>'',options:()=>'',assignmentPartnerOptions:()=>'',partnerAccessMarkup:()=>'',
 coordinatorChoices:()=>[],field:()=>'',textareaField:()=>'',simpleServiceOptions:()=>'',icon:()=>'',formError:'',serviceOrder:['pending','accepted','contacted','delivered','completed'],serviceNames:{accepted:'Accepted'},requestStatuses:{},
 timeline:()=>'<div>INTERNAL TIMELINE</div>',feedbackForm:()=>{throw new Error('Staff feedback must be read only');},modalOpen:(heading,subtitle,content)=>{title=heading;html=content;}};
 runInNewContext(dialog+';renderCaseDialog(c);',context);
 return {html,title};
}
test('partner dialog has only service progression and no coordinator forms or internal history',()=>{
 const {html,title}=render('partner');
 assert.equal(title,'Biriktirilgan xizmatlar');
 assert.match(html,/service-update-form/);assert.match(html,/name="status" value="contacted"/);
 assert.match(html,/Umumiy murojaat holati/);
 assert.doesNotMatch(html,/case-update-form|service-add-form|name="partnerId"|COORDINATOR ACTIONS|INTERNAL TIMELINE|feedback-form/);
});
test('coordinator keeps case controls; started service assignment is locked and feedback is read only',()=>{
 const {html}=render('operator');
 assert.match(html,/case-update-form/);assert.match(html,/service-add-form/);assert.match(html,/COORDINATOR ACTIONS/);
 assert.match(html,/<select name="partnerId" disabled/);
 assert.match(html,/INTERNAL TIMELINE/);assert.match(html,/Mijoz bahosi/);assert.doesNotMatch(html,/feedback-form/);
});
test('partner overview renders service totals rather than coordinator case totals',()=>{
 const fn=source.slice(source.indexOf('function partnerOverview('),source.indexOf('\nfunction personalOverview('));
 const counts=[];
 const html=runInNewContext(fn+';partnerOverview();',{partnerServiceCounts,state:{cases:[{status:'reviewing',services:[{status:'completed'},{status:'accepted'}]}]},pageHeading:()=>'',pageLabel:v=>v,stat:(title,value)=>{counts.push([title,value]);return '';},caseCards:()=>''});
 assert.deepEqual(counts,[['Xizmatlarim',2],['Jarayonda',1],['Bajarilgan xizmatlar',1],['Bekor qilingan xizmatlar',0]]);
 assert.match(html,/Murojaatni koordinator boshqaradi|Xizmatlarimni ko‘rish/);
});
