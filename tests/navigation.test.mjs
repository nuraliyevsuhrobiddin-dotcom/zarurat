import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('rotating during submission defers rebuilding the form and preserves its confirmation',async()=>{
 const refresh=source.slice(source.indexOf('async function refreshPresentation()'),source.indexOf('\nfunction isMobileFormRoute'));
 let saving=true,renders=0,restores=0,confirmed;
 const confirmation={case:{id:8,number:'ZAR-000008'},trackingToken:'qa-only'};
 const context={
  document:{querySelector(){return saving?{}:null;}},
  location:{hash:'#request'},modal:{open:true},state:{lastSubmission:confirmation},
  presentationDraft:null,presentationRefreshPending:false,$:()=>null,
  captureVisibleForms:()=>[],restoreVisibleForms(){restores++;},
  async renderRoute(){renders++;context.state.lastSubmission=null;},
  successDialog(result){confirmed=result;}
 };
 await runInNewContext(refresh+';refreshPresentation();',context);
 assert.equal(renders,0,'A pending submission must keep the original form connected');
 assert.equal(context.presentationRefreshPending,true);
 await context.refreshPresentation();
 assert.equal(renders,0,'Repeated rotation must not create another form');
 saving=false;
 await context.refreshPresentation();
 assert.equal(renders,1);
 assert.equal(context.presentationRefreshPending,false);
 assert.equal(confirmed,confirmation,'The successful server response must survive the layout change');
 assert.equal(restores,1);
});

test('hashchange does not repeat an explicitly rendered navigation or replay intermediate routes',()=>{
 let listener,calls=0;
 const context={window:{addEventListener(name,callback){assert.equal(name,'hashchange');listener=callback;}},
  history:{state:{zarEntry:true}},location:{hash:'#checkout?package=STANDARD'},
  navigationReady:true,renderedHash:'#checkout?package=STANDARD',renderRoute(){calls++;},URL};
 runInNewContext(source.split('\n').find(line=>line.startsWith("window.addEventListener('hashchange'")),context);
 listener({oldURL:'https://example.com/#login'});
 assert.equal(calls,0,'login already rendered checkout; the queued hashchange must preserve its form');
 context.location.hash='#home';
 listener({oldURL:'https://example.com/#checkout'});
 assert.equal(calls,1,'new navigation must still render');
 context.renderedHash='#home';
 listener({oldURL:'https://example.com/#services'});
 assert.equal(calls,1,'queued intermediate events must not rebuild the current page');
});
const back=source.slice(source.indexOf('function mobileBack(){'),source.indexOf('\nfunction finishPage()'));

