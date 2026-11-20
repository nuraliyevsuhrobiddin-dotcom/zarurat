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

test('partner profile separates own organization from personal account and opens assigned services',()=>{
 const html=profile({partner:{id:1,name:'<Own organization>',phone:'+998901234567',category:'legal',address:'Qarshi',hours:'09-18',region:'Qashqadaryo',contractStatus:'active'}},'partner');
 assert.match(html,/&lt;Own organization&gt;/);assert.match(html,/Hamkor tashkilotingiz/);assert.match(html,/href="#cabinet\/cases"/);assert.match(html,/href="\/aloqa\/"/);assert.match(html,/tuzatish uchun koordinatorga/);
 assert.doesNotMatch(html,/data-action="partner-edit"|data-action="user-edit"|<Own organization>/);
 const unlinked=profile({partner:null},'partner');assert.match(unlinked,/tashkilot hali biriktirilmagan/);
 assert.doesNotMatch(profile({partner:{name:'Unexpected'}}),/Unexpected|Hamkor tashkilotingiz/);
});
test('available account actions remain accessible while Telegram management is collapsed',()=>{
 const html=profile({stage2Enabled:true,smsEnabled:true,phoneVerified:false,telegramEnabled:true,telegramConnected:true});
 assert.match(html,/data-action="phone-verify-request"/);
 assert.match(html,/<details class="profile-telegram">/);
 assert.match(html,/data-action="telegram-unlink"/);
 assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
});

test('staff and partner profiles show work and contact links instead of customer guidance',()=>{
 for(const role of ['director','operator','partner']){
  const html=profile({},role);
  assert.match(html,/href="#cabinet\/cases"/);assert.match(html,/href="\/aloqa\/"/);
  assert.doesNotMatch(html,/href="#faq"|href="#how"|data-action="request"|href="#checkout/);
 }
});

test('coordinator and director profiles expose daily work with role-safe account management',()=>{
 const operator=profile({},'operator'),director=profile({},'director'),partner=profile({},'partner');
 for(const html of [operator,director]){assert.match(html,/href="#cabinet\/cases\?tab=new"/);assert.match(html,/href="#cabinet\/cases\?tab=open&assignee=me"/);assert.match(html,/Har bir xizmat natijasini tekshiring/);}
 assert.doesNotMatch(operator,/href="#cabinet\/team"/);assert.match(director,/href="#cabinet\/team"/);
 assert.match(partner,/Xizmatni qanday bajaraman/);assert.match(partner,/Umumiy murojaatni koordinator yopadi/);assert.doesNotMatch(partner,/href="#cabinet\/team"|assignee=me|tab=new/);
 assert.ok(partner.indexOf('Mening xizmatlarim')<partner.indexOf('Hamkor tashkilotingiz'));
});
