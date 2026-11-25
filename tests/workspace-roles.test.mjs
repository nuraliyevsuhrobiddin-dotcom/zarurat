import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestContact,resetWorkspace,coordinatorChoices,workspaceViewAllowed,teamGroups} from '../public/workspace-roles.js';

test('coordinator choices never include partner or customer accounts',()=>{
 assert.deepEqual(coordinatorChoices([{id:1,role:'operator'}],{coordinatorId:9,coordinatorRole:'partner'}),[{id:1,role:'operator'}]);
 assert.deepEqual(coordinatorChoices([{id:3,role:'partner'},{id:4,role:'client'},{id:5,role:'operator'}],{}),[{id:5,role:'operator'}]);
 assert.deepEqual(teamGroups.map(group=>group.role),['director','operator']);
});

test('workspace routes separate coordinator and director sections; partners have no cabinet',()=>{
 for(const role of ['client','operator','director'])for(const view of ['overview','cases','menu','settings'])assert.equal(workspaceViewAllowed(role,view),true);
 for(const view of ['overview','cases','menu','settings','partners','clients','packages','notifications','team'])assert.equal(workspaceViewAllowed('partner',view),false);
 for(const view of ['partners','clients','packages','notifications'])assert.equal(workspaceViewAllowed('operator',view),true);
 assert.equal(workspaceViewAllowed('operator','team'),false);
 assert.equal(workspaceViewAllowed('director','team'),true);
 assert.equal(workspaceViewAllowed('client','clients'),false);
 assert.equal(workspaceViewAllowed('client','packages'),true);
 assert.equal(workspaceViewAllowed(null,'overview'),false);
 assert.equal(workspaceViewAllowed('partner','unknown'),false);
});

test('new coordinator choices exclude blocked accounts while preserving an existing assignment',()=>{
 const team=[{id:1,name:'Active',role:'director'},{id:2,name:'Blocked',role:'operator',blocked:true},{id:3,name:'Other blocked',role:'operator',blocked:true}];
 assert.deepEqual(coordinatorChoices(team,{coordinatorId:null}),[team[0]]);
 assert.deepEqual(coordinatorChoices(team,{coordinatorId:1}),[team[0]]);
 const current={coordinatorId:2,coordinatorName:'Blocked',coordinatorRole:'operator'};
 assert.deepEqual(coordinatorChoices(team,current),[team[0],{id:2,name:'Blocked',role:'operator',previous:true}]);
 assert.deepEqual(coordinatorChoices([team[0]],current),[team[0],{id:2,name:'Blocked',role:'operator',previous:true}]);
 assert.equal(team.length,3);
});

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