const bottomNav=source.slice(source.indexOf("function mobileBottomNav("),source.indexOf('\nfunction menuRow('));
test('mobile navigation selects only the current work section, including profile and team password pages',()=>{
 const fn=source.slice(source.indexOf('function finishPage()'),source.indexOf('\nfunction mobileHeader('));
 for(const [route,selected] of [['cabinet/settings','cabinet/settings'],['cabinet/password','cabinet/settings'],['cabinet/staff-password','cabinet/menu'],['cabinet/partners','cabinet/menu'],['cabinet/packages','cabinet/menu'],['cabinet/package-use?id=1','cabinet/menu'],['cabinet/subscription-use?id=1','cabinet/menu'],['cabinet/case?id=1','cabinet/cases'],['cabinet/notifications','cabinet/notifications']]){
  const items=['cabinet/overview','cabinet/cases','cabinet/menu','cabinet/notifications','cabinet/settings'].map(target=>({hash:'#'+target,dataset:{},active:false,setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},classList:{toggle(key,value){this.owner.active=value;}}}));
  for(const item of items)item.classList.owner=item;
  runInNewContext(fn+';finishPage();',{document:{body:{classList:{remove(){}}},documentElement:{},querySelectorAll:()=>items},window:{scrollTo(){}},state:{user:{role:'director'},script:'lat'},location:{hash:'#'+route},modal:{open:false},app:{},$:()=>null});
  assert.deepEqual(items.filter(item=>item.active).map(item=>item.hash),['#'+selected]);
  assert.equal(items.filter(item=>item['aria-current']==='page').length,1);
 }
});
test('customer checkout keeps the subscription tab selected',()=>{
 const fn=source.slice(source.indexOf('function finishPage()'),source.indexOf('\nfunction mobileHeader('));
 const items=['cabinet/overview','cabinet/cases','request','cabinet/packages','cabinet/settings'].map(target=>({hash:'#'+target,dataset:{},active:false,setAttribute(){},removeAttribute(){},classList:{toggle(key,value){this.owner.active=value;}}}));
 for(const item of items)item.classList.owner=item;
 runInNewContext(fn+';finishPage();',{document:{body:{classList:{remove(){}}},documentElement:{},querySelectorAll:()=>items},window:{scrollTo(){}},state:{user:{role:'client'},script:'lat'},location:{hash:'#checkout?package=STANDARD'},modal:{open:false},app:{},$:()=>null});
 assert.deepEqual(items.filter(item=>item.active).map(item=>item.hash),['#cabinet/packages']);
});
const overviewLinks=source.slice(source.indexOf('function overviewQuickLinks()'),source.indexOf('function personalOverview()'));
const personalOverview=source.slice(source.indexOf('function personalOverview()'),source.indexOf('function responsibleName'));
test('authenticated mobile tasks retain cabinet navigation on direct links and reloads',()=>{
 for(const role of ['client','partner','director']){
  for(const hash of ['#request','#request?special=1','#checkout?tier=COMFORT','#track']){
   for(const from of [undefined,'#home','#cabinet/overview']){
    const html=runInNewContext(bottomNav+';mobileBottomNav();',{
     location:{hash},history:{state:from?{zarFrom:from}:null},state:{user:{role}},
     staff:()=>role==='director',pageLabel:lat=>lat,icon:()=>'',esc:value=>value
    });
    assert.match(html,/data-context="cabinet"/,`${role} ${hash} from ${from}`);
    assert.match(html,/href="#cabinet\/settings"/);
    assert.match(html,/>Profil<\/span>/);
    if(role==='director')assert.match(html,/href="#cabinet\/menu"/);
    else assert.doesNotMatch(html,/href="#cabinet\/menu"/);
    if(role==='client')assert.match(html,/href="#request"/);
    else assert.doesNotMatch(html,/href="#request"/);
    assert.doesNotMatch(html,/href="#services"/);
    if(role==='partner')assert.doesNotMatch(html,/href="#cabinet\/packages"/);
    if(role==='director')assert.match(html,/href="#cabinet\/notifications"/);
   }
  }
 }
});

test('cabinet menu sections are available on overview and keep role-scoped links',()=>{
 const sideLinks=[{hash:'#cabinet/cases',textContent:'Murojaatlar'},{hash:'#cabinet/packages',textContent:'Oila paketlari'},{hash:'#cabinet/clients',textContent:'Mijozlar'}];
 const bottomLinks=[{hash:'#cabinet/cases'},{hash:'#cabinet/packages'}];
 const html=runInNewContext(overviewLinks+';overviewQuickLinks();',{
  document:{querySelectorAll:selector=>selector==='.side-nav a'?sideLinks:selector==='.mobile-bottom-bar .mb-item[href]'?bottomLinks:[]},mobileViewport:()=>true,
  pageLabel:lat=>lat,icon:name=>`<svg data-icon="${name}"></svg>`,esc:value=>value
 });
 assert.doesNotMatch(html,/href="#cabinet\/(cases|packages)"/);
 assert.match(html,/href="#cabinet\/clients"/);
 assert.doesNotMatch(html,/href="#home"/);
 assert.doesNotMatch(html,/href="#privacy"/);
 assert.doesNotMatch(html,/data-action="toggle-script"/);
});

test('mobile overview leaves request and family details in their dedicated tabs',()=>{
 const context={state:{user:{role:'client',name:'QA Client'},cases:[],packages:[{id:1}]},terminal:()=>false,
  pageHeading:()=>'',pageLabel:v=>v,tr:value=>value,newRequestButton:()=>'',stat:()=>'',icon:()=>'',overviewQuickLinks:()=>'',
  caseCards:()=>'<div>REQUEST CARDS</div>',packageCards:()=>'<div>FAMILY DETAILS</div>'};
 const mobile=runInNewContext(personalOverview+';personalOverview();',{...context,mobileViewport:()=>true});
 assert.doesNotMatch(mobile,/So.ggi murojaatlarim|REQUEST CARDS|FAMILY DETAILS|Oila paketingiz/);
 const desktop=runInNewContext(personalOverview+';personalOverview();',{...context,mobileViewport:()=>false});
 assert.match(desktop,/REQUEST CARDS/);
 assert.match(desktop,/FAMILY DETAILS/);
});

