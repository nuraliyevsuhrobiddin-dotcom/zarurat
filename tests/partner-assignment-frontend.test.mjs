import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {partnerAccessCopy,partnerChoiceLabel} from '../public/partner-assignment.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function helpers(role='operator'){
 const state={user:{role},script:'lat',partners:[{id:1,name:'<Hamkor>',category:'legal',region:'Qarshi',contractStatus:'active',accountStatus:'missing'},{id:2,name:'Other',accountStatus:'active'},{id:3,name:'Unknown',contractStatus:'active',accountStatus:'unknown'}]};
 const code=source.slice(source.indexOf('function assignmentPartnerOptions('),source.indexOf('\nasync function requestPhoneVerification('));
 const optionsCode=source.slice(source.indexOf('const options ='),source.indexOf('\n',source.indexOf('const options =')));
 const context={state,partnerAccessCopy,partnerChoiceLabel,category:id=>id==='legal'?'Huquqiy yordam':id,pageLabel:lat=>lat,esc:escape,tr:value=>value};
 runInNewContext(optionsCode+'\n'+code,context);return context;
}
test('partner access states come from linked accounts, independently of contract status',()=>{
 assert.equal(partnerAccessCopy({accountStatus:'active'}).tone,'green');assert.equal(partnerAccessCopy({accountStatus:'blocked'}).tone,'red');
 assert.match(partnerAccessCopy({accountStatus:'missing'}).title,/ochilmagan/);
 for(const accountStatus of ['unknown',undefined,'unexpected']){
  const copy=partnerAccessCopy({contractStatus:'active',accountStatus});assert.match(copy.title,/tekshirilmagan/);assert.doesNotMatch(copy.title,/faol|ochilmagan/);
 }
 assert.equal(partnerAccessCopy({accountStatus:'blocked'},'cyr').title,'Ҳамкор ҳисоби блокланган');
});
test('assignment options retain partner identity and escape rich name direction and region labels',()=>{
 const context=helpers(),html=context.assignmentPartnerOptions(context.state.partners,1);
 assert.match(html,/&lt;Hamkor&gt; · Huquqiy yordam · Qarshi/);assert.match(html,/value="1" selected/);assert.doesNotMatch(html,/<Hamkor>/);
});
test('selection help updates to the chosen partner and respects director-only account links',()=>{
 const operator=helpers(),help={innerHTML:''};
 operator.updateAssignmentHelp({value:'1',form:{querySelector:()=>help}});
 assert.match(help.innerHTML,/Biriktirish mumkin/);assert.match(help.innerHTML,/telefon orqali/);assert.doesNotMatch(help.innerHTML,/href="#cabinet\/team"/);
 operator.updateAssignmentHelp({value:'2',form:{querySelector:()=>help}});assert.match(help.innerHTML,/Kabinetga kirish faol/);assert.doesNotMatch(help.innerHTML,/ochilmagan/);
 const director=helpers('director');assert.match(director.partnerAccessMarkup(1),/href="#cabinet\/team"/);
 assert.match(director.partnerAccessMarkup(3),/tekshirilmagan/);assert.doesNotMatch(director.partnerAccessMarkup(3),/ochilmagan|kirish faol/);
 assert.match(operator.partnerAccessMarkup(null),/Mas’ul koordinator murojaatni boshqaradi, hamkor esa xizmatni bajaradi/);
});
test('directory explains that a partner entry does not create a login and keeps coordinator links safe',()=>{
 const operator=helpers(),director=helpers('director');
 assert.match(operator.partnerDirectoryGuide(),/login ochmaydi/);assert.match(operator.partnerDirectoryGuide(),/rahbardan so‘rang/);assert.doesNotMatch(operator.partnerDirectoryGuide(),/href="#cabinet\/team"/);
 assert.match(director.partnerDirectoryGuide(),/href="#cabinet\/team"/);
});
