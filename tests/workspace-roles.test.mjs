import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestContact,resetWorkspace} from '../public/workspace-roles.js';

test('staff and partner details never populate a customer request',()=>{
 for(const role of ['director','operator','partner']){
  assert.deepEqual(requestContact({role,name:'Staff name',phone:'+998901111111'}),{name:'',phone:'+998'});
 }
 assert.deepEqual(requestContact(null),{name:'',phone:'+998'});
 assert.deepEqual(requestContact({role:'client',name:'Customer',phone:'+998902222222'}),{name:'Customer',phone:'+998902222222'});
});

test('changing accounts clears hidden staff filters and private cached lists',()=>{
 const config={categories:[]};
 const state={config,script:'cyr',lastTrack:{token:'private'},trackingPrefill:{token:'private'},lastSubmission:{trackingToken:'private'},filters:{tab:'completed',search:'previous customer'},cases:[{id:1}],clients:[{id:2}],notifications:[{id:3}],notificationKnownIds:new Set(['3']),notificationUnread:4,teamUsers:[{id:4}],caseOffset:50,authOptions:{stage2Enabled:true}};
 resetWorkspace(state);
 assert.equal(state.filters.tab,'all');assert.equal(state.filters.search,'');
 for(const key of ['cases','clients','notifications','teamUsers','packages'])assert.deepEqual(state[key],[]);
 assert.equal(state.notificationKnownIds,null);assert.equal(state.notificationUnread,0);
 assert.equal(state.caseOffset,0);assert.equal(state.authOptions,null);
 for(const key of ['lastTrack','trackingPrefill','lastSubmission'])assert.equal(state[key],null);
 assert.equal(state.config,config);assert.equal(state.script,'cyr');
});