test('anonymous tasks and public pages retain public mobile navigation',()=>{
 for(const user of [null,{role:'client'}]){
  for(const hash of user?['#home','#services','#service?category=legal']:['#request','#checkout','#track','#services']){
   const html=runInNewContext(bottomNav+';mobileBottomNav();',{
    location:{hash},state:{user},staff:()=>false,pageLabel:lat=>lat,icon:()=>'',esc:value=>value
   });
   assert.match(html,/data-context="public"/,hash);
   assert.match(html,/href="#services"/);
   assert.doesNotMatch(html,/href="#menu"/);
   assert.equal((html.match(/class="mb-item/g)||[]).length,5,hash);
  }
 }
});

test('mobile staff navigation shows a badge for unread notifications',()=>{
 const html=runInNewContext(bottomNav+';mobileBottomNav();',{
  location:{hash:'#cabinet/overview'},state:{user:{role:'director'},notificationUnread:3},
  staff:()=>true,pageLabel:lat=>lat,icon:()=>'',esc:value=>value
 });
 assert.match(html,/notification-badge/);
 assert.match(html,/>3<\/span>/);
});

test('direct mobile detail links return to their parent without adding a history loop',()=>{
 for(const [hash,parent] of [['#service?category=legal','#services'],['#cabinet/case?id=1','#cabinet/cases'],['#cabinet/package-edit?id=1','#cabinet/packages'],['#cabinet/menu','#home']]){
  let rendered=0;
  const context={location:{hash},history:{state:{zarEntry:true},replaceState(state,_,url){this.state=state;context.location.hash=url;},back(){assert.fail('No predecessor exists');}},renderRoute(){rendered++;}};
  runInNewContext(back+';mobileBack();',context);
  assert.equal(context.location.hash,parent);
  assert.equal(context.history.state.zarFrom,null);
  assert.equal(rendered,1);
 }
});

test('mobile Back uses the existing predecessor after refresh',()=>{
 let calls=0;
 runInNewContext(back+';mobileBack();',{location:{hash:'#service?category=legal'},history:{state:{zarEntry:true,zarFrom:'#services'},back(){calls++;}},renderRoute(){assert.fail('History navigation should render through hashchange');}});
 assert.equal(calls,1);
});

test('initial session loading never renders the public landing page',async()=>{
 const init=source.slice(source.indexOf('async function init(){'),source.lastIndexOf('\ninit().then(()=>pollStaffNotifications());'));
 let resolveAuth,rendered=0;
 const auth=new Promise(resolve=>{resolveAuth=resolve;});
 const context={navigationReady:true,state:{},app:{dataset:{}},api:path=>path==='/config'?Promise.resolve({categories:[]}):auth,route:()=> 'cases',landing(){assert.fail('Landing would flash before the requested page');},renderRoute(){rendered++;},toast(){}};
 const pending=runInNewContext(init+';init();',context);
 await Promise.resolve();await Promise.resolve();
 assert.equal(rendered,0);
 assert.equal(context.navigationReady,false);
 resolveAuth({user:{role:'client'}});
 await pending;
 assert.equal(context.navigationReady,true);
 assert.equal(rendered,1);
});

const savedCase=source.slice(source.indexOf('async function refreshSavedCase('),source.indexOf('\nfunction toLocalInput('));
test('late case saves cannot reopen a dialog after navigation or closing it',async()=>{
 for(const [routeVersion,open] of [[2,true],[1,false]]){
  await runInNewContext(savedCase+';refreshSavedCase({id:1},1);',{
   routeVersion,modal:{open},renderCaseDialog(){assert.fail('Stale dialog reopened');},renderRoute(){assert.fail('New route replaced');}
  });
 }
 await runInNewContext(savedCase+";refreshSavedCase({id:1},1,'#cabinet/case?id=1');",{
  routeVersion:1,modal:{open:true},location:{hash:'#cabinet/case?id=2'},
  renderCaseDialog(){assert.fail('A queued hashchange must not render the previous case');},renderRoute(){assert.fail('New route replaced');}
 });
});

test('saving a mobile case uses the returned case without reloading the whole route',async()=>{
 const c={id:1,status:'reviewing'};let rendered,finished=false;
 await runInNewContext(savedCase+';refreshSavedCase(c,1);',{
  c,routeVersion:1,modal:{open:true},isMobileFormRoute:()=>true,location:{hash:'#cabinet/case?id=1'},
  renderCaseDialog(value){rendered=value;},finishPage(){finished=true;},renderRoute(){assert.fail('Unnecessary route reload');}
 });
 assert.equal(rendered,c);assert.equal(finished,true);
});

test('a pending desktop case refresh cannot reopen its dialog on a newer route',async()=>{
 let resolve;const pending=new Promise(done=>{resolve=done;});
 const context={routeVersion:1,state:{user:{}},modal:{open:true},location:{hash:'#cabinet/cases'},isMobileFormRoute:()=>false,
  renderRoute(){context.routeVersion++;return pending;},renderCaseDialog(){assert.fail('Dialog reopened over a newer route');}
 };
 const saving=runInNewContext(savedCase+';refreshSavedCase({id:1},1);',context);
 context.routeVersion++;context.location.hash='#cabinet/clients';resolve();await saving;
});

test('returning from a case detail preserves filters; opening a different tab resets them',()=>{
 const start=source.indexOf(' const requestedTab=',source.indexOf('async function renderRoute()'));
 const sync=source.slice(start,source.indexOf('\n',start));
 const state={caseTabRoute:'#cabinet/cases',filters:{search:'customer',category:'legal',tab:'all'}};
 const context={state,URLSearchParams,view:'case',location:{hash:'#cabinet/case?id=1'}};
 runInNewContext(sync,context);
 assert.equal(state.caseTabRoute,'#cabinet/cases');
 context.view='cases';context.location.hash='#cabinet/cases';runInNewContext(sync,{...context});
 assert.equal(state.filters.search,'customer');assert.equal(state.filters.category,'legal');
 context.location.hash='#cabinet/cases?tab=completed';runInNewContext(sync,{...context});
 assert.equal(state.filters.search,'');assert.equal(state.filters.tab,'completed');
 context.location.hash='#cabinet/cases';runInNewContext(sync,{...context});
 assert.equal(state.filters.tab,'all');
 context.location.hash='#cabinet/cases?tab=open&assignee=me';runInNewContext(sync,{...context});
 assert.equal(state.filters.assignee,'me');assert.equal(state.filters.tab,'open');
});

test('subscription pagination preserves the chosen case and deduplicates overlapping pages',async()=>{
 const dialog=source.slice(source.indexOf('async function subscriptionUseDialog('),source.indexOf('\nasync function checkoutDialog('));
 let selected,ids;
 const first={id:1,number:'ZAR-000001',category:'legal'};
 const context={staff:()=>true,routeVersion:1,subscriptionEligibility:{id:'8',cases:[first],offset:50},
  $:()=>({value:'1'}),api:async()=>({cases:[first,{id:2,number:'ZAR-000002',category:'legal'}],offset:100,hasMore:false}),
  pageLabel:lat=>lat,category:()=> 'Legal',formError:'',selectField:()=>'',modalOpen(){},
  options(items,value){selected=value;ids=Array.from(items,c=>c.id);return '';}
 };
 await runInNewContext(dialog+";subscriptionUseDialog('8',true);",context);
 assert.equal(selected,'1');assert.deepEqual(ids,[1,2]);
 assert.equal(context.subscriptionEligibility.offset,100);
});

test('package forms enforce a numeric minimum including already consumed requests',async()=>{
 const dialog=source.slice(source.indexOf('async function packageDialog('),source.indexOf('\nlet packageEligibility='));
 for(const used of [0,3]){
  let limitAttributes;
  const pkg={id:1,clientId:3,tier:'comfort',expiresAt:'2027-01-01T18:59:59.999Z',limit:5,used,members:['QA Mijoz']};
  const context={routeVersion:1,state:{},api:async path=>path==='/clients'?{clients:[]}:{packages:[pkg]},tr:s=>s,
   modalOpen(){},pageLabel:lat=>lat,formError:'',selectField:()=>'',options:()=>'',packageTiers:[{name:'COMFORT'}],packageName:()=> 'COMFORT',textareaField:()=>'',
   field(name,label,type,value,attributes){if(name==='limit')limitAttributes=attributes;return '';}};
  await runInNewContext(dialog+';packageDialog(1);',context);
  assert.match(limitAttributes,new RegExp(`min="${Math.max(1,used)}"`));
  assert.doesNotMatch(limitAttributes,/\$\{/);
 }
});
