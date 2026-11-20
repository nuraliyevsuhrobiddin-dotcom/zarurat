import{test}from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
import{filterTeam,filterPartners,notificationPage,passwordTarget}from'../public/admin-workspace.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('staff search and status filters keep blocked accounts distinguishable',()=>{
 const users=[{id:1,name:'Rahbar',role:'director',login:'boss',phone:'+998901111111',blocked:false},{id:2,name:'Koordinator',role:'operator',login:'operator-qa',phone:'+998901234567',blocked:true}];
 assert.deepEqual(filterTeam(users,{search:'OPERATOR-QA'}).map(u=>u.id),[2]);
 assert.deepEqual(filterTeam(users,{search:'90 123 45'}).map(u=>u.id),[2]);
 assert.deepEqual(filterTeam(users,{status:'active'}).map(u=>u.id),[1]);
 assert.deepEqual(filterTeam(users,{status:'blocked'}).map(u=>u.id),[2]);
});
test('notification views preserve history and paginate filtered results',()=>{
 const rows=Array.from({length:45},(_,i)=>({id:i,source:i%2?'internal':'delivery',event:i%2?'subscription.activated':'case.status_changed',status:i%2?'recorded':'failed',clientName:'Family '+i,recipientPhone:'+998901234567'}));
 const page=notificationPage(rows,{kind:'subscriptions'});assert.equal(page.total,22);assert.equal(page.rows.length,20);assert.equal(page.hasMore,true);
 assert.equal(notificationPage(rows,{kind:'subscriptions',limit:40}).rows.length,22);
 assert.ok(notificationPage(rows,{kind:'attention'}).rows.every(n=>n.source==='delivery'));
 assert.equal(notificationPage(rows,{search:'Family 44'}).total,1);assert.equal(rows.length,45);
 assert.equal(notificationPage(rows,{kind:'sent'}).total,0);
});
test('password targets exclude customers and directors',()=>{
 assert.equal(passwordTarget({role:'client'}),null);assert.equal(passwordTarget({role:'director'}),null);assert.equal(passwordTarget(null),null);
 assert.equal(passwordTarget({id:7,role:'operator'}).id,7);
});

test('incoming requests, subscriptions, activity and outgoing deliveries stay in separate lists',()=>{
 const rows=[{id:'r',source:'incoming',event:'request.created',clientName:'Mijoz',status:'received'},{id:'d',source:'delivery',event:'request.created',status:'failed'},{id:'h',source:'internal',event:'case.assignment_changed'},{id:'s',source:'internal',event:'subscription.activated'}];
 for(const [category,id] of [['incoming','r'],['delivery','d'],['activity','h'],['subscriptions','s']])assert.deepEqual(notificationPage(rows,{category}).rows.map(n=>n.id),[id]);
 assert.equal(notificationPage(rows,{category:'incoming',kind:'attention'}).total,0);
 assert.equal(notificationPage(rows,{category:'incoming',search:'mijoz'}).total,1);
});

test('polling updates category counts without replacing focused tab buttons',()=>{
 const count={textContent:'0'},attributes={};
 const button={dataset:{category:'incoming'},classList:{toggle(name,active){assert.equal(name,'active');assert.equal(active,true);}},setAttribute(name,value){attributes[name]=value;},querySelector(){return count;}};
 const tabs={querySelectorAll(){return [button];},set innerHTML(value){throw new Error('Replacing tabs loses keyboard focus');}};
 const fn=source.slice(source.indexOf('function updateNotificationTabs('),source.indexOf('\nfunction notificationRowsMarkup('));
 runInNewContext(fn+';updateNotificationTabs();',{$:()=>tabs,state:{notifications:[{source:'incoming'}]},notificationCategorySelected:'incoming',notificationCategory:r=>r.source});
 assert.equal(count.textContent,'1');assert.equal(attributes['aria-pressed'],'true');assert.equal(tabs.querySelectorAll()[0],button);
});

test('incoming notifications reuse the actual case status badge',()=>{
 const fn=source.slice(source.indexOf('function notificationStatusBadge('),source.indexOf('\nlet notificationLimit'));
 const statuses=[];const context={badge(status){statuses.push(status);return 'case-'+status;},notificationStatusLabel:()=> 'delivery'};
 runInNewContext(fn,context);
 for(const status of ['received','reviewing','completed','cancelled'])assert.equal(context.notificationStatusBadge({source:'incoming',status}),'case-'+status);
 assert.deepEqual(statuses,['received','reviewing','completed','cancelled']);
 assert.match(context.notificationStatusBadge({source:'delivery',status:'failed'}),/pill red/);
});
test('partner search combines formatted phone, direction and contract status',()=>{
 const partners=[{id:1,name:'Family partner',phone:'+998901234567',region:'Qashqadaryo',category:'legal',contractStatus:'active'},{id:2,name:'Expired partner',phone:'+998901111111',region:'Qashqadaryo',category:'legal',contractStatus:'expired'}];
 assert.deepEqual(filterPartners(partners,{search:'90 123 45',category:'legal',status:'active'}).map(p=>p.id),[1]);
 assert.deepEqual(filterPartners(partners,{status:'expired'}).map(p=>p.id),[2]);
 assert.equal(filterPartners(partners,{category:'medical'}).length,0);
});
test('password form identifies the account before confirmation and escapes its name',()=>{
 const fn=source.slice(source.indexOf('function passwordDialog('),source.indexOf('\nasync function recoveryDialog'));
 let html;runInNewContext(fn+';passwordDialog(7,{name:"<target>",login:"operator-7",role:"operator"});',{modalOpen(a,b,c){html=c;},tr:v=>v,roleNames:{operator:'Koordinator'},formError:'',field:()=>'',esc:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;')});
 assert.match(html,/password-target/);assert.match(html,/&lt;target&gt;/);assert.match(html,/operator-7/);assert.match(html,/data-user="7"/);assert.doesNotMatch(html,/<target>/);
});
test('closing a loading case prevents a late response from reopening it',async()=>{
 const fn=source.slice(source.indexOf('async function caseDialog('),source.indexOf('\nfunction statusHelp'));
 let resolve,renders=0;const body={isConnected:true},modal={open:false,querySelector:()=>body};
 const context={routeVersion:1,modal,state:{},api:()=>new Promise(r=>{resolve=r;}),staff:()=>false,tr:v=>v,modalOpen(){modal.open=true;},renderCaseDialog(){renders++;},esc:v=>v};
 runInNewContext(fn,context);const pending=context.caseDialog(1);modal.open=false;body.isConnected=false;resolve({case:{id:1}});await pending;assert.equal(renders,0);
});
