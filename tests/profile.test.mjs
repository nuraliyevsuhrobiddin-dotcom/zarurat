import{test}from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const render=source.slice(source.indexOf('function renderAccountSettings('),source.indexOf('\nasync function requestPhoneVerification'));
function profile(account,role='client'){
 let html;
 runInNewContext(render+';renderAccountSettings(account);',{
  account,state:{user:{name:'QA Mijoz',role,phone:'+998901111113'},script:'lat'},
  tr:value=>value,pageLabel:lat=>lat,category:value=>value,roleNames:{client:'Mijoz',partner:'Hamkor'},esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),icon:()=>'',
  modalOpen(title,subtitle,content){assert.equal(title,'Profil');assert.equal(subtitle,'');html=content;}
 });
 return html;
}
test('profile contains privacy, help and script controls without disabled service notices',()=>{
 const html=profile({stage2Enabled:false,smsEnabled:false,telegramEnabled:false});
 assert.match(html,/href="#privacy"/);assert.match(html,/href="#faq"/);assert.match(html,/data-action="toggle-script"/);
 assert.match(html,/data-action="password"/);assert.match(html,/data-action="logout"/);
 assert.doesNotMatch(html,/SMS|Tasdiqlanmagan|telegram-unlink|telegram-link/);
});

test('available account actions remain accessible while Telegram management is collapsed',()=>{
 const html=profile({stage2Enabled:true,smsEnabled:true,phoneVerified:false,telegramEnabled:true,telegramConnected:true});
 assert.match(html,/data-action="phone-verify-request"/);
 assert.match(html,/<details class="profile-telegram">/);
 assert.match(html,/data-action="telegram-unlink"/);
 assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
});

test('staff profiles show work links instead of customer guidance',()=>{
 for(const role of ['director','operator']){
  const html=profile({},role);
  assert.match(html,/href="#cabinet\/cases"/);
  assert.doesNotMatch(html,/href="#faq"|href="#how"|data-action="request"|href="#checkout|Hamkor tashkilotingiz/);
 }
});

test('coordinator and director profiles describe the phone workflow with role-safe account management',()=>{
 const operator=profile({},'operator'),director=profile({},'director');
 for(const html of [operator,director]){assert.match(html,/href="#cabinet\/cases\?tab=new"/);assert.match(html,/href="#cabinet\/cases\?tab=open&assignee=me"/);assert.match(html,/mijozga qo‘ng‘iroq qiling/);assert.match(html,/Bajarildi/);assert.doesNotMatch(html,/hamkorni biriktiring|Har bir xizmat natijasini/);}
 assert.doesNotMatch(operator,/href="#cabinet\/team"/);assert.match(director,/href="#cabinet\/team"/);
});
