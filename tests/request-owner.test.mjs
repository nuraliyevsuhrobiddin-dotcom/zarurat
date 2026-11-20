import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resetWorkspace} from '../public/workspace-roles.js';
import {createRequestDrafts} from '../public/request-drafts.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const submitCode=source.slice(source.indexOf('async function submitRequest('),source.indexOf('\nfunction focusRequestGate('));
function setup(owner,users,{race=false}={}){
 const form={isConnected:true},posts=[],changes=[],successes=[];
 let reads=0,cleared=0;
 const context={requestFormOwners:new WeakMap([[form,{owner}]]),routeVersion:1,pageLabel:lat=>lat,
  api:async(path,body)=>{if(path==='/auth/me')return {user:users[Math.min(reads++,users.length-1)]};posts.push(body);if(race)throw Object.assign(new Error('Changed'),{code:'account_changed'});return {case:{id:1}};},
  requestAccountChanged:async user=>changes.push(user),rememberRequestDraft:()=>null,
  completeRequestDraft:()=>cleared++,successDialog:result=>successes.push(result)};
 runInNewContext(submitCode,context);
 return {form,posts,changes,successes,context,get cleared(){return cleared;}};
}
test('request preflight prevents another account or guest from receiving an old draft',async()=>{
 for(const [owner,user] of [['user:1',{id:2}],['guest',{id:2}],['user:1',null]]){
  const test=setup(owner,[user]);await test.context.submitRequest(test.form,{name:'Private previous customer'},1);
  assert.equal(test.posts.length,0);assert.deepEqual(test.changes,[user]);assert.equal(test.cleared,0);
 }
});
test('request uses immutable original owner while allowing a family member contact',async()=>{
 const test=setup('user:1',[{id:1}]);
 await test.context.submitRequest(test.form,{name:'Family member',phone:'+998901234567'},1);
 assert.equal(test.posts[0].requestOwner,'user:1');assert.equal(test.posts[0].name,'Family member');assert.equal(test.successes.length,1);
});
test('server account-change race refreshes identity without clearing draft or showing success',async()=>{
 const test=setup('user:1',[{id:1},{id:2}],{race:true});
 await test.context.submitRequest(test.form,{name:'Old draft'},1);
 assert.equal(test.posts.length,1);assert.equal(test.posts[0].requestOwner,'user:1');assert.deepEqual(test.changes,[{id:2}]);assert.equal(test.cleared,0);assert.equal(test.successes.length,0);
});
test('navigation during preflight prevents posting a detached form',async()=>{
 const test=setup('user:1',[{id:1}]);
 test.context.api=async()=>{test.form.isConnected=false;return {user:{id:1}};};
 await test.context.submitRequest(test.form,{},1);assert.equal(test.posts.length,0);
});
test('null draft snapshots are safe when submitting an untouched valid form',()=>{
 const fn=source.slice(source.indexOf('function completeRequestDraft('),source.indexOf('\nasync function requestAccountChanged('));
 runInNewContext(fn+';completeRequestDraft({},null);',{});
});
test('account replacement discards private caches and drafts before offering an explicit fresh form',async()=>{
 const fn=source.slice(source.indexOf('async function requestAccountChanged('),source.indexOf('\nasync function submitRequest('));
 const state={user:{id:1},cases:[{description:'Private old case'}]},drafts=createRequestDrafts();drafts.setOwner('user:1');drafts.save('user:1','legal',{name:'Private old customer'});
 let clearedSelection=false,notice;
 const context={state,routeVersion:1,requestDrafts:drafts,resetWorkspace,requestOwner:()=>`user:${state.user.id}`,resetApiContext(){},cancelApiReads(){},serviceSelection:{clear(){clearedSelection=true;}},presentationDraft:{name:'Old private form'},pageLabel:lat=>lat,renderRoute:async()=>context.routeVersion++,modalOpen(a,b,html){notice=html;}};
 runInNewContext(fn,context);await context.requestAccountChanged({id:2});
 assert.deepEqual(state.cases,[]);assert.equal(drafts.get('user:1','legal'),null);assert.equal(context.presentationDraft,null);assert.equal(clearedSelection,true);assert.match(notice,/Yangi forma ochish/);assert.doesNotMatch(notice,/Private old/);
});
test('explicit same-route New action restarts success while ordinary navigation preserves it',()=>{
 const fn=source.slice(source.indexOf('function restartSubmittedRequestLink('),source.indexOf('\nlet requestIdentityCheckRunning'));
 let renders=0;const state={lastSubmission:{case:{id:1}}},context={state,location:{hash:'#request'},renderRoute(){renders++;}};
 runInNewContext(fn,context);
 assert.equal(context.restartSubmittedRequestLink(null),false);assert.equal(renders,0);
 assert.equal(context.restartSubmittedRequestLink({hash:'#home'}),false);assert.equal(renders,0);
 assert.equal(context.restartSubmittedRequestLink({hash:'#request'}),true);assert.equal(renders,1);
 state.lastSubmission=null;assert.equal(context.restartSubmittedRequestLink({hash:'#request'}),false);
});
