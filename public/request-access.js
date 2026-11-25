import {packageTiers} from './package-tiers.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function requestAccessPolicy(script='lat'){
 return `<p class="notice">${script==='cyr'?'Ҳар бир телефон рақамига биринчи мурожаат бепул. Кейинги мурожаатлар учун фаол обуна керак.':'Har bir telefon raqamiga birinchi murojaat bepul. Keyingi murojaatlar uchun faol obuna kerak.'}</p>`;
}
export function requestAccessNotice(script='lat'){
 const t=(lat,cyr)=>script==='cyr'?cyr:lat;
 return `<section class="notice request-subscription-gate" role="status"><h3 class="request-gate-heading" tabindex="-1">${t('Davom etish uchun obuna tanlang','Давом этиш учун обуна танланг')}</h3><p>${t('Bu raqamga birinchi bepul murojaat ishlatilgan. Keyingi murojaatlar faol obuna orqali yuboriladi.','Бу рақамга биринчи бепул мурожаат ишлатилган. Кейинги мурожаатлар фаол обуна орқали юборилади.')}</p><p>${t('Tarif yangi oynada ochiladi. Obunani faollashtirgach, shu yerga qaytib «Murojaatni yuborish»ni qayta bosing — yozganlaringiz saqlanadi.','Тариф янги ойнада очилади. Обунани фаоллаштиргач, шу ерга қайтиб «Мурожаатни юбориш»ни қайта босинг — ёзганларингиз сақланади.')}</p><div class="package-list">${packageTiers.map(tier=>`<article class="owned-package"><h3>${esc(tier.name)}</h3><p>${tier.monthlyPrice.toLocaleString('en-US').replaceAll(',',' ')} ${t('so‘m / oy','сўм / ой')}</p><p>${tier.familyMembers} ${t('nafargacha oila a’zosi','нафаргача оила аъзоси')}</p><a class="btn outline" href="#checkout?package=${encodeURIComponent(tier.name)}" target="_blank" rel="noopener">${t('Tarifni ko‘rish','Тарифни кўриш')} · ${esc(tier.name)}</a></article>`).join('')}</div></section>`;
}
