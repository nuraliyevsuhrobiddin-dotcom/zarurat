const key='zar_registration_pending_v1';
export function validRegistrationProof(value,now=Date.now()){
 if(!value||!/^[a-f0-9]{48}$/.test(value.challenge||'')||!/^\+998\d{9}$/.test(value.phone||'')||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+901000)return null;
 try{const u=new URL(value.url);if(u.protocol!=='https:'||u.hostname!=='t.me'||u.searchParams.get('start')!=='r_'+value.challenge)return null;}catch{return null;}
 return {challenge:value.challenge,phone:value.phone,url:value.url,expiresAt:value.expiresAt};
}
export function createRegistrationFlow({api,normalizePhone,label,escape:esc,storage=()=>window.localStorage}){
 let active=null;
 const getSaved=()=>{try{const value=validRegistrationProof(JSON.parse(storage().getItem(key)));if(!value)storage().removeItem(key);return value;}catch{return null;}};
 const clear=()=>{try{storage().removeItem(key);}catch{}};
 const remember=proof=>{try{storage().setItem(key,JSON.stringify(proof));}catch{}};
 function say(form,text){const status=form.querySelector('[data-registration-status]');if(status)status.textContent=text;}
 function setFields(form,verified){for(const name of['name','password']){const input=form.elements[name];if(input){input.disabled=!verified;input.closest('.auth-field').hidden=!verified;}}form.elements.phone.readOnly=verified;}
 function sync(form){if(!form?.isConnected||form.dataset.telegramRequired!=='true')return;const button=form.querySelector('[type="submit"]');if(form.dataset.saving==='true')return;button.disabled=false;button.textContent=form.dataset.registrationVerified==='true'?label('Kabinet yaratish','Кабинет яратиш'):form.dataset.verification?label('Tasdiqni tekshirish','Тасдиқни текшириш'):label('1. Telefonni Telegramda tasdiqlash','1. Телефонни Telegramда тасдиқлаш');}
 function reset(form){clear();for(const name of['verification','verificationPhone','verificationUrl','registrationVerified'])delete form.dataset[name];form.querySelector('.registration-telegram')?.remove();if(form.dataset.telegramRequired==='true')setFields(form,false);sync(form);}
 function showProof(form,input){
  const saved=getSaved();
  const proof=validRegistrationProof({...input,expiresAt:input.expiresAt||((saved?.challenge===input.challenge?saved.expiresAt:null)||Date.now()+(input.expiresIn||900)*1000)});
  if(!proof)throw Error(label('Tasdiqlash havolasi eskirgan. Qayta boshlang.','Тасдиқлаш ҳаволаси эскирган. Қайта бошланг.'));
  form.dataset.telegramRequired='true';form.dataset.verification=proof.challenge;form.dataset.verificationPhone=proof.phone;form.dataset.verificationUrl=proof.url;delete form.dataset.registrationVerified;remember(proof);setFields(form,false);
  let panel=form.querySelector('.registration-telegram');if(!panel){panel=document.createElement('section');panel.className='registration-telegram notice';form.querySelector('[type="submit"]').before(panel);}
  panel.innerHTML=`<strong>${label('Telegramda ikki qadam','Telegramда икки қадам')}</strong><ol><li>${label('Telegramni oching va botda Start / Boshlash ni bosing.','Telegramни очинг ва ботда Start / Бошлаш ни босинг.')}</li><li>${label('«Telefon raqamimni ulashish»ni bosing, keyin saytga qayting.','«Telefon raqamimni ulashish»ни босинг, кейин сайтга қайтинг.')}</li></ol><p>${label('Tasdiqlanadigan raqam','Тасдиқланадиган рақам')}: <strong>${esc(proof.phone)}</strong></p><p data-registration-status role="status" aria-live="polite">${label('Tasdiq kutilmoqda. Saytga qaytsangiz avtomatik tekshiramiz.','Тасдиқ кутилмоқда. Сайтга қайтсангиз автоматик текширамиз.')}</p><div class="form-actions"><a class="btn" href="${esc(proof.url)}" target="_blank" rel="noopener noreferrer">${label('Telegramni ochish','Telegramни очиш')}</a><button type="button" class="btn outline small" data-action="registration-restart">${label('Raqamni o‘zgartirish / qayta boshlash','Рақамни ўзгартириш / қайта бошлаш')}</button></div><p class="small-text">${label('Faqat o‘z kontaktingizni ulashing. Havola 15 daqiqa amal qiladi.','Фақат ўз контактингизни улашинг. Ҳавола 15 дақиқа амал қилади.')}</p>`;
  sync(form);void check(form);return proof;
 }
 async function check(form=active,manual=false){
  if(!form?.isConnected||!form.dataset.verification||form.dataset.registrationChecking==='true')return form?.dataset.registrationVerified==='true';
  const challenge=form.dataset.verification,phone=form.dataset.verificationPhone;
  if(normalizePhone(form.elements.phone.value)!==phone){reset(form);return false;}
  form.dataset.registrationChecking='true';
  try{
   const result=await api('/auth/register/telegram/status',{challenge,phone});
   if(!form.isConnected||form.dataset.verification!==challenge||normalizePhone(form.elements.phone.value)!==phone)return false;
   if(result.status==='expired'){reset(form);const error=form.querySelector('.form-error');if(error)error.textContent=label('Havola muddati tugagan yoki ishlatilgan. Telefonni qayta tasdiqlang.','Ҳавола муддати тугаган ёки ишлатилган. Телефонни қайта тасдиқланг.');return false;}
   if(result.verified){form.dataset.registrationVerified='true';setFields(form,true);say(form,label('Telefon tasdiqlandi. Endi ism va parolingizni kiriting.','Телефон тасдиқланди. Энди исм ва паролингизни киритинг.'));const link=form.querySelector('.registration-telegram a');if(link)link.hidden=true;return true;}
   if(manual)say(form,label('Hali tasdiqlanmadi. Botda Start, keyin «Telefon raqamimni ulashish»ni bosing.','Ҳали тасдиқланмади. Ботда Start, кейин «Telefon raqamimni ulashish»ни босинг.'));return false;
  }catch(error){if(form.isConnected&&form.dataset.verification===challenge)say(form,label('Tekshirishga ulanib bo‘lmadi. Internetni tekshiring yoki «Tasdiqni tekshirish»ni bosing.','Текширишга уланиб бўлмади. Интернетни текширинг ёки «Тасдиқни текшириш»ни босинг.'));return false;}
  finally{delete form.dataset.registrationChecking;sync(form);}
 }
 async function mount(form){
  if(!form)return;active=form;const button=form.querySelector('[type="submit"]');button.disabled=true;
  try{
   const auth=await api('/auth/options');if(!form.isConnected)return;
   if(!auth.registrationTelegramRequired){clear();button.disabled=false;return;}
   form.dataset.telegramRequired='true';
   const intro=document.createElement('div');intro.className='registration-intro notice';intro.innerHTML=`<strong>${label('1. Telefonni tasdiqlash → 2. Ism va parol','1. Телефонни тасдиқлаш → 2. Исм ва парол')}</strong><p>${label('Telegramdagi o‘z telefon raqamingizni kiriting. Tasdiqdan keyin kabinet yaratasiz.','Telegramдаги ўз телефон рақамингизни киритинг. Тасдиқдан кейин кабинет яратасиз.')}</p><a href="#request">${label('Faqat murojaat yuborish — hisob shart emas','Фақат мурожаат юбориш — ҳисоб шарт эмас')}</a>`;
   if(!form.querySelector('.registration-intro'))form.querySelector('.form-error').after(intro);
   form.querySelector('.auth-field').before(form.elements.phone.closest('.auth-field'));
   setFields(form,false);sync(form);
   const saved=getSaved();if(saved){form.elements.phone.value=saved.phone;showProof(form,saved);}
   form.elements.phone.addEventListener('input',()=>{if(form.dataset.verification&&normalizePhone(form.elements.phone.value)!==form.dataset.verificationPhone)reset(form);});
  }catch{if(form.isConnected){button.disabled=false;const error=form.querySelector('.form-error');if(error)error.textContent=label('Ro‘yxatdan o‘tish sozlamalari yuklanmadi. Qayta urinib ko‘ring.','Рўйхатдан ўтиш созламалари юкланмади. Қайта уриниб кўринг.');}}
 }
 const poll=()=>{if(document.visibilityState==='visible'&&active?.dataset.registrationVerified!=='true')void check();};
 if(typeof window!=='undefined'){window.addEventListener('focus',poll);document.addEventListener('visibilitychange',poll);window.setInterval(poll,5000);}
 return {mount,showProof,check,sync,reset,clear};
}
