import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequestDrafts,requestDraftContext,sameRequestDraftValues} from '../public/request-drafts.js';

const values={name:'QA Mijoz',phone:'+998901111113',description:'Huquqiy maslahat kerak',consent:true};
const context=requestDraftContext('legal');

test('request drafts return only for the same category, package and special context',()=>{
 const drafts=createRequestDrafts();drafts.setOwner('guest');
 drafts.save('guest',context,values);
 assert.deepEqual(drafts.get('guest',context).values,values);
 for(const other of [requestDraftContext('repair'),requestDraftContext('legal','COMFORT'),requestDraftContext('legal','',true)])assert.equal(drafts.get('guest',other),null);
 assert.equal(drafts.get('user:3',context),null);
});

test('switching identity discards drafts and refuses late saves from old account forms',()=>{
 const drafts=createRequestDrafts();drafts.setOwner('guest');
 const guest=drafts.save('guest',context,values);
 drafts.setOwner('user:3');
 assert.equal(drafts.get('guest',context),null);
 assert.equal(drafts.save('guest',context,values),null);
 const client=drafts.save('user:3',context,{...values,name:'Other QA'});
 assert.equal(drafts.complete(guest),false);
 assert.equal(drafts.get('user:3',context),client);
 drafts.setOwner('guest');
 assert.equal(drafts.get('guest',context),null,'logout cannot revive an earlier guest draft');
 drafts.setOwner('user:3');
 assert.equal(drafts.get('user:3',context),null,'signing back in cannot revive the discarded account draft');
});

test('successful submission clears unchanged drafts while late results preserve newer edits',()=>{
 const drafts=createRequestDrafts();drafts.setOwner('guest');
 const submitted=drafts.save('guest',context,values);
 assert.equal(drafts.save('guest',context,{...values}),submitted,'navigation does not create a newer revision for unchanged values');
 const edited=drafts.save('guest',context,{...values,description:'New request text after submitting'});
 assert.equal(drafts.complete(submitted),false);
 assert.equal(drafts.get('guest',context),edited);
 assert.equal(drafts.complete(edited),true);
 assert.equal(drafts.get('guest',context),null);
 assert.equal(drafts.complete(edited),false);
});

test('draft snapshots are immutable and contain only request fields',()=>{
 const drafts=createRequestDrafts();drafts.setOwner('guest');
 const input={...values,password:'not-a-request-field',token:'not-a-request-field'};
 const snapshot=drafts.save('guest',context,input);
 input.name='Changed outside';
 assert.deepEqual(snapshot.values,values);
 assert.throws(()=>{snapshot.values.name='Mutation';},TypeError);
 assert.equal('password' in snapshot.values,false);
 assert.equal('token' in snapshot.values,false);
});

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const integration=source.slice(source.indexOf('const requestDrafts=createRequestDrafts()'),source.indexOf('function requestDialog('));
const form=()=>({isConnected:true,elements:{name:{value:''},phone:{value:'+998'},description:{value:''},consent:{checked:false}}});

test('form integration restores navigation drafts and never resaves a successfully submitted form',()=>{
 const first=form(),returned=form();let active=first;
 const state={user:null};
 runInNewContext(integration+`
  restoreRequestDraft(first,'legal','',false);
  first.elements.name.value='QA Mijoz';first.elements.phone.value='+998901111113';first.elements.description.value='Huquqiy maslahat kerak';first.elements.consent.checked=true;
  const submitted=rememberRequestDraft(first);
  first.isConnected=false;setActive(returned);
  restoreRequestDraft(returned,'legal','',false);
  if(returned.elements.description.value!=='Huquqiy maslahat kerak'||!returned.elements.consent.checked)throw Error('Navigation draft missing');
  completeRequestDraft(first,submitted);
  rememberRequestDraft(returned);
  if(requestDrafts.get('guest',requestDraftContext('legal')))throw Error('Submitted data was resaved');
 `,{createRequestDrafts,requestDraftContext,sameRequestDraftValues,state,first,returned,modal:{open:true},$:()=>active,setActive(value){active=value;}});
});

test('form integration cannot assign old visible customer data to a newly signed-in account',()=>{
 const first=form();const state={user:{id:3}};
 runInNewContext(integration+`
  restoreRequestDraft(first,'legal','',false);
  first.elements.name.value='Old customer';first.elements.description.value='Old customer private text';
  rememberRequestDraft(first);
  state.user={id:4};
  rememberRequestDraft(first);
  if(requestDrafts.get('user:3',requestDraftContext('legal'))||requestDrafts.get('user:4',requestDraftContext('legal')))throw Error('Cross-account draft remained');
 `,{createRequestDrafts,requestDraftContext,sameRequestDraftValues,state,first,modal:{open:true},$:()=>first});
});
