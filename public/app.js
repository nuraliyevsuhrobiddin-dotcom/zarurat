import { staticCyr } from './ui-localization.js';
import { api, resetApiContext } from './api.js';
import { packageName, packageTiers } from './package-tiers.js';
import { normalizeLogin, normalizePhone } from './auth-input.js';
import { siteContent } from './site-content.js?v=8';
import { serviceContent } from './service-content.js';
import { mobileCategoryGroups, categoryIcons, mobileSectionDescriptions } from './mobile-navigation.js';
import { requestContact, teamGroups, resetWorkspace } from './workspace-roles.js';
import { requestStatuses, sectionHelp, copyTranslations } from './interface-copy.js';
import { notificationCopy } from './notification-copy.js';
import { notificationChanges } from './notification-alerts.js';
import { deadlineChanges } from './case-deadline.js';
import { paymentPanel, paymentMoney } from './payments.js';
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app'), modal = $('#modal');
let navigationReady=false;
history.replaceState({...history.state,zarEntry:true},'');
if('scrollRestoration' in history)history.scrollRestoration='manual';
function savedScript(){try{return localStorage.getItem('zar_script')==='cyr'?'cyr':'lat';}catch{return 'lat';}}
const state = { config: null, backendConfigured: null, lastSubmission: null, lastTrack: null, user: null, cases: [], caseOffset: 0, casesHasMore: false, partners: [], clients: [], team: [], packages: [], stats: null, notifications: [], notificationKnownIds: null, notificationUnread: 0, filters: { search: '', status: '', category: '', overdue: false, tab: 'all' }, script: savedScript() };
function savedNotificationSound(){try{return localStorage.getItem('zar_notification_sound')!=='off';}catch{return true;}}
let notificationSoundEnabled=savedNotificationSound(),notificationAudioContext=null,notificationPollRunning=false;
function unlockNotificationSound(){
 if(!notificationSoundEnabled)return;
 const AudioContextType=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextType)return;
 try{notificationAudioContext ||= new AudioContextType();if(notificationAudioContext.state==='suspended')notificationAudioContext.resume().catch(()=>{});}catch{}
}
function playNotificationSound(){
 if(!notificationSoundEnabled)return;
 unlockNotificationSound();
 const context=notificationAudioContext;if(!context)return;
 const play=()=>{const now=context.currentTime;for(let i=0;i<2;i++){const start=now+i*.22,osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=i?1046:784;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.16,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+.18);osc.connect(gain);gain.connect(context.destination);osc.start(start);osc.stop(start+.19);}};
 if(context.state==='running')play();else context.resume().then(play).catch(()=>{});
}
document.addEventListener('pointerdown',unlockNotificationSound,{passive:true});
const cyrMap = {
  'Assalomu alaykum': 'Ассалому алайкум',
  'So‘nggi murojaatlarim': 'Сўнгги мурожаатларим',
  'Mening xizmatlarim': 'Менинг хизматларим',
  'Huquqiy yordam': 'Ҳуқуқий ёрдам', 'Psixolog': 'Психолог', 'Tibbiy xizmat': 'Тиббий хизмат',
  'Bolalar': 'Болалар', 'Keksalar': 'Кексалар', 'Ayollar': 'Аёллар',
  'Tadbirkorlik': 'Тадбиркорлик', 'Bank / kredit': 'Банк / кредит', 'Hujjatlar': 'Ҳужжатлар',
  'Enaga': 'Энага', 'Qarovchi': 'Қаровчи', 'Klining': 'Клининг', 'Usta': 'Уста', 'Boshqa': 'Бошқа',
  'Qabul qilindi': 'Қабул қилинди', 'O‘rganilmoqda': 'Ўрганилмоқда', 'Hamkor izlanmoqda': 'Ҳамкор изланмоқда',
  'Kelishilmoqda': 'Келишилмоқда', 'Aloqa o‘rnatildi': 'Алоқа ўрнатилди', 'Yakunlandi': 'Якунланди',
  'Bekor qilindi': 'Бекор қилинди', 'Kutilmoqda': 'Кутилмоқда', 'Xizmat ko‘rsatildi': 'Хизмат кўрсатилди',
  'Mijoz': 'Мижоз', 'Koordinator': 'Координатор', 'Direktor': 'Директор', 'Hamkor': 'Ҳамкор',
  'Oddiy': 'Оддий', 'Shoshilinch': 'Шошилинч'
};
const tr = (s) => (state.script === 'cyr' && (copyTranslations[s]||cyrMap[s]||staticCyr[s])) ? (copyTranslations[s]||cyrMap[s]||staticCyr[s]) : s;
const statusNames = Object.fromEntries(Object.entries(requestStatuses).map(([id,copy])=>[id,copy.title[0]]));
const serviceNames = { pending: 'Kutilmoqda', accepted: 'Qabul qilindi', contacted: 'Aloqa o‘rnatildi', delivered: 'Xizmat ko‘rsatildi', completed: 'Yakunlandi', cancelled: 'Bekor qilindi' };
const serviceOrder = ['pending', 'accepted', 'contacted', 'delivered', 'completed'];
const roleNames = { client: 'Mijoz', operator: 'Koordinator', director: 'Direktor', partner: 'Hamkor' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('uz-UZ') + (state.script==='cyr'?' сўм':' so‘m');
const date = (d, time = false) => {
 if(!d)return tr('Belgilanmagan');
 const value=new Date(d);if(Number.isNaN(value.getTime()))return tr('Belgilanmagan');
 const pad=n=>String(n).padStart(2,'0');
 return `${pad(value.getDate())}.${pad(value.getMonth()+1)}.${value.getFullYear()}${time?` · ${pad(value.getHours())}:${pad(value.getMinutes())}`:''}`;
};
const staff = () => ['operator', 'director'].includes(state.user?.role);
const category = id => tr(state.config?.categories.find(c => c.id === id)?.name || id || 'Boshqa');
const terminal = c => ['completed', 'cancelled'].includes(c.status);
const overdue = c => c.dueAt && new Date(c.dueAt) < new Date() && !terminal(c);
const paths = {
 phone:'M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7l.7 3a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.2-1.3a2 2 0 0 1 2.1-.5l3 .7a2 2 0 0 1 2.7 2Z',
 arrow:'M4 12h15m-6-6 6 6-6 6', close:'m6 6 12 12M6 18 18 6', check:'m5 12 4 4L19 6', plus:'M12 5v14M5 12h14',
 shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M8 12l3 3 5-6', user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2', layers:'m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
 home:'m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7', file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h8', users:'M17 21v-2a6 6 0 0 0-12 0v2M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM19 4a4 4 0 0 1 0 7M20 15a5 5 0 0 1 3 5',
 briefcase:'M3 7h18v14H3V7Zm5 0V3h8v4M3 12c6 4 12 4 18 0M10 13h4', chart:'M4 3v18h17M8 16v-4M13 16V7M18 16V3', bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4', logout:'M9 3H4v18h5M9 12h12m-4-4 4 4-4 4', menu:'M4 6h16M4 12h16M4 18h16',
 scale:'M12 3v18M5 21h14M4 7h16M5 7l-4 7h8L5 7Zm14 0-4 7h8l-4-7Z', medical:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z', sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', tool:'M14 6a5 5 0 0 0-6 6L2 18l4 4 6-6a5 5 0 0 0 6-6l-4 2-2-2 2-4Z', bank:'m2 8 10-5 10 5H2Zm2 12h16M2 23h20M5 10v8M12 10v8M19 10v8',
 message:'M21 3H3v14h4v4l5-4h9V3ZM7 8h10M7 12h6', mic:'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v4M8 23h8', copy:'M8 8h13v13H8V8ZM16 8V3H3v13h5', download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z'
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.heart}"/></svg>`;
const brand = () => `<a href="#home" class="brand" aria-label="Zaruriyat bosh sahifasi"><img class="brand-mark brand-logo" src="/images/zaruriyat-logo-192.png" alt="" width="44" height="44"><span><span class="brand-name">ZARURIYAT</span><span class="brand-sub">${state.script==='cyr'?'Ҳар бир муаммога инсоний ечим.':'Har bir muammoga insoniy yechim.'}</span></span></a>`;
const badge = (s, services = false) => `<span class="pill ${s === 'completed' ? 'green' : s === 'cancelled' ? 'red' : s === 'received' || s === 'pending' ? 'blue' : 'amber'}">${esc(tr((services ? serviceNames : statusNames)[s] || s))}</span>`;
const options = (items, chosen = '', empty = '') => `${empty ? `<option value="">${esc(empty)}</option>` : ''}${items.map(i => { const v = typeof i === 'object' ? i.id : i; const n = typeof i === 'object' ? (i.name || i.id) : i; return `<option value="${esc(v)}" ${String(v) === String(chosen) ? 'selected' : ''}>${esc(items===state.partners||items===state.clients||items===state.team?n:tr(n))}</option>`; }).join('')}`;
const statusOptions = (chosen, isService = false) => options(Object.entries(isService ? serviceNames : statusNames).map(([id, name]) => ({ id, name: tr(name) })), chosen);
const empty = (title, description, button = '') => `<div class="empty">${icon('layers')}<h3>${esc(tr(title))}</h3><p>${esc(tr(description))}</p>${button}</div>`;
const translateAttrs=attrs=>attrs.replace(/(placeholder|aria-label)="([^"]*)"/g,(_,name,text)=>`${name}="${esc(tr(text))}"`);
const field = (name, label, type = 'text', value = '', attrs = '', full = false) => `<div class="field${full ? ' full' : ''}"><label for="${name}">${tr(label)}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${translateAttrs(attrs)}></div>`;
const selectField = (name, label, opts, attrs = '') => `<div class="field"><label for="${name}">${tr(label)}</label><select id="${name}" name="${name}" ${translateAttrs(attrs)}>${opts}</select></div>`;
const textareaField = (name, label, value = '', attrs = '', full = true) => `<div class="field${full ? ' full' : ''}"><label for="${name}">${tr(label)}</label><textarea name="${name}" id="${name}" ${translateAttrs(attrs)}>${esc(value)}</textarea></div>`;
const formError = '<div class="form-error" role="alert"></div>';
let caseSearchGeneration=0,caseSearchTimer;
let routeVersion = 0, lastFocus = null, toastTimer;
function toast(text) {
 const message=$('#toast');
 message.textContent=tr(text);
 // Popovers remain visible above modal dialogs as well as fixed navigation.
 message.showPopover?.();
 message.classList.add('visible');
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{message.classList.remove('visible');message.hidePopover?.();},Math.max(4200,Math.min(12000,message.textContent.length*60)));
}
function modalOpen(title, subtitle, content) { state.lastSubmission=null;state.lastTrack=null;releaseFileUrls(); if(!modal.open) lastFocus=document.activeElement; modal.innerHTML=`<header class="modal-head"><div><h2 id="modal-title">${esc(tr(title))}</h2>${subtitle ? `<p>${esc(tr(subtitle))}</p>`:''}</div><button class="icon-btn" data-action="close" aria-label="${state.script==='cyr'?'Ёпиш':'Yopish'}">${icon('close')}</button></header><div class="modal-body">${content}</div>`; if(!modal.open) modal.showModal(); modal.scrollTop=0;if(mobileViewport())promoteMobileDialog();const body=$('.modal-body',modal);if(body)body.scrollTop=0; }
function modalClose(navigate=false) { state.lastSubmission=null;const pageOpen=document.body.classList.contains('mobile-page-open');if(navigate&&isMobileFormRoute()){mobileBack();return;}modal.close();document.body.classList.remove('mobile-page-open');modal.classList.remove('mobile-route-page');if(pageOpen){const path=location.hash.slice(1).split('?')[0];location.hash=(path.includes('package-')||path.includes('subscription-'))?'cabinet/packages':path.includes('partner-new')?'cabinet/partners':path.includes('user-new')||path.includes('staff-')?'cabinet/team':state.user?'cabinet/overview':'home';}lastFocus?.focus({preventScroll:true}); }
modal.addEventListener('close',()=>{releaseFileUrls();});
modal.addEventListener('cancel',event=>{event.preventDefault();modalClose(true);});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modalClose(true);}});
const contentText = value => typeof value === 'string' ? value.trim() : String(value?.[state.script] || value?.lat || '').trim();
function availabilityNotice() {
 return state.backendConfigured===false ? `<div class="notice availability-notice" role="status">${pageLabel('Onlayn murojaat xizmati vaqtincha mavjud emas. Markazga +998 55 406 77 55 orqali bog‘laning.','Онлайн мурожаат хизмати вақтинча мавжуд эмас. Марказга +998 55 406 77 55 орқали боғланинг.')}</div>` : '';
}
const localPhoto = value => typeof value==='string' && /^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g)$/i.test(value) ? value : '';
const serviceCopy = (id, type='summary') => { const texts=(serviceContent[id]||serviceContent.other)[type]; return pageLabel(...texts); };
function publicContacts() {
 const raw=typeof siteContent.phone==='string'?siteContent.phone.trim():'';
 const phone=raw.replace(/[\s()-]/g,'');
 const address=contentText(siteContent.address);
 return `<div class="public-contacts"><strong>${pageLabel('Qashqadaryo · Qarshi shahrida ish boshlayapmiz','Қашқадарё · Қарши шаҳрида иш бошлаяпмиз')}</strong>${/^\+998\d{9}$/.test(phone)?`<a href="tel:${esc(phone)}">${icon('phone')}${esc(raw)}</a>`:''}${address?`<span>${icon('home')}${esc(address)}</span>`:''}</div>`;
}
function centerCard() {
 const photo=localPhoto(siteContent.center?.image);
 const raw=typeof siteContent.phone==='string'?siteContent.phone.trim():'';
 const phone=raw.replace(/[\s()-]/g,'');
 const address=contentText(siteContent.address);
 return `<figure class="center-card">${photo?`<img src="${esc(photo)}" alt="ZARURIYAT CENTER" width="1254" height="1254" loading="eager" fetchpriority="high">`:''}<figcaption><h2>ZARURIYAT CENTER</h2>${/^\+998\d{9}$/.test(phone)?`<a class="center-phone" href="tel:${esc(phone)}">${icon('phone')}<span>${esc(raw)}</span></a>`:''}${address?`<p class="center-address">${icon('home')}<span>${esc(address)}</span></p>`:''}</figcaption></figure>`;
}
function familyCards() {
 return packageTiers.map((tier,i)=>{
 const unlimited=pageLabel('Cheksiz','Чексиз');
 const monthly=count=>pageLabel(`Oyiga ${count} marta`,`Ойига ${count} марта`);
 const services=[
 ['ZARURIYAT operatoriga murojaat','ZARURIYAT операторига мурожаат',unlimited],
 ['Huquqiy maslahat va yo‘l-yo‘riq','Ҳуқуқий маслаҳат ва йўл-йўриқ',monthly(tier.legalConsultations)],
 ['Psixolog bilan konsultatsiya','Психолог билан консультация',monthly(tier.psychologicalConsultations)],
 ['Tibbiy mutaxassis / klinikaga yo‘naltirish','Тиббий мутахассис / клиникага йўналтириш',unlimited],
 ['Bolalar ta’limi / repetitor bo‘yicha yo‘naltirish','Болалар таълими / репетитор бўйича йўналтириш',unlimited],
 ['Maishiy xizmatlarga yo‘naltirish (tozalash, ustalar va h.k.)','Маиший хизматларга йўналтириш (тозалаш, усталар ва ҳ.к.)',unlimited]
 ];
 if(i===0)services.push(['Hamkorlar bazasidan foydalanish','Ҳамкорлар базасидан фойдаланиш',unlimited]);
 if(i>0)services.push(['Tadbirkorlik bo‘yicha maslahat','Тадбиркорлик бўйича маслаҳат',monthly(tier.businessConsultations)],['Hamkorlarda maxsus shartlar','Ҳамкорларда махсус шартлар',unlimited]);
 if(i===2)services.push(['Shaxsiy oila kuratori','Шахсий оила куратори',unlimited],['Ustuvor navbat va tezkor xizmat','Устувор навбат ва тезкор хизмат',unlimited],['Hujjat jarayonlarini kuzatish','Ҳужжат жараёнларини кузатиш',unlimited],['Premium hamkorlar imtiyozlari','Premium ҳамкорлар имтиёзлари',unlimited]);
 const titles=[['Asosiy himoya','Асосий ҳимоя'],['Oila uchun keng imkoniyatlar','Оила учун кенг имкониятлар'],['Oila uchun shaxsiy yordam tizimi','Оила учун шахсий ёрдам тизими']];
 const summaries=[['Kundalik masalalarda ishonchli ko‘mak va yo‘naltirish.','Кундалик масалаларда ишончли кўмак ва йўналтириш.'],['Siz va oilangiz uchun ko‘proq xizmatlar va qo‘llab-quvvatlash.','Сиз ва оилангиз учун кўпроқ хизматлар ва қўллаб-қувватлаш.'],['Oilangizga maksimal qo‘llab-quvvatlash va shaxsiy yondashuv.','Оилангизга максимал қўллаб-қувватлаш ва шахсий ёндашув.']];
 const price=String(tier.monthlyPrice).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
 return `<article class="package-card package-${tier.name.toLowerCase()} ${i===1?'featured':''}"><span class="label">${pageLabel('Oila paketi','Оила пакети')}</span><h3>${tier.name}</h3><h4>${pageLabel(...titles[i])}</h4><p>${pageLabel(...summaries[i])}</p><div class="package-price"><strong>${price}</strong> <span>${pageLabel('so‘m / oy','сўм / ой')}</span></div><div class="package-members">${icon('users')} ${pageLabel(`Oila a’zolari: ${tier.familyMembers} nafargacha`,`Оила аъзолари: ${tier.familyMembers} нафаргача`)}</div><div class="package-line"></div><ul class="package-services">${services.map(([lat,cyr,limit])=>`<li><span>${pageLabel(lat,cyr)}</span><b>${limit}</b></li>`).join('')}</ul><button class="text-btn" data-action="buy-package" data-package="${tier.name}">${pageLabel('Paketni tanlash','Пакетни танлаш')} ${icon('arrow')}</button></article>`;
 }).join('');
}
function landing() {
 app.dataset.page='public'; const serviceIcons=['scale','message','medical','sun','heart','user','briefcase','bank','file','users','heart','sun','tool','layers'];
 app.innerHTML=`<header class="site-header"><div class="container nav-inner">${brand()}<nav class="nav-links" aria-label="Asosiy navigatsiya"><button class="icon-btn compact-site-menu" data-action="site-menu" aria-label="${pageLabel('Menyuni ochish','Менюни очиш')}">${icon('menu')}</button><a href="#services">${state.script==='cyr'?'Хизматлар':'Xizmatlar'}</a><a href="#how">${state.script==='cyr'?'Қандай ишлайди':'Qanday ishlaydi'}</a><a href="#family">${state.script==='cyr'?'Оила учун':'Oila uchun'}</a><a href="#track" data-action="track">${state.script==='cyr'?'Мурожаатни кузатиш':'Murojaatni kuzatish'}</a><button class="script-toggle" data-action="toggle-script" title="Alifboni o‘zgartirish">${state.script==='cyr'?'O‘zb (Lotin)':'Ўзб (Кирилл)'}</button><button class="btn outline header-login-btn" data-action="${state.user?'cabinet':'login'}">${icon('user')}${state.user?(state.script==='cyr'?'Менинг кабинетим':'Mening kabinetim'):(state.script==='cyr'?'Кабинетга кириш':'Kabinetga kirish')}</button></nav></div></header>
 <main id="main"><div class="container">${availabilityNotice()}<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="tiny-dot"></span> ${state.script==='cyr'?'Қаршида · Оилангиз учун хизматлар':'Qarshida · Oilangiz uchun xizmatlar'}</div><h1>${state.script==='cyr'?'Муаммоингизни<br>айтинг. <em>Ечимни<br>бирга топамиз.</em>':'Muammoingizni<br>ayting. <em>Yechimni<br>birga topamiz.</em>'}</h1><p>${state.script==='cyr'?'Қаршида оилангизга керакли хизматларни ташкил қилишда кўмаклашамиз. Сизни тинглаб, эҳтиёжингизга мос мутахассис ёки ҳамкор хизматга йўналтирамиз.':'Qarshida oilangizga kerakli xizmatlarni tashkil qilishda ko‘maklashamiz. Sizni tinglab, ehtiyojingizga mos mutaxassis yoki hamkor xizmatga yo‘naltiramiz.'}</p>${publicContacts()}<div class="hero-actions"><button class="btn glow-btn" data-action="request">${icon('heart')} ${state.script==='cyr'?'Мурожаат қолдириш':'Murojaat qoldirish'} ${icon('arrow')}</button><button class="btn outline hero-track-btn" data-action="track">${icon('clock')} ${state.script==='cyr'?'Мурожаатни кузатиш':'Murojaatni kuzatish'}</button></div><div class="hero-features"><div class="hf-item">${icon('shield')} <span>${state.script==='cyr'?'Махфий калит билан кузатиш':'Maxfiy kalit bilan kuzatish'}</span></div><div class="hf-item">${icon('user')} <span>${state.script==='cyr'?'Шахсий координатор':'Shaxsiy koordinator'}</span></div><div class="hf-item">${icon('check')} <span>${state.script==='cyr'?'Ҳамкор хизматлари':'Hamkor xizmatlari'}</span></div></div></div>
 <div class="hero-showcase has-real-photos center-showcase">${centerCard()}</div></section>
 <div class="metrics-bar" role="group" aria-label="Platforma imkoniyatlari">${[['∞', 'Чексиз йўналишлар','Cheksiz yo‘nalishlar','Эҳтиёжга мос мутахассис','Ehtiyojga mos mutaxassis'],['1','Ягона мурожаат','Yagona murojaat','Бир нечта хизмат бир мурожаатда','Bir nechta xizmat bir murojaatda'],['↗','Босқичма-босқич кузатиш','Bosqichma-bosqich kuzatish','Ҳолат ва жараён тарихи','Holat va jarayon tarixi'],['◎','Оила учун мувофиқлаштириш','Oila uchun muvofiqlashtirish','Яқинларингизга мос ёрдам','Yaqinlaringizga mos yordam']].map(([n,cl,ll,cs,ls])=>`<div class="metric-card"><div class="metric-num">${n}</div><div class="metric-label">${state.script==='cyr'?cl:ll}</div><div class="metric-sub">${state.script==='cyr'?cs:ls}</div></div>`).join('<div class="metric-divider"></div>')}</div>
 <section class="section" id="services"><div class="section-heading"><div><div class="eyebrow">01 / ${state.script==='cyr'?'Хизмат йўналишлари':'Xizmat yo‘nalishlari'}</div><h2>${state.script==='cyr'?'Сизга қандай ёрдам керак?':'Sizga qanday yordam kerak?'}</h2></div><p>${state.script==='cyr'?'Қаршида керакли йўналишни танланг. Координатор эҳтиёжингизни аниқлаб, хизматни ташкил қилишда кўмаклашади.':'Qarshida kerakli yo‘nalishni tanlang. Koordinator ehtiyojingizni aniqlab, xizmatni tashkil qilishda ko‘maklashadi.'}</p></div><div class="service-grid">${state.config.categories.filter(c=>c.id!=='other').map((c,i)=>`<button class="service-tile" data-action="request" data-category="${esc(c.id)}"><div class="tile-icon-wrap">${icon(serviceIcons[i]||'layers')}</div><div class="tile-info"><span class="tile-title">${esc(tr(c.name))}</span><span class="tile-sub">${esc(serviceCopy(c.id))}</span></div>${icon('arrow','arrow')}</button>`).join('')}<button class="service-tile other" data-action="request" data-category="${esc(state.config.categories.find(c=>c.id==='other')?.id||'other')}"><div class="tile-icon-wrap">${icon('tool')}</div><div class="tile-info"><span class="tile-title">${state.script==='cyr'?'Бошқа йўналишлар':'Boshqa yo‘nalishlar'}</span><span class="tile-sub">${esc(serviceCopy('other'))}</span></div>${icon('arrow','arrow')}</button></div>
 <div class="unknown-banner"><div class="unknown-content"><span class="pill amber"><span class="tiny-dot"></span> ${state.script==='cyr'?'Алоҳида имконият · Хизматни ташкил қилиш':'Alohida imkoniyat · Xizmatni tashkil qilish'}</span><h3>${state.script==='cyr'?'Қаердан бошлаш ёки қайси мутахассис кераклигини билмайсизми?':'Qayerdan boshlash yoki qaysi mutaxassis kerakligini bilmayapsizmi?'}</h3><p>${state.script==='cyr'?'Муаммоингизни оддий ўз сўзингиз билан айтинг. ZARURIYAT координатори барча керакли мутахассисларни аниқлаб, битта мурожаат ичида ҳаммасини ташкиллаштириб беради.':'Muammoingizni oddiy o‘z so‘zingiz bilan ayting. ZARURIYAT koordinatori kerakli mutaxassislarni aniqlab, barcha xizmatlarni bitta murojaat ichida tashkillashtirib beradi.'}</p><div class="unknown-action-row"><button class="btn prominent-help-btn" data-action="request-unknown">${icon('heart')} ${state.script==='cyr'?'Қайси хизмат кераклигини билмайман':'Qaysi xizmat kerakligini bilmayman'} ${icon('arrow')}</button><span class="unknown-hint">${icon('shield')} ${state.script==='cyr'?'Эҳтиёжингизга мос йўналтириш':'Ehtiyojingizga mos yo‘naltirish'}</span></div></div><div class="unknown-media"><img src="/images/services.webp" alt="Zaruriyat xizmatlarni tashkil qilish" class="unknown-img" width="380" height="260" loading="lazy"></div></div></section></div>
 <section class="how-section" id="how"><div class="container section"><div class="section-heading"><div><div class="eyebrow">02 / ${state.script==='cyr'?'Қандай ишлайди':'Qanday ishlaydi'}</div><h2>${state.script==='cyr'?'Мурожаатдан ечимгача.':'Murojaatdan yechimgacha.'}</h2></div><p>${state.script==='cyr'?'Қаршида мурожаат қилиш ва хизматни ташкил этиш учун тўрт қадам.':'Qarshida murojaat qilish va xizmatni tashkil etish uchun to‘rt qadam.'}</p></div><div class="how-split-layout"><div class="how-media-panel"><div class="how-img-container"><img src="/images/how.webp" alt="Qanday ishlaydi" class="how-main-img" width="520" height="420" loading="lazy"><div class="how-glass-badge"><span class="hgb-icon">${icon('heart')}</span><div><b>${state.script==='cyr'?'Битта мурожаат — яхлит ечим':'Bitta murojaat — yaxlit yechim'}</b><p>${state.script==='cyr'?'Мутахассисларни ўзингиз изламайсиз':'Mutaxassislarni o‘zingiz izlamaysiz'}</p></div></div></div></div><div class="steps-timeline"><article class="timeline-step"><span class="step-no">01</span><div class="step-body"><h3>${state.script==='cyr'?'Муаммоингизни айтинг':'Muammoingizni ayting'}</h3><p>${state.script==='cyr'?'Исм, телефон ва вазиятингизнинг қисқача баёнини ёзинг. Қолган маълумотларни координатор аниқлаштиради.':'Ism, telefon va vaziyatingizning qisqacha bayonini yozing. Qolgan ma’lumotlarni koordinator aniqlashtiradi.'}</p></div></article><article class="timeline-step"><span class="step-no">02</span><div class="step-body"><h3>${state.script==='cyr'?'Бирга аниқлаштирамиз':'Birga aniqlashtiramiz'}</h3><p>${state.script==='cyr'?'Шахсий координатор боғланиб, вазиятни ўрганади ва керакли хизматларни белгилайди.':'Shaxsiy koordinator bog‘lanib, vaziyatni o‘rganadi va kerakli xizmatlarni belgilaydi.'}</p></div></article><article class="timeline-step"><span class="step-no">03</span><div class="step-body"><h3>${state.script==='cyr'?'Хизматни келишамиз':'Xizmatni kelishamiz'}</h3><p>${state.script==='cyr'?'Хизматни бажарувчи ҳамкор, аниқ ва қулай вақт ҳамда шаффоф нарх сиз билан келишилади.':'Xizmatni bajaruvchi hamkor, aniq va qulay vaqt hamda shaffof narx siz bilan kelishiladi.'}</p></div></article><article class="timeline-step"><span class="step-no">04</span><div class="step-body"><h3>${state.script==='cyr'?'Натижани назорат қиласиз':'Natijani nazorat qilasiz'}</h3><p>${state.script==='cyr'?'Ишни онлайн кузатинг, натижани қабул қилинг ва хизмат сифатини баҳоланг.':'Ishni onlayn kuzating, natijani qabul qiling va xizmat sifatini baholang.'}</p></div></article></div></div></div></section>
 <div class="container"><section class="section family-section" id="family"><div><div class="eyebrow">03 / ${pageLabel('Oila uchun','Оила учун')}</div><h2>${pageLabel('Oilangiz uchun kerakli xizmatlar — bir joyda!','Оилангиз учун керакли хизматлар — бир жойда!')}</h2><p>${pageLabel('Qarshida ZARURIYAT oila paketi kundalik, huquqiy, ijtimoiy, psixologik va maishiy ehtiyojlarni hal qilishda ko‘maklashadi.','Қаршида ZARURIYAT оила пакети кундалик, ҳуқуқий, ижтимоий, психологик ва маиший эҳтиёжларни ҳал қилишда кўмаклашади.')}</p><h3>${pageLabel('Nima uchun ZARURIYAT?','Нима учун ZARURIYAT?')}</h3><p>${pageLabel('Bir murojaat — kerakli mutaxassisga yo‘l. Siz turli tashkilot va mutaxassislarni izlab vaqt sarflamaysiz. Koordinator ehtiyojingizni aniqlab, tegishli mutaxassis yoki hamkor xizmatga yo‘naltiradi.','Бир мурожаат — керакли мутахассисга йўл. Сиз турли ташкилот ва мутахассисларни излаб вақт сарфламайсиз. Координатор эҳтиёжингизни аниқлаб, тегишли мутахассис ёки ҳамкор хизматга йўналтиради.')}</p></div><div><div class="package-cards">${familyCards()}</div><div class="notice package-fees">${pageLabel('Tashqi mutaxassislar xizmat haqi paket narxiga kirmaydi va alohida to‘lanishi mumkin. Narxlar bir oylik abonent to‘lovi uchun. Qo‘shimcha xizmatlar va xarajatlar xizmat boshlanishidan oldin siz bilan kelishiladi.','Ташқи мутахассислар хизмат ҳақи пакет нархига кирмайди ва алоҳида тўланиши мумкин. Нархлар бир ойлик абонент тўлови учун. Қўшимча хизматлар ва харажатлар хизмат бошланишидан олдин сиз билан келишилади.')}</div></div></section><section class="section faq-section" id="faq"><div class="section-heading"><div><div class="eyebrow">04 / ${state.script==='cyr'?'Саволлар ва жавоблар':'Savollar va javoblar'}</div><h2>${state.script==='cyr'?'Мурожаатдан олдин билиб олинг.':'Murojaatdan oldin bilib oling.'}</h2></div></div><div class="faq-list">${[
['Хизмат нархи қандай белгиланади?','Xizmat narxi qanday belgilanadi?','Хизмат ҳажми, нархи ва бажариш вақти хизмат бошланишидан олдин сиз билан келишилади. Мурожаат юбориш автоматик тўлов эмас.','Xizmat hajmi, narxi va bajarish vaqti xizmat boshlanishidan oldin siz bilan kelishiladi. Murojaat yuborish avtomatik to‘lov emas.'],
['Оила пакетларига нима киради?','Oila paketlariga nima kiradi?','STANDARD — 99 000 сўм/ой, 4 нафаргача; COMFORT — 199 000 сўм/ой, 5 нафаргача; PREMIUM — 399 000 сўм/ой, 6 нафаргача. Хизматлар ва ойлик маслаҳат лимитлари тариф карточкаларида кўрсатилган.','STANDARD — 99 000 so‘m/oy, 4 nafargacha; COMFORT — 199 000 so‘m/oy, 5 nafargacha; PREMIUM — 399 000 so‘m/oy, 6 nafargacha. Xizmatlar va oylik maslahat limitlari tarif kartochkalarida ko‘rsatilgan.'],
['Мурожаатни қандай кузатаман?','Murojaatni qanday kuzataman?','Мурожаат рақами ва махфий калитни сақланг. Калитни бошқаларга берманг: у мурожаат тафсилотларини очади.','Murojaat raqami va maxfiy kalitni saqlang. Kalitni boshqalarga bermang: u murojaat tafsilotlarini ochadi.'],
['Шошилинч вазиятда ёрдам берасизми?','Shoshilinch vaziyatda yordam berasizmi?','Платформа кундалик хизматларни мувофиқлаштиради. Ҳаёт ёки соғлиққа хавф туғилганда онлайн жавобни кутмасдан тегишли фавқулодда хизматга боғланинг.','Platforma kundalik xizmatlarni muvofiqlashtiradi. Hayot yoki sog‘liqqa xavf tug‘ilganda onlayn javobni kutmasdan tegishli favqulodda xizmatga bog‘laning.']
].map(([cq,lq,ca,la])=>`<details><summary>${state.script==='cyr'?cq:lq}</summary><p>${state.script==='cyr'?ca:la}</p></details>`).join('')}</div></section><section class="contact-band"><div><h2>${state.script==='cyr'?'Ҳар бир ечим суҳбатдан бошланади.':'Har bir yechim suhbatdan boshlanadi.'}</h2><p>${state.script==='cyr'?'Муаммоингиз катта ёки кичик бўлишидан қатъи назар, бизга айтинг.':'Muammoingiz katta yoki kichik bo‘lishidan qat’i nazar, bizga ayting.'}</p>${publicContacts()}</div><button class="btn prominent-contact-btn" data-action="request">${icon('heart')} ${state.script==='cyr'?'Мурожаат қолдириш':'Murojaat qoldirish'} ${icon('arrow')}</button></section></div></main><footer class="site-footer"><div class="container"><div class="footer-inner">${brand()}<div class="footer-links"><button data-action="privacy">${state.script==='cyr'?'Махфийлик ва розилик':'Maxfiylik va rozilik'}</button><button data-action="track">${state.script==='cyr'?'Мурожаатни кузатиш':'Murojaatni kuzatish'}</button><span>${state.script==='cyr'?'Инсоний ёндашув. Шаффоф жараён.':'Insoniy yondashuv. Shaffof jarayon.'}</span></div></div><p class="footer-bottom">© ${new Date().getFullYear()} ZARURIYAT. ${state.script==='cyr'?'Онлайн хизматларни мувофиқлаштириш платформаси. Давлат хизмати эмас. Шошилинч ёрдам учун тегишли фавқулодда хизматга (102, 103) мурожаат қилинг.':'Onlayn xizmatlarni muvofiqlashtirish platformasi. Davlat xizmati emas. Shoshilinch yordam uchun tegishli favqulodda xizmatga (102, 103) murojaat qiling.'}</p></div></footer>${mobileBottomNav('public')}`;
}
function siteMenuDialog() {
  const isCyr = state.script === 'cyr';
  modalOpen(
    isCyr ? 'Платформа бўлимлари' : 'Platforma bo‘limlari',
    isCyr ? 'Тезкор навигация ва боғланиш' : 'Tezkor navigatsiya va bog‘lanish',
    `<div class="site-menu-list">
      <a href="#services" class="site-menu-item" data-action="close">${icon('layers')} <div><b>${isCyr ? 'Хизмат йўналишлари' : 'Xizmat yo‘nalishlari'}</b><small>${isCyr ? 'Эҳтиёжингизга мос хизматлар' : 'Ehtiyojingizga mos xizmatlar'}</small></div> ${icon('arrow')}</a>
      <a href="#how" class="site-menu-item" data-action="close">${icon('clock')} <div><b>${isCyr ? 'Қандай ишлайди?' : 'Qanday ishlaydi?'}</b><small>${isCyr ? 'Қаршида хизматни ташкил қилиш' : 'Qarshida xizmatni tashkil qilish'}</small></div> ${icon('arrow')}</a>
      <a href="#family" class="site-menu-item" data-action="close">${icon('heart')} <div><b>${isCyr ? 'Оила пакетлари' : 'Oila paketlari'}</b><small>${isCyr ? 'STANDARD, COMFORT, PREMIUM' : 'STANDARD, COMFORT, PREMIUM'}</small></div> ${icon('arrow')}</a>
      <button class="site-menu-item" data-action="track">${icon('clock')} <div><b>${isCyr ? 'Мурожаатни кузатиш' : 'Murojaatni kuzatish'}</b><small>${isCyr ? 'Рақам ва калит билан' : 'Raqam va kalit bilan'}</small></div> ${icon('arrow')}</button>
      <button class="site-menu-item" data-action="${state.user ? 'cabinet' : 'login'}">${icon('user')} <div><b>${state.user ? (isCyr ? 'Менинг кабинетим' : 'Mening kabinetim') : (isCyr ? 'Кабинетга кириш' : 'Kabinetga kirish')}</b><small>${state.user ? esc(state.user.name) : (isCyr ? 'Кириш ёки рўйхатдан ўтиш' : 'Kirish yoki ro‘yxatdan o‘tish')}</small></div> ${icon('arrow')}</button>
      <div class="site-menu-divider"></div>
      <a href="#faq" class="site-menu-item" data-action="close">${icon('message')} <div><b>${pageLabel('Savollar va javoblar','Саволлар ва жавоблар')}</b><small>${pageLabel('Narx, paket va murojaat shartlari','Нарх, пакет ва мурожаат шартлари')}</small></div> ${icon('arrow')}</a>
      ${publicContacts()}<div class="site-menu-actions">
        <button class="btn outline small" data-action="toggle-script" style="width:100%;justify-content:center">${state.script === 'cyr' ? 'Ўзбекча (Lotin)' : 'Ўзбекча (Кирилл)'}</button>
        <button class="btn outline small" data-action="privacy" style="width:100%;justify-content:center">${icon('shield')} ${isCyr ? 'Махфийлик ва хавфсизлик' : 'Maxfiylik va xavfsizlik'}</button>
        <button class="btn small" data-action="request" style="width:100%;justify-content:center">${icon('heart')} ${isCyr ? 'Мурожаат қолдириш' : 'Murojaat qoldirish'}</button>
      </div>
    </div>`
  );
}

function requestDialog(categoryId='',packageName='',isUnknown=false) {
 state.lastSubmission=null;
 const isCyr=state.script==='cyr',contact=requestContact(state.user);
 const selectedCategory=state.config.categories.some(c=>c.id===categoryId)?categoryId:'other';
 modalOpen(isUnknown?pageLabel('Qaysi xizmat kerakligini bilmayman','Қайси хизмат кераклигини билмайман'):pageLabel('Murojaat qoldirish','Мурожаат қолдириш'),pageLabel('Qarshida xizmatlarni tashkil qilamiz. Qolgan ma’lumotlarni koordinator siz bilan bog‘lanib aniqlashtiradi.','Қаршида хизматларни ташкил қиламиз. Қолган маълумотларни координатор сиз билан боғланиб аниқлаштиради.'),`<form id="request-form">${formError}${staff()?`<div class="notice">${pageLabel("Mijoz nomidan murojaat yaratyapsiz. Mijozning ismi va telefonini kiriting. Rahbar yoki koordinator hisobi mijozga aylanmaydi.","Мижоз номидан мурожаат яратяпсиз. Мижознинг исми ва телефонини киритинг. Раҳбар ёки координатор ҳисоби мижозга айланмайди.")}</div>`:''}<input type="hidden" name="region" value="Qashqadaryo"><input type="hidden" name="category" value="${esc(selectedCategory)}"><div class="form-grid">${field('name',staff()?pageLabel('Mijozning ismi','Мижознинг исми'):(isCyr?'Исмингиз':'Ismingiz'),'text',contact.name,'required minlength="2" maxlength="100" autocomplete="name"')}${field('phone',staff()?pageLabel('Mijozning telefon raqami','Мижознинг телефон рақами'):(isCyr?'Телефон рақамингиз':'Telefon raqamingiz'),'tel',contact.phone,'required inputmode="tel" autocomplete="tel" placeholder="+998 90 123 45 67"')}${textareaField('description',isCyr?'Вазиятнинг қисқача баёни':'Vaziyatning qisqacha bayoni',packageName?pageLabel(`${packageName} oila paketi haqida ma’lumot va maslahat kerak.`,`${packageName} оила пакети ҳақида маълумот ва маслаҳат керак.`):'','required minlength="10" maxlength="5000"')}</div><label class="check-label"><input type="checkbox" name="consent" required><span>${staff()?pageLabel('Mijozning murojaati va shaxsiy ma’lumotlarini qayta ishlash uchun uning roziligini oldim.','Мижознинг мурожаати ва шахсий маълумотларини қайта ишлаш учун унинг розилигини олдим.'):pageLabel('Murojaatimni ko‘rib chiqish, men bilan bog‘lanish va zarur ma’lumotlarni xizmatni bajaruvchi hamkorga taqdim etish uchun shaxsiy ma’lumotlarim qayta ishlanishiga roziman.','Мурожаатимни кўриб чиқиш, мен билан боғланиш ва зарур маълумотларни хизматни бажарувчи ҳамкорга тақдим этиш учун шахсий маълумотларим қайта ишланишига розиман.')}</span></label><div class="form-actions"><span class="payment-note">${pageLabel('Murojaat yuborish avtomatik to‘lov emas','Мурожаат юбориш автоматик тўлов эмас')}</span><button type="submit" class="btn">${pageLabel('Murojaatni yuborish','Мурожаатни юбориш')} ${icon('arrow')}</button></div></form>`);
}
function successDialog(result) {
 const c=result.case,token=result.trackingToken,isCyr=state.script==='cyr';
 if(staff()){
  modalOpen(pageLabel('Mijoz murojaati qabul qilindi','Мижоз мурожаати қабул қилинди'),'',`<div class="success"><div class="success-icon">${icon('check')}</div><h3>${esc(c.number)}</h3><p>${pageLabel('Murojaat Murojaatlar bo‘limiga tushdi. Mas’ul xodimni belgilang va mijoz bilan bog‘laning.','Мурожаат Мурожаатлар бўлимига тушди. Масъул ходимни белгиланг ва мижоз билан боғланинг.')}</p><div class="notice">${pageLabel('Kuzatish raqami va maxfiy kalitni faqat shu mijozga taqdim eting.','Кузатиш рақами ва махфий калитни фақат шу мижозга тақдим этинг.')}</div><div class="form-actions"><button class="btn outline" data-action="copy" data-text="${esc(`Murojaat: ${c.number} · Maxfiy kalit: ${token}`)}">${pageLabel('Mijoz uchun raqam va kalitni nusxalash','Мижоз учун рақам ва калитни нусхалаш')}</button><button class="btn" data-action="case" data-id="${c.id}">${pageLabel('Murojaatni boshqarish','Мурожаатни бошқариш')}</button></div></div>`);
  state.lastSubmission=result;return;
 }
 modalOpen(isCyr?'Мурожаатингиз қабул қилинди':'Murojaatingiz qabul qilindi','',`<div class="success"><div class="success-icon">${icon('check')}</div><h3>${isCyr?'Кейинги қадам — сиз билан боғланиш.':'Keyingi qadam — siz bilan bog‘lanish.'}</h3><p>${isCyr?'Мурожаатингизни координатор ўрганади. Ҳолатни қуйидаги рақам ва махфий калит билан кузатишингиз мумкин.':'Murojaatingizni koordinator o‘rganadi. Holatni quyidagi raqam va maxfiy kalit bilan kuzatishingiz mumkin.'}</p><div class="token-box"><label>${isCyr?'Мурожаат рақами':'Murojaat raqami'}</label><strong>${esc(c.number)}</strong></div><div class="token-box"><label>${isCyr?'Махфий кузатиш калити':'Maxfiy kuzatish kaliti'}</label><code>${esc(token)}</code><button class="btn outline small" data-action="copy" data-text="${esc(`Murojaat: ${c.number} · Maxfiy kalit: ${token}`)}">${icon('copy')} ${isCyr?'Рақам ва калитни нусхалаш':'Raqam va kalitni nusxalash'}</button></div><div class="notice warning">${isCyr?'Калитни ҳозир сақлаб олинг. У мурожаатингиздаги шахсий маълумотларга кириш имконини беради. Уни бошқаларга юборманг.':'Kalitni hozir saqlab oling. U murojaatingizdagi shaxsiy ma’lumotlarga kirish imkonini beradi. Uni boshqalarga yubormang.'}</div><div class="form-actions"><button class="btn" data-action="track-prefill" data-number="${esc(c.number)}" data-token="${esc(token)}">${isCyr?'Мурожаатни кузатиш':'Murojaatni kuzatish'} ${icon('arrow')}</button></div></div>`);
 state.lastSubmission=result;
}
function trackingDialog(number='',token='') {
 const isCyr=state.script==='cyr';
 modalOpen(isCyr?'Мурожаатни кузатиш':'Murojaatni kuzatish',isCyr?'Шахсий маълумотларингизни ҳимоя қилиш учун рақам ва махфий калит талаб қилинади.':'Shaxsiy ma’lumotlaringizni himoya qilish uchun raqam va maxfiy kalit talab qilinadi.',`<form id="track-form">${formError}<div class="form-grid">${field('number',isCyr?'Мурожаат рақами':'Murojaat raqami','text',number,'required placeholder="ZAR-000001" autocomplete="off"',true)}${field('token',isCyr?'Махфий кузатиш калити':'Maxfiy kuzatish kaliti','password',token,'required autocomplete="off" placeholder="'+(isCyr?'Мурожаат юборганда берилган калит':'Murojaat yuborganda berilgan kalit')+'"',true)}</div><div class="form-actions"><button class="btn" type="submit">${isCyr?'Ҳолатини кўриш':'Holatini ko‘rish'} ${icon('arrow')}</button></div></form><div id="tracking-result"></div>`);
}
function registrationVerification(form,proof){
 const url=new URL(proof.url);if(url.protocol!=='https:'||url.hostname!=='t.me')throw new Error(tr('Telegram bot manzili noto‘g‘ri.'));
 form.dataset.verification=proof.challenge;form.dataset.verificationPhone=proof.phone;form.dataset.verificationUrl=url.href;
 let panel=$('.registration-telegram',form);if(!panel){panel=document.createElement('div');panel.className='registration-telegram notice';form.querySelector('[type="submit"]').before(panel);}
 panel.innerHTML=`<p>${pageLabel('1. Telegramni ochib Start bosing. 2. Botdagi «Telefon raqamimni ulashish» tugmasini bosing. 3. Saytga qaytib «Kabinet yaratish» tugmasini yana bosing.','1. Telegramни очиб Start босинг. 2. Ботдаги «Telefon raqamimni ulashish» тугмасини босинг. 3. Сайтга қайтиб «Кабинет яратиш» тугмасини яна босинг.')}</p><p>${pageLabel('Faqat o‘z raqamingiz qabul qilinadi. Havola 15 daqiqa amal qiladi.','Фақат ўз рақамингиз қабул қилинади. Ҳавола 15 дақиқа амал қилади.')}</p><div class="form-actions"><a class="btn" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${pageLabel('Telegramda tasdiqlash','Telegramда тасдиқлаш')}</a><button class="btn outline small" type="button" data-action="registration-restart">${pageLabel('Qayta boshlash','Қайта бошлаш')}</button></div>`;
 panel.scrollIntoView({block:'nearest'});
}
function loginDialog(register=false) {
 state.lastSubmission=null;
 const isCyr=state.script==='cyr';
 const tab1=isCyr?'Кириш':'Kirish';
 const tab2=isCyr?'Рўйхатдан ўтиш':"Ro'yxatdan o'tish";
 const regHtml=`
  <div class="auth-brand-row">
   <div class="auth-logo-icon"><img src="/images/zaruriyat-logo-192.png" alt="" width="68" height="68"></div>
   <div>
    <div class="auth-logo-name">ZARURIYAT</div>
    <div class="auth-logo-sub">${register?pageLabel('Hisob yarating','Ҳисоб яратинг'):pageLabel('Hisobingizga kiring','Ҳисобингизга киринг')}</div>
   </div>
  </div>
  <p class="auth-intro">${register?pageLabel('Murojaatlaringiz va oilangiz uchun yordamni bir joydan boshqaring.','Мурожаатларингиз ва оилангиз учун ёрдамни бир жойдан бошқаринг.'):pageLabel('Murojaat holati, xizmatlar va keyingi qadamlarni kuzating.','Мурожаат ҳолати, хизматлар ва кейинги қадамларни кузатинг.')}</p><div class="auth-tabs" aria-label="${isCyr?'Кабинетга кириш':'Kabinetga kirish'}">
   <button class="auth-tab${!register?' active':''}" aria-pressed="${!register}" data-action="login" type="button">${tab1}</button>
   <button class="auth-tab${register?' active':''}" aria-pressed="${register}" data-action="register" type="button">${tab2}</button>
   <span class="auth-tab-slider" style="transform:translateX(${register?'100%':'0%'})"></span>
  </div>
  <form id="${register?'register':'login'}-form" class="auth-form">
   ${formError}
   ${register?`
    <div class="auth-field">
     <label>${isCyr?'Исм ва фамилия':'Ism va familiya'}</label>
     <div class="auth-input-wrap">
      <svg viewBox="0 0 24 24" class="auth-field-icon"><circle cx="12" cy="8" r="4"/><path d="M20 21v-1a8 8 0 0 0-16 0v1"/></svg>
      <input name="name" type="text" autocomplete="name" required maxlength="100" placeholder="Sardor Aliyev">
     </div>
    </div>
    <div class="auth-field">
     <label>${isCyr?'Телефон рақами':'Telefon raqami'}</label>
     <div class="auth-input-wrap">
      <svg viewBox="0 0 24 24" class="auth-field-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 12 19.79 19.79 0 0 1 1.08 3.38 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16z"/></svg>
      <input name="phone" type="tel" autocomplete="tel" required placeholder="+998 90 123 45 67" value="+998" inputmode="tel">
     </div>
    </div>
    <div class="auth-field">
     <label>${tr('Parol')} <small class="auth-label-note">${tr("(kamida 10 belgi)")}</small></label>
     <div class="auth-input-wrap">
      <svg viewBox="0 0 24 24" class="auth-field-icon"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <input name="password" id="auth-pwd" type="password" autocomplete="new-password" required minlength="10" maxlength="72" placeholder="${tr('Kuchli parol kiriting')}">
      <button type="button" class="auth-eye" id="auth-eye-btn" aria-label="${tr('Ko‘rsatish')}">
       <svg viewBox="0 0 24 24"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
     </div>
     <div class="auth-strength-bar"><div class="auth-strength-fill" id="auth-strength-fill"></div></div>
     <span class="auth-strength-label" id="auth-strength-label"></span>
    </div>
    <label class="auth-consent">
     <input type="checkbox" name="consent" required>
     <span>${tr("Shaxsiy ma'lumotlarim xizmat ko'rsatish maqsadida qayta ishlanishiga roziman.")}</span>
    </label><a class="auth-privacy" href="#privacy" target="_blank" rel="noopener">${pageLabel('Maxfiylik shartlarini o‘qish ↗','Махфийлик шартларини ўқиш ↗')}</a>
    <button type="submit" class="auth-submit-btn">${tr('Kabinet yaratish')} <svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button>
   `:`
    <div class="auth-field">
     <label>${isCyr?'Телефон ёки логин':'Telefon yoki login'}</label>
     <div class="auth-input-wrap">
      <svg viewBox="0 0 24 24" class="auth-field-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 12 19.79 19.79 0 0 1 1.08 3.38 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16z"/></svg>
      <input name="login" type="text" autocomplete="username" required placeholder="+998 90 123 45 67" value="+998">
     </div>
    </div>
    <div class="auth-field">
     <label>${tr('Parol')}</label>
     <div class="auth-input-wrap">
      <svg viewBox="0 0 24 24" class="auth-field-icon"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <input name="password" id="auth-pwd" type="password" autocomplete="current-password" required placeholder="${tr('Parolingizni kiriting')}">
      <button type="button" class="auth-eye" id="auth-eye-btn" aria-label="${tr('Ko‘rsatish')}">
       <svg viewBox="0 0 24 24"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
     </div>
    </div>
    <button type="submit" class="auth-submit-btn">${tab1} <svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button>
   `}
  </form>
  ${!register?`<button type="button" class="text-btn auth-recovery" data-action="recovery">${tr('Parolni unutdingizmi?')}</button>`:''}
  <div class="auth-trust-row">
   <div class="auth-trust-item"><svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/></svg>${tr("Maxfiy kalit bilan kuzatish")}</div>
   <div class="auth-trust-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21v-1a8 8 0 0 0-16 0v1"/></svg>${tr("Shaxsiy murojaatlar tarixi")}</div>
   <div class="auth-trust-item"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${tr("Xizmatlar bir joyda")}</div>
  </div>`;
 if(!modal.open)lastFocus=document.activeElement;
 modal.innerHTML=`<div class="modal-body auth-modal-body"><div class="auth-dialog-wrap"><button type="button" class="icon-btn auth-close" data-action="close" aria-label="${isCyr?'Ёпиш':'Yopish'}">${icon('close')}</button>${regHtml}</div></div>`;
 modal.querySelector('.auth-logo-sub').id='modal-title';
 modal.querySelectorAll('.auth-field').forEach((wrapper,index)=>{
  const input=wrapper.querySelector('input'),label=wrapper.querySelector('label');
  if(input&&label){input.id=input.id||`auth-field-${index}`;label.htmlFor=input.id;}
 });
 if(!modal.open)modal.showModal();
 modal.scrollTop=0;
 const eyeBtn=modal.querySelector('#auth-eye-btn');
 if(eyeBtn){
  eyeBtn.addEventListener('click',()=>{
   const inp=modal.querySelector('#auth-pwd');
   if(!inp)return;
   const show=inp.type==='password';
   inp.type=show?'text':'password';eyeBtn.setAttribute('aria-label',tr(show?'Yashirish':'Ko‘rsatish'));
   eyeBtn.setAttribute('aria-pressed',String(show));
   eyeBtn.setAttribute('aria-label',show?pageLabel('Parolni yashirish','Паролни яшириш'):pageLabel('Parolni ko‘rsatish','Паролни кўрсатиш'));
  });
 }
 const pwdIn=modal.querySelector('[name="password"]');
 if(pwdIn&&register){
  pwdIn.addEventListener('input',()=>{
   const v=pwdIn.value,l=v.length;
   const bar=modal.querySelector('#auth-strength-fill'),lbl=modal.querySelector('#auth-strength-label');
   if(!bar||!lbl)return;
   const score=(l>=10?1:0)+(l>=14?1:0)+(/[A-Z]/.test(v)?1:0)+(/[0-9]/.test(v)?1:0)+(/[^A-Za-z0-9]/.test(v)?1:0);
   const colors=['#b91c1c','#9a3412','#854d0e','#166534','#0f766e'];
   const labels=['Juda zaif','Zaif','O‘rtacha','Yaxshi','Kuchli'].map(tr);
   bar.style.width=`${Math.max(8,score*20)}%`;
   bar.style.background=colors[Math.min(score,4)];
   lbl.textContent=l>0?labels[Math.min(score,4)]:'';
   lbl.style.color=colors[Math.min(score,4)];
  });
 }
 const phoneIn=modal.querySelector('[name="phone"]');
 if(phoneIn){
  phoneIn.addEventListener('input',()=>{
   let v=phoneIn.value.replace(/[^\d+]/g,'');
   if(/^\d{9}$/.test(v))v='+998'+v;
   else if(/^998\d{9}$/.test(v))v='+'+v;
   if(v==='+')v='+998';
   phoneIn.value=v;
  });
 }
}
async function accountSettings(){
 modalOpen(tr('Hisob sozlamalari'),'',`<div class="loading" role="status">${tr('Ma’lumotlar yuklanmoqda…')}</div>`);
 const loadingBody=modal.querySelector('.modal-body');
 try{const account=await api('/account');if(!modal.open||!loadingBody?.isConnected)return;state.accountDetails=account;renderAccountSettings(account);}
 catch(error){if(modal.open&&loadingBody?.isConnected)modalOpen(tr('Hisob sozlamalari'),'',`<div class="error-box" role="alert">${esc(tr(error.message))}</div><button class="btn outline" data-action="account-settings">${tr('Qayta urinib ko‘rish')}</button>`);}
}
function renderAccountSettings(account){
 const sms=account.stage2Enabled&&account.smsEnabled,tg=account.telegramEnabled;
 modalOpen(tr('Hisob sozlamalari'),tr('Hisobingiz xavfsizligi va xabarnoma kanallari.'),`
 <section class="account-settings-row"><div><h3>${tr('Parol')}</h3><p>${tr('Hisobingiz uchun kuchli va alohida parol ishlating.')}</p></div><button class="btn outline" data-action="password">${tr('Parolni o‘zgartirish')}</button></section>
 <section class="account-settings-row"><div><h3>${tr('Telefon raqami')}</h3><p>${esc(state.user.phone||'—')}</p><span class="pill ${account.phoneVerified?'green':'amber'}">${tr(account.phoneVerified?'Tasdiqlangan':'Tasdiqlanmagan')}</span><p>${tr(sms?'Telefoningizni SMS kodi bilan tasdiqlashingiz mumkin.':'SMS orqali tasdiqlash hali yoqilmagan. SMS yuborilmaydi.')}</p></div>${sms&&!account.phoneVerified?`<button class="btn outline" data-action="phone-verify-request">${tr('Telefonni tasdiqlash')}</button>`:''}</section>
 <section class="account-settings-row"><div><h3>Telegram</h3><span class="pill ${account.telegramConnected?'green':'amber'}">${tr(account.telegramConnected?'Bog‘langan':'Bog‘lanmagan')}</span><p>${pageLabel(tg?'Telegramni bog‘lab, parolingizni bot orqali tiklashingiz mumkin.':'Telegram xabarnomalari hali yoqilmagan. Xabar yuborilmaydi.',tg?'Telegramни боғлаб, паролингизни бот орқали тиклашингиз мумкин.':'Telegram хабарномалари ҳали ёқилмаган. Хабар юборилмайди.')}</p></div>${tg?`<button class="btn outline" data-action="${account.telegramConnected?'telegram-unlink':'telegram-link'}">${tr(account.telegramConnected?'Bog‘lanishni uzish':'Telegramni bog‘lash')}</button>`:''}</section>`);
}
async function requestPhoneVerification(button){
 if(!state.accountDetails?.stage2Enabled||!state.accountDetails?.smsEnabled)return;
 button.disabled=true;
 try{const {challenge}=await api('/auth/phone/request',{});if(!button.isConnected)return;
  modalOpen(tr('Telefonni tasdiqlash'),tr('Telefoningizga kelgan tasdiqlash kodini kiriting.'),`<form id="phone-verify-form" data-challenge="${esc(challenge)}">${formError}${field('code',tr('Tasdiqlash kodi'),'text','','required inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="6" pattern="[0-9]{6}"')}<div class="form-actions"><button class="btn" type="submit">${tr('Tasdiqlash')}</button></div></form>`);
 }finally{if(button.isConnected)button.disabled=false;}
}
async function linkTelegram(button){
 if(!state.accountDetails?.telegramEnabled)return;
 button.disabled=true;
 try{const {url}=await api('/account/telegram/link',{});if(!button.isConnected)return;
  const target=new URL(url);if(target.protocol!=='https:'||!['t.me','telegram.me'].includes(target.hostname))throw new Error(tr('Bog‘lanish havolasini ochib bo‘lmadi.'));
  modalOpen(tr('Telegramni bog‘lash'),tr('Havolani oching va botda bog‘lanishni tasdiqlang. So‘ng bu oynaga qayting.'),`<a class="btn" href="${esc(target.href)}" target="_blank" rel="noopener noreferrer">${tr('Telegramda ochish')} ${icon('arrow')}</a><div class="form-actions"><button class="btn outline" data-action="account-settings">${tr('Bog‘lanishni tekshirish')}</button></div>`);
 }finally{if(button.isConnected)button.disabled=false;}
}
function staffBlockDialog(id){
 if(!state.authOptions?.stage2Enabled)return;
 const user=state.teamUsers?.find(u=>String(u.id)===String(id));if(!user||user.id===state.user.id||user.role==='director')throw new Error(tr('Bu amal uchun ruxsat yo‘q.'));
 modalOpen(tr(user.blocked?'Hisobni faollashtirish':'Hisobni vaqtincha bloklash'),'',`<form id="staff-block-form" data-user="${Number(user.id)}" data-blocked="${user.blocked?'false':'true'}">${formError}<p>${esc(user.name)}</p><div class="notice">${tr(user.blocked?'Xodim hisobiga kirish yana ochiladi.':'Xodim hisobiga kirish to‘xtatiladi va uning faol sessiyalari tugatiladi.')}</div>${field('currentPassword',tr('Joriy parolingiz'),'password','','required autocomplete="current-password" maxlength="72"')}<label class="check-label"><input type="checkbox" required><span>${tr('Tanlangan hisob uchun bu o‘zgarishni tasdiqlayman.')}</span></label><div class="form-actions"><button class="btn" type="submit">${tr('Tasdiqlash')}</button></div></form>`);
}
function passwordDialog(userId=''){
 modalOpen(tr(userId?'Xodim parolini yangilash':'Parolni o‘zgartirish'),tr('Tasdiqlash uchun o‘z hisobingizning joriy parolini kiriting.'),`<form id="password-form" data-user="${esc(userId)}">${formError}${field('currentPassword',tr('Joriy parolingiz'),'password','','required autocomplete="current-password" maxlength="72"')}${field('password',tr('Yangi parol'),'password','','required minlength="10" maxlength="72" autocomplete="new-password"')}${field('confirmPassword',tr('Yangi parolni takrorlang'),'password','','required minlength="10" maxlength="72" autocomplete="new-password"')}<p class="field-help">${tr('Parol 10–72 belgidan iborat bo‘lsin. Yangilanganda oldingi sessiyalar tugatiladi.')}</p><div class="form-actions"><button class="btn" type="submit">${tr('Parolni saqlash')}</button></div></form>`);
}
async function recoveryDialog(){
 modalOpen(tr('Parolni tiklash'),'',`<div class="loading" role="status">${tr('Ma’lumotlar yuklanmoqda…')}</div>`);
 const loadingBody=modal.querySelector('.modal-body');
 let auth;try{auth=await api('/auth/options');}catch(error){if(modal.open&&loadingBody?.isConnected)modalOpen(tr('Parolni tiklash'),'',`<div class="error-box" role="alert">${esc(tr(error.message))}</div><button class="btn outline" data-action="recovery">${tr('Qayta urinib ko‘rish')}</button>`);return;}if(!modal.open||!loadingBody?.isConnected)return;
 if(!auth.smsEnabled&&!auth.telegramEnabled){modalOpen(tr('Parolni tiklash'),'',`<div class="notice">${pageLabel('Avtomatik parol tiklash hali yoqilmagan. Xodim hisobini rahbar tiklashi mumkin.','Автоматик парол тиклаш ҳали ёқилмаган. Ходим ҳисобини раҳбар тиклаши мумкин.')}</div><button class="btn outline" data-action="login">${tr('Kirishga qaytish')}</button>`);return;}
 const channels=[...(auth.telegramEnabled?[{id:'telegram',name:'Telegram'}]:[]),...(auth.smsEnabled?[{id:'sms',name:'SMS'}]:[])];
 modalOpen(tr('Parolni tiklash'),pageLabel('Hisobingizning logini yoki telefon raqamini kiriting.','Ҳисобингизнинг логини ёки телефон рақамини киритинг.'),`<form id="recovery-request-form">${formError}${channels.length>1?selectField('channel',pageLabel('Kodni qayerga yuboramiz?','Кодни қаерга юборамиз?'),options(channels,'telegram')):`<input type="hidden" name="channel" value="${channels[0].id}">`}${field('login',pageLabel('Login yoki telefon raqami','Логин ёки телефон рақами'),'text','','required maxlength="100" autocomplete="username" autocapitalize="none"')}${auth.telegramEnabled?`<div class="notice">${pageLabel('Telegram bog‘langan bo‘lsa, kod botga keladi. Bog‘lanmagan mijoz hisobi uchun keyingi oynada botga o‘tib o‘z telefon raqamingizni tasdiqlang. Xodim va rahbar hisoblariga Telegram oldindan bog‘langan bo‘lishi kerak.','Telegram боғланган бўлса, код ботга келади. Боғланмаган мижоз ҳисоби учун кейинги ойнада ботга ўтиб ўз телефон рақамингизни тасдиқланг. Ходим ва раҳбар ҳисобларига Telegram олдиндан боғланган бўлиши керак.')}</div>`:''}${auth.smsEnabled?`<p class="small-text muted">${pageLabel('SMS uchun oldindan tasdiqlangan telefon raqamingizni kiriting.','SMS учун олдиндан тасдиқланган телефон рақамингизни киритинг.')}</p>`:''}<div class="form-actions"><button class="btn" type="submit">${tr('Tasdiqlash kodini so‘rash')}</button></div></form>`);
}
function privacyDialog() {
 const isCyr=state.script==='cyr';
 modalOpen(isCyr?'Махфийлик ва розилик':'Maxfiylik va rozilik',isCyr?'Маълумотларингиз қандай ишлатилишини билишингиз муҳим.':'Ma’lumotlaringiz qanday ishlatilishini bilishingiz muhim.',`<div class="legal-copy"><h3>${isCyr?'Қайси маълумотлар олинади?':'Qaysi ma’lumotlar olinadi?'}</h3><p>${isCyr?'Дастлаб исм, телефон рақами ва вазиятингизнинг қисқача баёни сўралади. Танланган хизмат йўналиши ва Қарши учун Қашқадарё ҳудуди мурожаатга автоматик бириктирилади. Қолган зарур маълумотларни координатор сиз билан келишиб аниқлаштиради. Кабинет яратилганда кириш маълумотлари ҳам сақланади.':'Dastlab ism, telefon raqami va vaziyatingizning qisqacha bayoni so‘raladi. Tanlangan xizmat yo‘nalishi va Qarshi uchun Qashqadaryo hududi murojaatga avtomatik biriktiriladi. Qolgan zarur ma’lumotlarni koordinator siz bilan kelishib aniqlashtiradi. Kabinet yaratilganda kirish ma’lumotlari ham saqlanadi.'}</p><h3>${isCyr?'Нима учун ишлатилади?':'Nima uchun ishlatiladi?'}</h3><p>${isCyr?'Мурожаатни кўриб чиқиш, сиз билан боғланиш, хизматни ташкил этиш ва натижани кузатиш учун. Хизматни бажарувчи ҳамкорга фақат унга бириктирилган иш учун зарур маълумотлар тақдим этилади. Координаторнинг ички қайдлари оммавий кўрсатилмайди.':'Murojaatni ko‘rib chiqish, siz bilan bog‘lanish, xizmatni tashkil etish va natijani kuzatish uchun. Xizmatni bajaruvchi hamkorga faqat unga biriktirilgan ish uchun zarur ma’lumotlar taqdim etiladi. Koordinatorning ichki qaydlari ommaviy ko‘rsatilmaydi.'}</p><h3>${isCyr?'Мурожаатга кириш':'Murojaatga kirish'}</h3><p>${isCyr?'Мурожаат рақами ва махфий калит унинг тафсилотларига кириш имконини беради. Калитни парол каби ҳимояланг. Кабинетда фақат ҳисобингизга боғланган мурожаатларни кўрасиз.':'Murojaat raqami va maxfiy kalit uning tafsilotlariga kirish imkonini beradi. Kalitni parol kabi himoyalang. Kabinetda faqat hisobingizga bog‘langan murojaatlarni ko‘rasiz.'}</p><h3>${isCyr?'Сизнинг танловингиз':'Sizning tanlovingiz'}</h3><p>${isCyr?'Кераксиз махфий ҳужжатлар, банк картаси реквизитлари ва паролларни юборманг. Маълумотларни тузатиш, розиликни қайтариб олиш ёки ўчириш бўйича мурожаатни координаторга етказишингиз мумкин; бунинг учун янги мурожаатда рақамингизни кўрсатинг.':'Keraksiz maxfiy hujjatlar, bank kartasi rekvizitlari va parollarni yubormang. Ma’lumotlarni tuzatish, rozilikni qaytarib olish yoki o‘chirish bo‘yicha murojaatni koordinatorga yetkazishingiz mumkin; buning uchun yangi murojaatda raqamingizni ko‘rsating.'}</p><h3>${isCyr?'Хизмат шартлари':'Xizmat shartlari'}</h3><p>${isCyr?'ZARURIYAT давлат хизмати ёки шошилинч ёрдам ўрнини босмайди. Ҳамкор, нарх, вақт ва хизмат ҳажми бажаришдан олдин сиз билан алоҳида келишилади.':'Zaruriyat davlat xizmati yoki shoshilinch yordam o‘rnini bosmaydi. Hamkor, narx, vaqt va xizmat hajmi bajarishdan oldin siz bilan alohida kelishiladi.'}</p></div>`);
}

function feedbackForm(c,token) {
 if(c.feedback) return `<div class="notice">${pageLabel('Sizning bahoyingiz','Сизнинг баҳойингиз')}: <strong>${esc(c.feedback.rating)} / 5</strong>${c.feedback.comment?`<p>${esc(c.feedback.comment)}</p>`:''}</div>`;
 if(c.status!=='completed'||!token)return '';
 return `<section class="detail-section"><h3>${tr("Xizmatdan mamnun bo‘ldingizmi?")}</h3><form id="feedback-form" data-number="${esc(c.number)}" data-token="${esc(token)}">${formError}<div class="field"><label>${tr("Baho bering: 1 — past, 5 — a’lo")}</label><div class="stars" role="radiogroup" aria-label="Xizmat bahosi">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}" required aria-label="${n} ball"><span>${n}</span></label>`).join('')}</div></div><div style="margin-top:15px">${textareaField('comment','Fikringiz · ixtiyoriy','','maxlength="2000" placeholder="Nimani yaxshilashimiz mumkin?"')}</div><div class="form-actions"><button type="submit" class="btn small">${tr("Bahoni yuborish")}</button></div></form></section>`;
}
function historyMessage(h){
 if(h.kind==='status')return tr(statusNames[h.message]||h.message);
 if(['assignment','clarification','package'].includes(h.kind))return tr(h.message);
 if(h.kind==='deadline'&&String(h.message).startsWith('Nazorat muddati yangilandi: ')){
  const value=String(h.message).slice('Nazorat muddati yangilandi: '.length);
  return pageLabel('Nazorat muddati yangilandi','Назорат муддати янгиланди')+': '+(value==='-'?tr('Belgilanmagan'):date(value,true));
 }
 if(h.kind!=='service')return h.message;
 return String(h.message).replace(/: (pending|accepted|contacted|delivered|completed|cancelled)$/,(_,status)=>': '+tr(serviceNames[status]));
}

function timeline(c){return `<ul class="timeline">${(c.history||[]).map(h=>`<li><div><p>${esc(historyMessage(h))}</p><small>${date(h.createdAt,true)}${h.actorName?` · ${esc(h.actorName)}`:''}</small></div></li>`).join('')||`<li><div><p>${tr("Murojaat qabul qilindi")}</p><small>`+date(c.createdAt,true)+'</small></div></li>'}</ul>`;}
const fileUrls = new Set();
function releaseFileUrls(){for(const url of fileUrls)URL.revokeObjectURL(url);fileUrls.clear();}
function attachmentButton(file,number='',token=''){
 const audio=file.type?.startsWith('audio/');
 return `<div class="attachment-item"><button class="btn outline small" data-action="file" data-id="${Number(file.id)}" data-number="${esc(number)}" data-token="${esc(token||'')}" data-audio="${audio?'1':'0'}">${icon(audio?'mic':'download')} ${esc(file.name)} <small>(${Math.max(1,Math.round((file.size||0)/1024))} KB)</small></button></div>`;
}
async function openAttachment(button){
 button.disabled=true;
 try{
  const {file}=await api(`/files/${Number(button.dataset.id)}`,button.dataset.token?{number:button.dataset.number,token:button.dataset.token}:undefined);
  if(!button.isConnected)return;
  if(!file?.data)throw new Error('Faylni yuklab bo‘lmadi.');
  const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:file.type||'application/octet-stream'}));fileUrls.add(url);
  if(button.dataset.audio==='1'){
   const item=button.closest('.attachment-item');let player=item.querySelector('audio');
   if(!player){player=document.createElement('audio');player.controls=true;player.preload='metadata';item.append(player);}player.src=url;
  }else{const link=document.createElement('a');link.href=url;link.download=file.name||'fayl';link.click();}
 }finally{button.disabled=false;}
}
function caseReadOnly(c,token='') {
 const activeIndex=state.config.statuses.indexOf(c.status);
  const attachHtml = c.attachments?.length ? `<section class="detail-section"><h3>${tr("Biriktirilgan fayllar")}</h3><div class="file-list">${c.attachments.map(f=>attachmentButton(f,c.number,token)).join('')}</div></section>` : '';
  return `<div class="detail-heading"><h3>${esc(c.number)}</h3>${badge(c.status)}</div><div class="case-progress" role="group" aria-label="Murojaat holati: ${esc(statusNames[c.status])}">${state.config.statuses.filter(s=>s!=='cancelled').map((s,i)=>`<span class="${i<=activeIndex&&c.status!=='cancelled'?'done':''}" title="${esc(statusNames[s])}"></span>`).join('')}</div><dl class="detail-grid"><div><dt>${tr("Xizmat yo‘nalishi")}</dt><dd>${esc(category(c.category))}</dd></div><div><dt>${tr("Murojaat sanasi")}</dt><dd>${date(c.createdAt,true)}</dd></div><div><dt>${tr("Hudud")}</dt><dd>${esc(c.region||tr("Ko‘rsatilmagan"))}</dd></div><div><dt>${tr("Koordinator")}</dt><dd>${esc(c.coordinatorName||'Biriktirilmoqda')}</dd></div>${c.dueAt?`<div><dt>${tr("Rejalashtirilgan muddat")}</dt><dd>${date(c.dueAt,true)}</dd></div>`:''}</dl><div class="description">${esc(c.description)}</div>${c.services?.length?`<section class="detail-section"><h3>${tr("Murojaat tarkibidagi xizmatlar")}</h3>${c.services.map(s=>`<div class="service-row"><div class="service-row-head"><b>${esc(s.title)}</b>${badge(s.status,true)}</div><p>${esc(s.partnerName||'Hamkor biriktirilmoqda')}${Number(s.price)?` · ${money(s.price)}`:''}</p></div>`).join('')}</section>`:`<div class="notice">${tr("Koordinator ehtiyojingizni aniqlagach, kerakli xizmatlar shu yerda ko‘rinadi.")}</div>`}${attachHtml}<section class="detail-section"><h3>${tr("Jarayon tarixi")}</h3>${timeline(c)}</section>${feedbackForm(c,token)}`;
}
const mobileViewport=()=>matchMedia('(max-width: 820px)').matches;
const pageLabel=(lat,cyr)=>state.script==='cyr'?cyr:lat;
function captureVisibleForms(){return Array.from(document.querySelectorAll('form')).filter(f=>f.closest('dialog')?.open||!f.closest('dialog')).map(f=>({id:f.id,index:Array.from(document.querySelectorAll('form')).indexOf(f),registration:f.id==='register-form'&&f.dataset.verification?{challenge:f.dataset.verification,phone:f.dataset.verificationPhone,url:f.dataset.verificationUrl}:null,controls:Array.from(f.elements).filter(el=>el.name).map(el=>({name:el.name,type:el.type,value:el.value,checked:el.checked,files:el.type==='file'?Array.from(el.files):null}))}));}
function restoreVisibleForms(drafts){for(const draft of drafts){const form=draft.id?document.getElementById(draft.id):document.querySelectorAll('form')[draft.index];if(!form)continue;for(const item of draft.controls){const el=Array.from(form.elements).find(el=>el.name===item.name&&(item.type!=='radio'||el.value===item.value));if(!el)continue;if(item.type==='file'){try{const transfer=new DataTransfer();item.files.forEach(f=>transfer.items.add(f));el.files=transfer.files;}catch{}}else if(['checkbox','radio'].includes(item.type))el.checked=item.checked;else el.value=item.value;}if(draft.id==='user-create-form'){const role=form.elements.role,partner=form.elements.partnerId;if(role&&partner){partner.disabled=role.value!=='partner';partner.required=role.value==='partner';}}if(draft.registration)registrationVerification(form,draft.registration);}}
let presentationDraft=null;
async function refreshPresentation(){const hash=location.hash,submission=modal.open&&state.lastSubmission?state.lastSubmission:null,tracked=modal.open&&$('#track-form')?state.lastTrack:null;const draft=presentationDraft||captureVisibleForms();presentationDraft=draft;await renderRoute();if(location.hash===hash){if(submission)successDialog(submission);if(tracked&&$('#tracking-result')){$('#tracking-result').innerHTML=`<div class="divider"></div>${caseReadOnly(tracked.case,tracked.token)}`;state.lastTrack=tracked;}restoreVisibleForms(draft);}if(presentationDraft===draft)presentationDraft=null;}
function isMobileFormRoute(){return /^(request|track|login|register|privacy|recovery|service|checkout|cabinet\/(settings|password|case|partner-new|partner-edit|user-new|user-edit|client-edit|package-new|package-edit|package-use|subscription-use|staff-password|staff-block))($|\?)/.test(location.hash.slice(1));}
function promoteMobileDialog(){if(!mobileViewport())return;modal.querySelectorAll('.modal-body h3').forEach(heading=>{const replacement=document.createElement('h2');Array.from(heading.attributes).forEach(attr=>replacement.setAttribute(attr.name,attr.value));replacement.innerHTML=heading.innerHTML;heading.replaceWith(replacement);});const title=$('#modal-title')?.textContent||pageLabel('ZARURIYAT','ZARURIYAT');if(!modal.classList.contains('mobile-route-page'))modal.close();modal.classList.add('mobile-route-page');document.body.classList.add('mobile-page-open');const header=$('.mobile-page-header',modal);if(!header)modal.insertAdjacentHTML('afterbegin',mobileHeader(title));else if($('h1',header).textContent!==title)$('h1',header).textContent=title;modal.setAttribute('open','');modal.removeAttribute('aria-modal');modal.removeAttribute('role');if(!$('.mobile-bottom-bar',modal))modal.insertAdjacentHTML('beforeend',mobileBottomNav());}
function mobileBack(){
 if(history.state?.zarFrom&&history.state.zarFrom!==location.hash){history.back();return;}
 const path=location.hash.slice(1).split('?')[0];
 const parent=path==='service'?'services'
  :path.startsWith('cabinet/package')||path==='cabinet/subscription-use'?'cabinet/packages'
  :path==='cabinet/case'?'cabinet/cases'
  :path.startsWith('cabinet/partner-')?'cabinet/partners'
  :path==='cabinet/client-edit'?'cabinet/clients'
  :/^cabinet\/(user-new|user-edit|staff-)/.test(path)?'cabinet/team'
  :path.startsWith('cabinet/')?'cabinet/menu':'home';
 // A direct link has no in-app predecessor. Replace it so Back cannot loop.
 history.replaceState({...history.state,zarEntry:true,zarFrom:null},'',`#${parent===path?'home':parent}`);
 renderRoute();
}
function finishPage(){document.body.classList.remove('route-loading');window.scrollTo(0,0);document.documentElement.lang=state.script==='cyr'?'uz-Cyrl':'uz';const heading=modal.open?(document.body.classList.contains('mobile-page-open')?$('.mobile-page-header h1',modal):$('#modal-title',modal)):$('h1',app);if(heading){document.title=`${(heading.innerText||heading.textContent).replace(/\s+/g,' ').trim()} · ZARURIYAT`;heading.tabIndex=-1;heading.focus({preventScroll:true});}document.querySelectorAll('.mobile-bottom-bar .mb-item').forEach(a=>{const route=location.hash.slice(1).split('?')[0];const target=a.hash?.slice(1)||({request:'request',track:'track',login:'login',menu:'cabinet/menu',cabinet:'cabinet/overview'}[a.dataset.action]);const active=target===route||(target==='services'&&route==='service')||(target==='cabinet/cases'&&route==='cabinet/case')||(target==='cabinet/menu'&&['cabinet/settings','cabinet/password','cabinet/partners','cabinet/partner-edit','cabinet/user-edit','cabinet/client-edit','cabinet/clients','cabinet/team','cabinet/package-new','cabinet/package-edit','cabinet/user-new','cabinet/partner-new','cabinet/staff-password','cabinet/staff-block'].includes(route))||(target==='menu'&&['how','family','faq','privacy','login','register','recovery'].includes(route));a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function mobileHeader(title){return `<div class="mobile-page-header"><button class="icon-btn" data-action="page-back" aria-label="${pageLabel('Orqaga','Орқага')}">${icon('arrow')}</button><h1>${esc(title)}</h1><span class="mobile-header-spacer" aria-hidden="true"></span></div>`;}
function mobileBottomNav(context='auto') {
 const path=location.hash.slice(1).split('?')[0]||'home';
 if(context==='auto')context=path.startsWith('cabinet/')||(state.user&&['request','checkout','track'].includes(path))?'cabinet':'public';
 const cabinet=context==='cabinet'&&state.user;
 const navItems=cabinet?state.user.role==='partner'?[['cabinet/overview','home','Asosiy','Асосий'],['cabinet/cases','file','Xizmatlar','Хизматлар'],['cabinet/menu','menu','Menyu','Меню']]:staff()?[['cabinet/overview','chart','Umumiy','Умумий'],['cabinet/cases','file','Murojaatlar','Мурожаатлар'],['request','plus','Yangi','Янги'],['cabinet/notifications','bell','Xabarlar','Хабарлар'],['cabinet/menu','menu','Menyu','Меню']]:[['cabinet/overview','home','Asosiy','Асосий'],['cabinet/cases','file','Murojaatlar','Мурожаатлар'],['request','plus','Yangi','Янги'],['cabinet/packages','users','Oila','Оила'],['cabinet/menu','menu','Menyu','Меню']]:[['home','home','Asosiy','Асосий'],['services','layers','Xizmatlar','Хизматлар'],['request','plus','Murojaat','Мурожаат'],['track','clock','Kuzatish','Кузатиш'],['menu','menu','Menyu','Меню']];
 return `<nav class="mobile-bottom-bar ${cabinet?'workspace-bottom-bar':''}" data-context="${cabinet?'cabinet':'public'}" aria-label="${pageLabel(cabinet?'Kabinet navigatsiyasi':'Asosiy navigatsiya',cabinet?'Кабинет навигацияси':'Асосий навигация')}">${navItems.map(([target,ico,lat,cyr])=>`<a href="#${target}" class="mb-item ${target==='request'?'mb-action':''}" data-nav-section="${target}">${target==='request'?`<span class="mb-action-circle">${icon(ico)}</span>`:icon(ico)}<span>${esc(pageLabel(lat,cyr))}</span>${cabinet&&target==='cabinet/notifications'&&state.notificationUnread?`<span class="notification-badge" aria-label="${state.notificationUnread} ${pageLabel('yangi xabar','янги хабар')}">${state.notificationUnread>99?'99+':state.notificationUnread}</span>`:''}</a>`).join('')}</nav>`;
}
function menuRow(url,label,ico,description='',action='') {
 const attrs=action?`data-action="${action}"`:`href="${esc(url)}"`;
 const tag=action?'button':'a';
 return `<${tag} ${attrs} class="app-menu-row"><span class="menu-row-icon">${icon(ico)}</span><span class="menu-row-copy"><b>${esc(label)}</b>${description?`<small>${esc(description)}</small>`:''}</span>${icon('arrow')}</${tag}>`;
}
function menuSection(title,rows) {return `<section class="mobile-menu-group"><h2>${esc(title)}</h2><nav class="app-menu-list">${rows}</nav></section>`;}
function mobileMenu(cabinet=false) {
 const desc=id=>{
  if(cabinet&&!staff()&&id==='cases')return pageLabel(state.user.role==='partner'?'Sizga biriktirilgan xizmatlar va natijalar':'Murojaatlaringiz holati va natijasi',state.user.role==='partner'?'Сизга бириктирилган хизматлар ва натижалар':'Мурожаатларингиз ҳолати ва натижаси');
  if(cabinet&&!staff()&&id==='overview')return pageLabel('Hisobingiz va faol xizmatlar','Ҳисобингиз ва фаол хизматлар');
  return pageLabel(...(mobileSectionDescriptions[id]||['','']));
 };
 const sectionRow=(url,label,ico,id)=>menuRow(url,label,ico,desc(id));
 let groups='';
 if(cabinet){
  const items=Array.from(document.querySelectorAll('.side-nav a')).map(a=>({url:a.hash,id:a.hash.split('/').pop(),label:a.textContent.trim()}));
  const icons={overview:'chart',cases:'file',notifications:'bell',partners:'briefcase',clients:'users',packages:'home',team:'users'};
  const rows=ids=>items.filter(item=>ids.includes(item.id)).map(item=>sectionRow(item.url,item.label,icons[item.id],item.id)).join('');
  groups=menuSection(pageLabel(staff()?'Ish jarayoni':'Mening xizmatlarim',staff()?'Иш жараёни':'Менинг хизматларим'),rows(['overview','cases','notifications']));
  const directory=rows(['partners','clients','packages','team']);
  if(directory)groups+=menuSection(pageLabel(staff()?'Markaz ma’lumotlari':'Oila uchun',staff()?'Марказ маълумотлари':'Оила учун'),directory);
 }else{
  groups=menuSection(pageLabel('Yordam va xizmatlar','Ёрдам ва хизматлар'),sectionRow('#services',pageLabel('Xizmatlarni tanlash','Хизматларни танлаш'),'layers','services')+sectionRow('#request',pageLabel('Murojaat qoldirish','Мурожаат қолдириш'),'plus','request')+sectionRow('#track',pageLabel('Murojaatni kuzatish','Мурожаатни кузатиш'),'clock','track'));
  groups+=menuSection(pageLabel('Markaz haqida','Марказ ҳақида'),sectionRow('#family',pageLabel('Oila paketlari','Оила пакетлари'),'users','family')+sectionRow('#how',pageLabel('Qanday ishlaydi','Қандай ишлайди'),'shield','how')+sectionRow('#faq',pageLabel('Savollar va javoblar','Саволлар ва жавоблар'),'message','faq'));
 }
 const accountRows=(cabinet?sectionRow('#cabinet/settings',pageLabel('Hisob sozlamalari','Ҳисоб созламалари'),'shield','settings')+sectionRow('#home',pageLabel('Markazning bosh sahifasi','Марказнинг бош саҳифаси'),'home','home'):sectionRow(state.user?'#cabinet/overview':'#login',pageLabel(state.user?'Mening kabinetim':'Kabinetga kirish',state.user?'Менинг кабинетим':'Кабинетга кириш'),'user','login'))+sectionRow('#privacy',pageLabel('Maxfiylik va rozilik','Махфийлик ва розилик'),'shield','privacy')+menuRow('',pageLabel('Alifboni o‘zgartirish','Алифбони ўзгартириш'),'message',state.script==='cyr'?'O‘zb (Lotin)':'Ўзб (Кирилл)','toggle-script')+(cabinet?menuRow('',pageLabel('Hisobdan chiqish','Ҳисобдан чиқиш'),'logout',pageLabel('Sessiyani yakunlash','Сессияни якунлаш'),'logout'):'');
 groups+=menuSection(pageLabel('Hisob va sozlamalar','Ҳисоб ва созламалар'),accountRows);
 return `${cabinet?`<h1 class="mobile-menu-page-title">${pageLabel('Menyu','Меню')}</h1>`:''}<div class="mobile-menu-intro"><span class="menu-profile-icon">${icon(cabinet?'user':'home')}</span><div><p>${esc(cabinet?tr(roleNames[state.user.role]):pageLabel('Qarshidagi markaz','Қаршидаги марказ'))}</p><h2>${esc(cabinet?state.user.name:'ZARURIYAT CENTER')}</h2></div></div>${groups}${cabinet?'':`<section class="mobile-menu-contact">${publicContacts()}</section>`}`;
}
function groupedMobileServices() {
 return `<div class="mobile-service-intro"><p>${pageLabel('Kerakli xizmatni tanlang. Koordinator keyingi qadamni siz bilan kelishadi.','Керакли хизматни танланг. Координатор кейинги қадамни сиз билан келишади.')}</p></div>${mobileCategoryGroups.map(group=>`<section class="mobile-service-group"><header><h2>${pageLabel(...group.title)}</h2><p>${pageLabel(...group.hint)}</p></header><div class="mobile-category-list">${group.ids.map(id=>state.config.categories.find(c=>c.id===id)).filter(Boolean).map(c=>`<button class="service-tile ${c.id==='other'?'other':''}" data-action="service-detail" data-category="${esc(c.id)}"><span class="tile-icon-wrap">${icon(categoryIcons[c.id])}</span><span class="tile-info"><span class="tile-title">${esc(tr(c.name))}</span><span class="tile-sub">${esc(serviceCopy(c.id))}</span></span>${icon('arrow','arrow')}</button>`).join('')}</div></section>`).join('')}`;
}
function renderPublicSection(){const name=location.hash.slice(1).split('?')[0]||'home';if(['services','how','family','faq'].includes(name)){const section=document.getElementById(name);const content=section?.outerHTML||'';const main=$('main',app);main.innerHTML=`${mobileHeader(pageLabel({services:'Xizmatlar',how:'Qanday ishlaydi',family:'Oila uchun',faq:'Savollar va javoblar'}[name],{services:'Хизматлар',how:'Қандай ишлайди',family:'Оила учун',faq:'Саволлар ва жавоблар'}[name]))}<div class="container dedicated-section">${content}</div>`;app.dataset.page=name;}else if(name==='menu'){const main=$('main',app);main.innerHTML=`${mobileHeader(pageLabel('Menyu','Меню'))}<div class="container dedicated-section">${mobileMenu()}</div>`;app.dataset.page='menu';}else{app.dataset.page='home';if(mobileViewport()){const title=$('.hero h1',app),intro=$('.hero-copy>p',app);if(title)title.innerHTML=pageLabel('Qarshida oilangiz uchun<br><em>kerakli yordam.</em>','Қаршида оилангиз учун<br><em>керакли ёрдам.</em>');if(intro)intro.textContent=pageLabel('Qarshida kerakli mutaxassis va yordamni shaxsiy koordinator bilan tashkil qiling.','Қаршида керакли мутахассис ва ёрдамни шахсий координатор билан ташкил қилинг.');}$('.hero',app)?.insertAdjacentHTML('afterend',`<section class="mobile-home-shortcuts"><h2>${pageLabel('Tezkor bo‘limlar','Тезкор бўлимлар')}</h2><nav class="app-menu-list home-shortcut-grid"><a href="#services">${icon('layers')}<span>${pageLabel('Barcha xizmatlar','Барча хизматлар')}<small>${pageLabel('Ehtiyojingizga mos yo‘nalish','Эҳтиёжингизга мос йўналиш')}</small></span>${icon('arrow')}</a><a href="#track">${icon('clock')}<span>${pageLabel('Murojaatni kuzatish','Мурожаатни кузатиш')}<small>${pageLabel('Jarayon va keyingi qadamlar','Жараён ва кейинги қадамлар')}</small></span>${icon('arrow')}</a><a href="#family">${icon('users')}<span>${pageLabel('Oilangiz uchun yordam','Оилангиз учун ёрдам')}<small>${pageLabel('Yaqinlaringizga g‘amxo‘rlik','Яқинларингизга ғамхўрлик')}</small></span>${icon('arrow')}</a><a href="#how">${icon('shield')}<span>${pageLabel('Qanday ishlaydi','Қандай ишлайди')}<small>${pageLabel('To‘rtta oddiy qadam','Тўртта оддий қадам')}</small></span>${icon('arrow')}</a></nav></section>`);}if(name==='services'){const section=$('#services',app);if(mobileViewport()&&section)section.innerHTML=groupedMobileServices();else document.querySelectorAll('.service-tile').forEach(a=>{a.dataset.action='service-detail';});}}
async function renderMobilePage(version){const raw=location.hash.slice(1),[path,query]=raw.split('?'),params=new URLSearchParams(query);const formPaths=['request','track','login','register','privacy','recovery','cabinet/settings','cabinet/password','cabinet/case','cabinet/partner-new','cabinet/partner-edit','cabinet/user-edit','cabinet/client-edit','cabinet/user-new','cabinet/package-new','cabinet/package-edit','cabinet/package-use','cabinet/subscription-use','cabinet/staff-password','cabinet/staff-block','service','checkout'];if(!formPaths.includes(path))return false;if(path.startsWith('cabinet/')&&!state.user){location.hash='login';return true;}if((['cabinet/user-edit','cabinet/client-edit','cabinet/user-new','cabinet/staff-password','cabinet/staff-block'].includes(path)&&state.user?.role!=='director')||(['cabinet/partner-edit','cabinet/partner-new','cabinet/package-new','cabinet/package-edit','cabinet/package-use','cabinet/subscription-use'].includes(path)&&!staff())){location.hash='cabinet/menu';return true;}document.body.classList.add('route-loading');if(path.startsWith('cabinet/'))workspaceShell(path.includes('package')?'packages':path.includes('partner')?'partners':path.includes('user')||path.includes('staff')?'team':path.includes('case')?'cases':path.includes('client')?'clients':'overview');else landing();try{if(['cabinet/partner-edit','cabinet/user-edit','cabinet/client-edit','cabinet/package-edit'].includes(path)&&!/^[1-9]\d*$/.test(params.get('id')||''))throw new Error(tr('Tahrirlash uchun yozuvni tanlang.'));if(path==='cabinet/subscription-use')await subscriptionUseDialog(params.get('id'));else if(path==='checkout')await checkoutDialog(params.get('package')||'COMFORT');else if(path==='request')requestDialog(params.get('category')||'',params.get('package')||'',params.get('special')==='1');else if(path==='track'){trackingDialog(state.trackingPrefill?.number||'',state.trackingPrefill?.token||'');state.trackingPrefill=null;}else if(path==='login'||path==='register')loginDialog(path==='register');else if(path==='privacy')privacyDialog();else if(path==='recovery')await recoveryDialog();else if(path==='cabinet/settings')await accountSettings();else if(path==='cabinet/password')passwordDialog();else if(path==='cabinet/staff-password')passwordDialog(params.get('id'));else if(path==='cabinet/staff-block'){const results=await Promise.all([api('/users'),api('/auth/options')]);if(version!==routeVersion)return true;state.teamUsers=results[0].users;state.authOptions=results[1];if(state.authOptions.stage2Enabled)staffBlockDialog(params.get('id'));else modalOpen(tr('Hisob sozlamalari'),'',`<div class="notice">${pageLabel('Bu imkoniyat hali yoqilmagan.','Бу имконият ҳали ёқилмаган.')}</div>`);}else if(path==='cabinet/case')await caseDialog(params.get('id'));else if(path==='cabinet/partner-new')await partnerDialog();else if(path==='cabinet/partner-edit')await partnerDialog(params.get('id'));else if(path==='cabinet/user-edit'||path==='cabinet/client-edit')await profileEditDialog(params.get('id'));else if(path==='cabinet/user-new'){state.partners=(await api('/partners')).partners;if(version!==routeVersion)return true;userDialog();}else if(path==='cabinet/package-new')await packageDialog(null,params.get('client'));else if(path==='cabinet/package-edit')await packageDialog(params.get('id'));else if(path==='cabinet/package-use'){state.packages=(await api('/packages')).packages;if(version!==routeVersion)return true;await packageUseDialog(params.get('id'));}else if(path==='service'){const c=state.config.categories.find(c=>c.id===params.get('category'));modalOpen(c?tr(c.name):pageLabel('Xizmat','Хизмат'),pageLabel('Qarshida xizmatni tashkil qilish','Қаршида хизматни ташкил қилиш'),`<div class="service-detail-icon">${icon('layers')}</div><h2>${esc(serviceCopy(c?.id))}</h2><p>${esc(serviceCopy(c?.id,'detail'))}</p>${publicContacts()}<div class="notice">${pageLabel('Hamkor yoki mutaxassis mavjudligi aniqlashtiriladi. Xizmat hajmi, narxi va muddati oldindan kelishiladi. Tashqi mutaxassislar haqi paketga kirmaydi va alohida to‘lanishi mumkin.','Ҳамкор ёки мутахассис мавжудлиги аниқлаштирилади. Хизмат ҳажми, нархи ва муддати олдиндан келишилади. Ташқи мутахассислар ҳақи пакетга кирмайди ва алоҳида тўланиши мумкин.')}</div><button class="btn" data-action="request" data-category="${esc(c?.id||'other')}">${pageLabel('Murojaat qoldirish','Мурожаат қолдириш')} ${icon('arrow')}</button>`);}if(version!==routeVersion){return true;}promoteMobileDialog();finishPage();}catch(error){if(version===routeVersion){document.body.classList.remove('route-loading');app.innerHTML=`${mobileHeader(pageLabel('Sahifa','Саҳифа'))}<main class="container dedicated-section"><div class="error-box">${esc(tr(error.message))}</div><button class="btn outline" data-action="refresh">${tr('Qayta yuklash')}</button></main>`;}}return true;}
function route(){const [prefix,view]=location.hash.slice(1).split('?')[0].split('/');return prefix==='cabinet'?(view||'overview'):null;}
 function workspaceShell(view) {
  app.dataset.page='workspace';
  const isCyr=state.script==='cyr';
  const menu=staff()?[
    ['overview','chart',isCyr?'Умумий кўриниш':'Umumiy ko‘rinish'],
    ['cases','file',isCyr?'Мурожаатлар':'Murojaatlar'],
    ['partners','briefcase',isCyr?'Ҳамкорлар':'Hamkorlar'],
    ['clients','users',isCyr?'Мижозлар':'Mijozlar'],
    ['packages','home',isCyr?'Оила пакетлари':'Oila paketlari'],
    ['notifications','bell',isCyr?'Хабарномалар':'Xabarnomalar'],
    ...(state.user.role==='director'?[['team','users',isCyr?'Ходимлар':'Xodimlar']]:[])
  ]:state.user.role==='partner'?[
    ['overview','chart',isCyr?'Умумий кўриниш':'Umumiy ko‘rinish'],
    ['cases','layers',isCyr?'Менинг хизматларим':'Mening xizmatlarim']
  ]:[
    ['overview','home',isCyr?'Менинг кабинетим':'Mening kabinetim'],
    ['cases','file',isCyr?'Мурожаатларим':'Murojaatlarim'],
    ['packages','users',isCyr?'Оила пакетим':'Oila paketim']
  ];
  const activeItem=menu.find(m=>m[0]===view)||menu[0];
 const title=view==='menu'?pageLabel('Menyu','Меню'):activeItem[2];
  const navLinks=menu.map(([id,ico,text])=>`<a href="#cabinet/${id}" class="${view===id?'active':''}" title="${esc(staff()&&sectionHelp[id]?pageLabel(...sectionHelp[id]):text)}">${icon(ico)}<span>${esc(text)}</span></a>`).join('');
  const wsBottomBar=mobileBottomNav('cabinet');
  app.innerHTML=`<div class="workspace"><div class="workspace-backdrop" data-action="menu" aria-label="Menyuni yopish"></div><aside class="sidebar"><div class="sidebar-top">${brand()}</div><nav class="sidebar-nav" aria-label="${isCyr?'Кабинет навигацияси':'Kabinet navigatsiyasi'}"><span class="sidebar-label">${esc(tr(roleNames[state.user.role]))} ${isCyr?'кабинети':'kabineti'}</span><div class="side-nav">${navLinks}</div></nav><div class="sidebar-bottom"><button class="script-toggle" data-action="toggle-script" title="Alifboni o‘zgartirish" style="margin-bottom:12px;width:100%;text-align:center">${state.script==='cyr'?'O‘zb (Lotin)':'Ўзб (Кирилл)'}</button><a href="#home">${icon('arrow')} ${isCyr?'Бош саҳифага қайтиш':'Bosh sahifaga qaytish'}</a></div></aside><div class="workspace-main"><header class="workspace-top"><div class="workspace-top-brand"><img class="brand-mark brand-logo" src="/images/zaruriyat-logo-192.png" alt="" width="30" height="30"><span class="workspace-brand-title">${esc(tr(title))}</span></div><div class="account"><span class="account-avatar">${esc(state.user.name.slice(0,2).toUpperCase())}</span><div class="account-meta"><div class="account-name">${esc(state.user.name)}</div><div class="account-role">${esc(tr(roleNames[state.user.role]))}</div></div><button class="icon-btn" data-action="account-settings" aria-label="${tr('Hisob sozlamalari')}" title="${tr('Hisob sozlamalari')}">${icon('shield')}</button><button class="icon-btn" data-action="logout" aria-label="${isCyr?'Ҳисобдан чиқиш':'Hisobdan chiqish'}" title="${isCyr?'Ҳисобдан чиқиш':'Hisobdan chiqish'}">${icon('logout')}</button></div></header><main id="main" class="workspace-content"><div class="loading" role="status">${isCyr?'Маълумотлар юкланмоқда…':'Ma’lumotlar yuklanmoqda…'}</div></main>${wsBottomBar}</div></div>`;
 }
async function renderRoute() {
 const version=++routeVersion,view=route();
 if(view==='notifications'){state.notificationUnread=0;updateNotificationBadges();}
 const requestedTab=new URLSearchParams(location.hash.split('?')[1]||'').get('tab')||'all';if(view==='cases'&&state.caseTabRoute!==location.hash&&['all','new','open','overdue','completed','cancelled'].includes(requestedTab))state.filters={search:'',status:'',category:'',overdue:false,tab:requestedTab};if(view==='cases')state.caseTabRoute=location.hash;
 document.body.classList.remove('route-loading');modal.close();document.body.classList.remove('mobile-page-open');modal.classList.remove('mobile-route-page');modal.removeAttribute('role');modal.removeAttribute('aria-modal');
 const formPage=renderMobilePage(version);
 if(await formPage||version!==routeVersion)return;
 if(!view){landing();renderPublicSection();finishPage();return;}
 if(!state.user){location.hash='login';return;}
 workspaceShell(view);
 updateNotificationBadges();
 if(view==='menu'){ $('#main').innerHTML=mobileMenu(true);finishPage();return; }
 if(view==='settings'&&state.user.role==='partner'){await accountSettings();return;}
 try {
  state.caseOffset=0;state.casesHasMore=false;
  clearTimeout(caseSearchTimer);caseSearchGeneration++;
  const all={};if(view==='cases'||view==='overview')all.cases=view==='cases'?caseQuery(0):'/cases?offset=0';
  if(staff()){
    if(view==='overview')all.stats='/stats';
    if(['partners','cases'].includes(view))all.partners='/partners';
    if(['clients','packages'].includes(view)){all.clients='/clients';all.packages='/packages';}
    if(view==='notifications'){all.notifications='/notifications';all.authOptions='/auth/options';}
    if(view==='team'&&state.user.role==='director'){all.teamUsers='/users';all.partners='/partners';all.authOptions='/auth/options';}
  }
  if(view==='packages'||(view==='overview'&&state.user.role==='client'))all.packages='/packages';
  if(view==='packages'&&state.user.role!=='partner')all.paymentData='/payments';
  const results=await Promise.all(Object.entries(all).map(async([key,path])=>[key,await api(path)]));if(version!==routeVersion)return;
  results.forEach(([key,result])=>state[key]=key==='stats'?(result.stats||result):key==='teamUsers'?(result.users||[]):['authOptions','paymentData'].includes(key)?result:result[key]);
  if(view==='notifications')syncNotifications(state.notifications);
  const casePage=results.find(([key])=>key==='cases')?.[1];state.caseOffset=state.cases.length;state.casesHasMore=!!casePage?.hasMore;
  let html;
  if(view==='overview')html=staff()?staffOverview():personalOverview();
  else if(view==='cases')html=casesPage();
  else if(view==='partners'&&staff())html=partnersPage();
  else if(view==='clients'&&staff())html=clientsPage();
  else if(view==='packages'&&state.user.role!=='partner')html=packagesPage();
  else if(view==='notifications'&&staff())html=notificationsPage();
  else if(view==='team'&&state.user.role==='director')html=teamPage();
  else html=empty('Bu bo‘lim mavjud emas','Menyudan o‘zingizga kerakli bo‘limni tanlang.');
  $('#main').innerHTML=(staff()&&sectionHelp[view]?`<div class="notice section-help">${pageLabel(...sectionHelp[view])}</div>`:'')+html;
  finishPage();
 }catch(error){if(version===routeVersion)$('#main').innerHTML=`<div class="error-box">${esc(tr(error.message))}</div><button class="btn outline" data-action="refresh">${tr("Qayta yuklash")}</button>`;}
}
function pageHeading(title,subtitle,action=''){return `<div class="page-heading"><div><h1>${esc(tr(title))}</h1><p>${esc(tr(subtitle))}</p></div>${action}</div>`;}
const newRequestButton=()=>`<button class="btn" data-action="request">${icon('plus')} ${state.script==='cyr'?'Янги мурожаат':'Yangi murojaat'}</button>`;
function stat(label,value,note,ico,emphasis=false){return `<article class="stat ${emphasis?'emphasis':''}"><div class="stat-label">${esc(tr(label))}${icon(ico)}</div><div class="stat-value">${esc(value)}</div><p class="stat-foot">${esc(tr(note))}</p></article>`;}
function staffOverview(){
 const isDir=state.user.role==='director',isCyr=state.script==='cyr';
 const s=state.stats,max=Math.max(1,...(s.categories||[]).map(c=>c.count));
 const headingAction=`<div style="display:flex;gap:10px">${isDir?`<button class="btn outline" data-action="user-new">${icon('users')} ${isCyr?'Янги ходим':'Yangi xodim'}</button>`:''}${newRequestButton()}</div>`;
 return `${pageHeading(isDir?(isCyr?'Раҳбар кабинети':'Rahbar kabineti'):(isCyr?'Координатор иш майдони':'Koordinator ish maydoni'),`${date(new Date().toISOString())} · ${isCyr?'Тизимнинг умумий ҳолати ва кўрсаткичлари':'Tizimning umumiy holati va ko‘rsatkichlari'}`,headingAction)}<div class="stat-grid">${stat(isCyr?'Жами мурожаатлар':'Jami murojaatlar',s.total,isCyr?'Барча вақт бўйича':'Barcha vaqt bo‘yicha','layers',true)}${stat(isCyr?'Бугун келиб тушди':'Bugun kelib tushdi',s.today,isCyr?'Янги мурожаатлар':'Yangi murojaatlar','file')}${stat(isCyr?'Очиқ мурожаатлар':'Ochiq murojaatlar',s.open,isCyr?'Жараёндаги мурожаатлар':'Jarayondagi murojaatlar','clock')}${stat(isCyr?'Якунланган':'Yakunlangan',s.completed,isCyr?'Муваффақиятли якунланган':'Muvaffaqiyatli yakunlangan','check')}</div><div class="panel"><header class="panel-head"><div><h2>${isCyr?'Сўнгги мурожаатлар':'So‘nggi murojaatlar'}</h2><p>${isCyr?'Янги эҳтиёжлар ва ташкил қилинаётган хизматлар':'Yangi ehtiyojlar va tashkil qilinayotgan xizmatlar'}</p></div><a class="text-btn small-text" href="#cabinet/cases">${isCyr?'Барчаси':'Barchasi'} ${icon('arrow')}</a></header>${caseTable(s.recent||state.cases.slice(0,6))}</div><div class="overview-grid"><section class="panel"><header class="panel-head"><h2>${isCyr?'Хизмат йўналишлари бўйича':'Xizmat yo‘nalishlari bo‘yicha'}</h2><span class="pill">${isCyr?'Жами':'Jami'} ${esc(s.total)}</span></header><div class="panel-body">${(s.categories||[]).filter(c=>c.count>0).map(c=>`<div class="bar-row"><div class="bar-top"><span>${esc(category(c.name))}</span><b>${esc(c.count)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3,c.count/max*100)}%"></div></div></div>`).join('')||empty(isCyr?'Ҳали маълумот йўқ':'Hali ma’lumot yo‘q',isCyr?'Мурожаатлар келиши билан кўринади.':'Murojaatlar kelishi bilan ko‘rinadi.')}</div></section><section class="panel"><header class="panel-head"><h2>${isCyr?'Платформа бошқаруви':'Platforma boshqaruvi'}</h2></header><div class="task-card">${icon('briefcase')}<div><h3>${isCyr?'Ҳамкорлар базаси':'Hamkorlar bazasi'}</h3><p>${isCyr?'Маълумотномадаги мутахассис ва ташкилотлар':'Ma’lumotnomadagi mutaxassis va tashkilotlar'}</p></div><span class="pill">${esc(s.partners)}</span></div><div class="task-card">${icon('users')}<div><h3>${isCyr?'Мижозлар':'Mijozlar'}</h3><p>${isCyr?'Рўйхатдан ўтган мижозлар ҳисоби':'Ro‘yxatdan o‘tgan mijozlar hisobi'}</p></div><span class="pill">${esc(s.clients)}</span></div><div class="task-card">${icon('home')}<div><h3>${isCyr?'Оила пакетлари':'Oila paketlari'}</h3><p>${isCyr?'Амалдаги оилавий пакетлар':'Amaldagi oilaviy paketlar'}</p></div><span class="pill">${esc(s.packagesCount||0)} (${esc(s.activePackagesCount||0)} ${isCyr?'фаол':'faol'})</span></div><div class="task-card">${icon('star')}<div><h3>${isCyr?'Мижозлар баҳоси':'Mijozlar bahosi'}</h3><p>${isCyr?'Якунланган хизматлар бўйича (1–5 балл)':'Yakunlangan xizmatlar bo‘yicha (1–5 ball)'}</p></div><span class="pill">${s.averageRating==null?(isCyr?'Ҳали йўқ':'Hali yo‘q'):`${Number(s.averageRating).toFixed(1)} / 5`}</span></div><div class="panel-body"><div class="notice" style="margin:0">${isCyr?'ZARURIYAT — инсон мутахассисни ўзи қидирмайди, тизим керакли ечимни ташкил қилади.':'ZARURIYAT — inson mutaxassisni o‘zi qidirmaydi, tizim kerakli yechimni tashkil qiladi.'}</div></div></section></div>`;
}
function personalOverview(){const partner=state.user.role==='partner',open=state.cases.filter(c=>!terminal(c)).length;return `${pageHeading(`${tr('Assalomu alaykum')}, ${state.user.name.split(' ')[0]}.`,partner?tr("Sizga biriktirilgan xizmatlarni shu yerdan boshqaring."):tr("Murojaatlaringiz va yaqinlaringiz uchun yordam bir joyda."),partner?'':newRequestButton())}<div class="stat-grid">${stat(partner?'Biriktirilgan ishlar':'Murojaatlarim',state.cases.length,'Yuklangan murojaatlar bo‘yicha','file',true)}${stat('Jarayonda',open,'Yuklangan murojaatlar bo‘yicha','clock')}${stat('Yakunlangan',state.cases.filter(c=>c.status==='completed').length,'Yuklangan murojaatlar bo‘yicha','check')}${stat(partner?'Xizmatlar':'Oila paketlari',partner?state.cases.reduce((n,c)=>n+c.services.length,0):state.packages.length,partner?'Sizga biriktirilgan xizmatlar':'Hisobingizga biriktirilgan',partner?'briefcase':'home')}</div><div class="section-heading"><div><h2 style="font-size:21px">${tr(partner?'Mening xizmatlarim':'So‘nggi murojaatlarim')}</h2></div><a href="#cabinet/cases" class="text-btn small-text">${tr("Barchasi")} ${icon('arrow')}</a></div>${caseCards(state.cases.slice(0,6))}${!partner&&state.packages.length?`<div style="margin-top:28px"><h2 style="font-size:21px;margin-bottom:18px">${tr("Oila paketingiz")}</h2>${packageCards()}</div>`:''}`;}
function responsibleName(c){return c.coordinatorName?`${esc(c.coordinatorName)}${c.coordinatorRole?` · ${esc(tr(roleNames[c.coordinatorRole]||c.coordinatorRole))}`:''}`:esc(tr('Biriktirilmagan'));}
function clientEmptyCases(){return empty(pageLabel('Bu hisobda murojaat yo‘q','Бу ҳисобда мурожаат йўқ'),pageLabel('Hisobga kirmasdan yuborgan murojaatingizni raqam va maxfiy kalit bilan kuzating. Bu yerda hisobingizga kirib yuborgan murojaatlar ko‘rinadi.','Ҳисобга кирмасдан юборган мурожаатингизни рақам ва махфий калит билан кузатинг. Бу ерда ҳисобингизга кириб юборган мурожаатлар кўринади.'),`<div class="form-actions">${newRequestButton()}<button class="btn outline" data-action="track">${pageLabel('Oldingi murojaatni kuzatish','Олдинги мурожаатни кузатиш')}</button></div>`);}
function caseCards(cases){if(!cases.length)return state.user.role==='client'?`<div class="panel">${clientEmptyCases()}</div>`:`<div class="panel">${empty('Hozircha murojaatlar yo‘q',state.user.role==='partner'?'Sizga xizmat biriktirilganda bu yerda ko‘rinadi.':'Birinchi murojaatingizni qoldiring. Jarayonni shu yerdan kuzatib borasiz.',state.user.role==='client'?newRequestButton():'')}</div>`;return `<div class="case-cards">${cases.map(c=>`<article class="client-case"><div class="client-case-top"><span class="small-text muted">${esc(c.number)}</span>${badge(c.status)}</div><h3>${esc(state.user.role==='partner'?(c.services[0]?.title||category(c.category)):category(c.category))}</h3><p>${esc(c.description||tr("Xizmat tafsilotlarini ko‘ring."))}</p>${staff()?`<dl class="case-card-metadata"><div class="record-full"><dt>${tr('Mijoz')}</dt><dd>${esc(c.name||'?')}</dd></div><div><dt>${pageLabel('Mas’ul xodim','Масъул ходим')}</dt><dd>${responsibleName(c)}</dd></div><div><dt>${tr('Rejalashtirilgan muddat')}</dt><dd>${date(c.dueAt)}${overdue(c)?`<span class="pill red">${tr('Muddati o‘tgan')}</span>`:''}</dd></div></dl>${c.priority==='urgent'?`<span class="pill red">${tr('Shoshilinch')}</span>`:''}`:''}${state.user.role==='partner'?`<div class="member-tags">${c.services.map(s=>`<span>${esc(tr(serviceNames[s.status]))}</span>`).join('')}</div>`:''}<div class="client-case-bottom"><span>${date(c.createdAt)}</span><button class="text-btn small-text" data-action="case" data-id="${c.id}">${tr("Tafsilotlar")} ${icon('arrow')}</button></div></article>`).join('')}</div>`;}
function caseTable(cases){if(mobileViewport())return caseCards(cases);if(!cases.length)return empty('Murojaat topilmadi','Filtrlarni o‘zgartiring yoki yangi murojaat yarating.');return `<div class="table-scroll"><table><thead><tr><th>${tr("Murojaat / mijoz")}</th><th>${tr("Yo‘nalish")}</th><th>${tr("Holat")}</th><th>${pageLabel("Mas’ul xodim","Масъул ходим")}</th><th>${tr("Muddat")}</th><th></th></tr></thead><tbody>${cases.map(c=>`<tr class="clickable" data-action="case" data-id="${c.id}"><td><button class="row-link" data-action="case" data-id="${c.id}">${esc(c.number)}</button><br><small>${esc(c.name)}</small></td><td>${esc(category(c.category))}${c.priority==='urgent'?`<br><span class="pill red" style="margin-top:6px">${tr("Shoshilinch")}</span>`:''}</td><td>${badge(c.status)}</td><td>${responsibleName(c)}</td><td>${overdue(c)?`<span class="pill red">${tr("Muddati o‘tgan")}</span><br>`:''}<small>${date(c.dueAt)}</small></td><td>${icon('arrow')}</td></tr>`).join('')}</tbody></table></div>`;}
function filteredCases(){return state.cases;}
function caseQuery(offset=0){const params=new URLSearchParams({offset:String(offset)});for(const key of ['search','status','category','tab'])if(state.filters[key])params.set(key,state.filters[key]);if(state.filters.overdue)params.set('overdue','true');return `/cases?${params}`;}
function casesPage(){
 const f=state.filters,isCyr=state.script==='cyr';
 const tabsHtml=staff()?`<div class="case-tabs">
<button class="case-tab ${f.tab==='all'?'active':''}" data-action="case-tab" data-tab="all">${isCyr?'Барча мурожаатлар':'Barcha murojaatlar'}</button>
<button class="case-tab ${f.tab==='new'?'active':''}" data-action="case-tab" data-tab="new">${isCyr?'Янги мурожаатлар':'Yangi murojaatlar'}</button>
<button class="case-tab ${f.tab==='open'?'active':''}" data-action="case-tab" data-tab="open">${isCyr?'Очиқ мурожаатлар':'Ochiq murojaatlar'}</button>
<button class="case-tab ${f.tab==='overdue'?'active':''}" data-action="case-tab" data-tab="overdue">${isCyr?'Кечикаётган мурожаатлар':'Kechikayotgan murojaatlar'}</button>
<button class="case-tab ${f.tab==='completed'?'active':''}" data-action="case-tab" data-tab="completed">${isCyr?'Якунланган мурожаатлар':'Yakunlangan murojaatlar'}</button>
<button class="case-tab ${f.tab==='cancelled'?'active':''}" data-action="case-tab" data-tab="cancelled">${pageLabel('Bekor qilinganlar','Бекор қилинганлар')}</button>
</div>`:'';
 return `${pageHeading(staff()?(isCyr?'Мурожаатлар':'Murojaatlar'):state.user.role==='partner'?(isCyr?'Менинг хизматларим':'Mening xizmatlarim'):(isCyr?'Мурожаатларим':'Murojaatlarim'),staff()?(isCyr?'Мурожаат → Масъул координатор → Ҳамкор занжири.':'Murojaat → Mas’ul koordinator → Hamkor zanjiri.'):(isCyr?'Ҳар бир мурожаатнинг ҳолати ва натижаларини кузатинг.':'Har bir murojaatning holati va natijalarini kuzating.'),state.user.role!=='partner'?newRequestButton():'')}${tabsHtml}${staff()?`<p class="small-text muted">${pageLabel('Ish tugagach murojaat «Yakunlangan murojaatlar»da saqlanadi. Mijoz hisobi va ish tarixi o‘chmaydi.','Иш тугагач мурожаат «Якунланган мурожаатлар»да сақланади. Мижоз ҳисоби ва иш тарихи ўчмайди.')}</p>`:''}<div class="filters"><input type="search" id="case-search" aria-label="${tr('Murojaat qidirish')}" placeholder="${isCyr?'Рақам, исм, телефон ёки калит сўз…':'Raqam, ism, telefon yoki kalit so‘z…'}" value="${esc(f.search)}"><select id="case-status" aria-label="${tr('Holat bo‘yicha filtr')}">${options(Object.entries(statusNames).map(([id,name])=>({id,name})),f.status,isCyr?'Барча ҳолатлар':'Barcha holatlar')}</select><select id="case-category" aria-label="${tr('Yo‘nalish bo‘yicha filtr')}">${options(state.config.categories,f.category,isCyr?'Барча йўналишлар':'Barcha yo‘nalishlar')}</select>${staff()?`<label class="check-label"><input type="checkbox" id="case-overdue" ${f.overdue?'checked':''}>${isCyr?'Муддати ўтган':'Muddati o‘tgan'}</label>`:''}</div><div id="case-results" ${staff()?'class="panel"':''}>${state.cases.length?(staff()?caseTable(state.cases):caseCards(state.cases)):emptyCaseResults()}</div><div id="cases-pagination">${casePagination()}</div>`;
}
function emptyCaseResults(){const f=state.filters;return state.user.role==='client'&&!f.search&&!f.status&&!f.category&&!f.overdue&&(!f.tab||f.tab==='all')?clientEmptyCases():empty(tr('Murojaat topilmadi'),tr('Qidiruv yoki filtrlarni o‘zgartiring.'));}
function casePagination(){return `<p class="small-text muted">${tr('Topilgan murojaatlar:')} ${state.cases.length}${state.casesHasMore?' +':''}</p>${state.casesHasMore?`<button class="btn outline" data-action="cases-more">${tr('Yana yuklash')} ${icon('arrow')}</button>`:''}`;}
function renderCaseResults(){const box=$('#case-results');if(!box)return;box.innerHTML=state.cases.length?(staff()?caseTable(state.cases):caseCards(state.cases)):emptyCaseResults();box.removeAttribute('aria-busy');$('#cases-pagination').innerHTML=casePagination();}
async function loadMoreCases(button){
 button.disabled=true;const version=routeVersion,generation=caseSearchGeneration;
 try{const page=await api(caseQuery(state.caseOffset));if(version!==routeVersion||generation!==caseSearchGeneration)return;
  const seen=new Set(state.cases.map(c=>c.id));state.cases.push(...(page.cases||[]).filter(c=>!seen.has(c.id)));
  state.caseOffset+=(page.cases||[]).length;state.casesHasMore=!!page.hasMore;renderCaseResults();
 }finally{if(button.isConnected)button.disabled=false;}
}
function updateCaseFilter(debounce=false){
 if(!$('#case-search'))return;
 state.filters={search:$('#case-search').value.trim(),status:$('#case-status').value,category:$('#case-category').value,overdue:$('#case-overdue')?.checked||false,tab:state.filters.tab||'all'};
 clearTimeout(caseSearchTimer);const generation=++caseSearchGeneration,version=routeVersion;
 const box=$('#case-results');box.setAttribute('aria-busy','true');box.innerHTML=`<div class="loading" role="status">${tr('Qidirilmoqda…')}</div>`;$('#cases-pagination').innerHTML='';
 const search=async()=>{try{const page=await api(caseQuery(0));if(generation!==caseSearchGeneration||version!==routeVersion)return;state.cases=page.cases||[];state.caseOffset=state.cases.length;state.casesHasMore=!!page.hasMore;renderCaseResults();}catch(error){if(generation!==caseSearchGeneration||version!==routeVersion)return;box.removeAttribute('aria-busy');box.innerHTML=`<div class="error-box" role="alert">${esc(tr(error.message))}</div><button class="btn outline" data-action="cases-retry">${tr('Qayta urinib ko‘rish')}</button>`;}};
 if(debounce)caseSearchTimer=setTimeout(search,300);else search();
}
async function caseDialog(id){const version=routeVersion;modalOpen('Murojaat tafsilotlari','',`<div class="loading">${tr("Ma’lumotlar yuklanmoqda…")}</div>`);const jobs=[api(`/cases/${id}`)];if(staff())jobs.push(api('/partners'),api('/team'),api('/auth/options'));try{const [data,partners,team,authOptions]=await Promise.all(jobs);if(version!==routeVersion)return;if(partners)state.partners=partners.partners;if(team)state.team=team.users;if(authOptions)state.authOptions=authOptions;renderCaseDialog(data.case);}catch(e){if(version!==routeVersion)return;$('.modal-body').innerHTML=`<div class="error-box">${esc(e.message)}</div>`;}}
function statusHelp(status){const copy=requestStatuses[status];return copy?esc(pageLabel(...copy.help)):'';}
function coordinatorActions(c){
 const liveServices=c.services.filter(s=>s.status!=='cancelled');
 const ready=liveServices.length>0&&liveServices.every(s=>s.status==='completed');
 const assigned=[...new Set(liveServices.filter(s=>s.partnerId).map(s=>s.partnerName).filter(Boolean))];
 return `<section class="detail-section coordinator-flow"><h3>${pageLabel('Koordinatorning keyingi qadamlari','Координаторнинг кейинги қадамлари')}</h3><ol><li><strong>${pageLabel('Mijoz bilan bog‘laning','Мижоз билан боғланинг')}</strong><div class="form-actions">${c.phone?`<a class="btn outline small" href="tel:${esc(c.phone)}">${icon('phone')} ${pageLabel('Qo‘ng‘iroq qilish','Қўнғироқ қилиш')}</a>`:''}${c.status==='received'?`<button class="btn small" data-action="case-contact" data-id="${c.id}" data-claim="${c.coordinatorId==null?'1':'0'}">${pageLabel('Mijoz bilan gaplashdim','Мижоз билан гаплашдим')}</button>`:`<span class="small-text muted">${pageLabel('Murojaat ustida ish boshlangan','Мурожаат устида иш бошланган')}</span>`}</div></li><li><strong>${pageLabel('Kerakli mutaxassisni biriktiring','Керакли мутахассисни бириктиринг')}</strong>${assigned.length?`<p class="small-text">${pageLabel('Biriktirilgan mutaxassis','Бириктирилган мутахассис')}: ${esc(assigned.join(', '))}</p>`:''}<div class="form-actions"><button class="btn outline small" data-action="case-specialist">${pageLabel('Mutaxassis va xizmatni tanlash','Мутахассис ва хизматни танлаш')}</button></div></li><li><strong>${pageLabel('Xizmat natijasini tekshiring va ishni yoping','Хизмат натижасини текширинг ва ишни ёпинг')}</strong><p class="small-text muted">${ready?pageLabel('Xizmatlar bajarilgan. Murojaatni yakunlash mumkin.','Хизматлар бажарилган. Мурожаатни якунлаш мумкин.'):pageLabel('Avval Xizmatlar bo‘limida har bir xizmatni «Xizmat bajarildi» deb belgilang.','Аввал Хизматлар бўлимида ҳар бир хизматни «Хизмат бажарилди» деб белгиланг.')}</p><button class="btn small" data-action="case-finish" data-id="${c.id}" ${ready?'':'disabled'}>${pageLabel('Murojaatni yakunlash','Мурожаатни якунлаш')}</button></li></ol></section>`;
}
function simpleServiceOptions(chosen){const list=[{id:'pending',name:pageLabel('Jarayonda','Жараёнда')},{id:'completed',name:pageLabel('Xizmat bajarildi','Хизмат бажарилди')},{id:'cancelled',name:pageLabel('Bekor qilindi','Бекор қилинди')}];if(!list.some(s=>s.id===chosen))list.splice(1,0,{id:chosen,name:tr(serviceNames[chosen])});return options(list,chosen);}
function renderCaseDialog(c){
 const isStaff=staff(),isPartner=state.user.role==='partner',inactive=terminal(c),isCyr=state.script==='cyr';let html='';
 const partnerStepNames={pending:isCyr?'Қабул қилдим':'Qabul qildim',accepted:isCyr?'Мижоз билан боғландим':'Mijoz bilan bog‘landim',contacted:isCyr?'Хизмат кўрсатилди':'Xizmat ko‘rsatildi',delivered:isCyr?'Якунланди':'Yakunlandi'};
 if(!isStaff&&!isPartner){html=caseReadOnly(c,c.trackingToken);if(c.trackingToken)html+=`<section class="detail-section"><h3>${tr("Maxfiy kuzatish kaliti")}</h3><div class="token-box"><code>${esc(c.trackingToken)}</code><button class="btn outline small" data-action="copy" data-text="${esc(c.trackingToken)}">${icon('copy')} Nusxalash</button></div></section>`;}
 else{
  html=`<div class="detail-heading"><h3>${esc(c.number)}</h3>${badge(c.status)}</div><dl class="detail-grid"><div><dt>${pageLabel('Mijoz','Мижоз')}</dt><dd>${esc(c.name||'Mijoz')}</dd></div><div><dt>${pageLabel('Telefon','Телефон')}</dt><dd>${c.phone?`<a href="tel:${esc(c.phone)}" class="tel-link">${esc(c.phone)}</a>`:tr('Ko‘rsatilmagan')}</dd></div><div><dt>${pageLabel('Kerakli xizmat','Керакли хизмат')}</dt><dd>${esc(category(c.category))}</dd></div></dl><h3 class="case-description-title">${pageLabel('Mijozning muammosi','Мижознинг муаммоси')}</h3><div class="description">${esc(c.description||pageLabel('Mijoz bilan aniqlashtiriladi.','Мижоз билан аниқлаштирилади.'))}</div><details class="case-extra"><summary>${pageLabel('Qo‘shimcha ma’lumotlar','Қўшимча маълумотлар')}</summary><dl class="detail-grid"><div><dt>${pageLabel('Hudud','Ҳудуд')}</dt><dd>${esc(c.region||tr('Ko‘rsatilmagan'))}</dd></div><div><dt>${pageLabel('Qulay vaqt','Қулай вақт')}</dt><dd>${esc(c.preferredTime||tr('Kelishiladi'))}</dd></div><div><dt>${pageLabel('Kelgan sana','Келган сана')}</dt><dd>${date(c.createdAt,true)}</dd></div><div><dt>${pageLabel('Mas’ul xodim','Масъул ходим')}</dt><dd>${responsibleName(c)}</dd></div>${c.dueAt?`<div><dt>${pageLabel('Bajarish muddati','Бажариш муддати')}</dt><dd>${date(c.dueAt,true)}</dd></div>`:''}</dl>${c.familyPackage?`<div class="notice">${pageLabel('Oila paketi','Оила пакети')}: ${esc(packageName(c.familyPackage.tier))} · ${esc(c.familyPackage.remaining)} ${pageLabel('ta murojaat qoldi','та мурожаат қолди')}</div>`:''}</details>`;
  if(isStaff&&!inactive)html+=coordinatorActions(c);
  if(isStaff&&!inactive)html+=`<details class="detail-section case-extra case-admin" open><summary>${pageLabel('Murojaatni boshqarish','Мурожаатни бошқариш')}</summary><details class="status-guide"><summary>${pageLabel('Qaysi holatni tanlash kerak?','Қайси ҳолатни танлаш керак?')}</summary><div class="notice">${pageLabel('Holatni rahbar va koordinator o‘zgartiradi. Mijoz o‘z murojaati holatini kabinetida yoki maxfiy kuzatish kaliti bilan ko‘radi. Ichki qayd mijozga va hamkorga ko‘rinmaydi.','Ҳолатни раҳбар ва координатор ўзгартиради. Мижоз ўз мурожаати ҳолатини кабинети ёки махфий кузатиш калити билан кўради. Ички қайд мижозга ва ҳамкорга кўринмайди.')}</div><p>${pageLabel('Vaziyatga mos holatni tanlang. Har bir oraliq bosqichdan ketma-ket o‘tish shart emas.','Вазиятга мос ҳолатни танланг. Ҳар бир оралиқ босқичдан кетма-кет ўтиш шарт эмас.')}</p><dl>${Object.entries(requestStatuses).map(([id,copy])=>`<dt>${esc(pageLabel(...copy.title))}</dt><dd>${statusHelp(id)}</dd>`).join('')}</dl></details><form id="case-update-form" data-id="${c.id}" data-original-due-at="${esc(c.dueAt||'')}">${formError}<div class="form-grid">${selectField('status',isCyr?'Мурожаат ҳолати':'Murojaat holati',statusOptions(c.status),'aria-describedby="case-status-help"')}<p class="field full small-text muted" id="case-status-help" role="status">${statusHelp(c.status)}</p>${selectField('coordinatorId',isCyr?'Масъул ходим':'Mas’ul xodim',options(state.team.map(u=>({id:u.id,name:`${u.name} · ${tr(roleNames[u.role])}`})),c.coordinatorId,isCyr?'Бириктирилмаган':tr("Biriktirilmagan")))}<details class="field full case-extra case-settings"><summary>${pageLabel('Qo‘shimcha sozlamalar va izoh','Қўшимча созламалар ва изоҳ')}</summary><div class="form-grid">${selectField('priority',isCyr?'Муҳимлик':'Muhimlik',options([{id:'normal',name:isCyr?'Оддий':'Oddiy'},{id:'urgent',name:isCyr?'Шошилинч':'Shoshilinch'}],c.priority))}${field('dueAt',isCyr?'Бажариш муддати':'Bajarish muddati','datetime-local',c.dueAt?toLocalInput(c.dueAt):'')}${state.authOptions?.clarificationEnabled?selectField('category',tr('Xizmat yo‘nalishi'),options(state.config.categories,c.category))+selectField('region',tr('Hudud'),options(state.config.regions,c.region))+field('preferredTime',tr('Qulay vaqt'),'text',c.preferredTime||'Istalgan vaqt','required maxlength="150"'):''}${textareaField('note',isCyr?'Ички қайд · мижозга кўринмайди':'Ichki qayd · mijozga ko‘rinmaydi','','maxlength="2000" placeholder="Kelishuvlar yoki keyingi qadamlar…"')}</div></details></div><div class="form-actions"><button class="btn small" type="submit">${isCyr?'Ўзгаришларни сақлаш':'O‘zgarishlarni saqlash'}</button></div></form></details>`;
  if(inactive&&isStaff)html+=`<div class="notice">${c.status==='completed'?`${pageLabel('Ish bajarildi. Murojaat va mijoz ma’lumotlari saqlanadi.','Иш бажарилди. Мурожаат ва мижоз маълумотлари сақланади.')} <a href="#cabinet/cases?tab=completed">${pageLabel('Yakunlangan murojaatlar','Якунланган мурожаатлар')}</a><br>`:''}${isCyr?'Мурожаат якунланган. Унинг ҳолати ва хизматларини ўзгартириб бўлмайди.':'Murojaat yakunlangan. Uning holati va xizmatlarini o‘zgartirish mumkin emas.'}</div>`;
  html+=`<details class="detail-section case-extra case-services" ${isPartner?'open':''}><summary>${isPartner?(isCyr?'Сизга бириктирилган хизматлар':'Sizga biriktirilgan xizmatlar'):(isCyr?'Хизматлар':'Xizmatlar')} · ${c.services.length}</summary>${isStaff?`<p class="small-text muted">${pageLabel('Bitta murojaatga bir nechta xizmat qo‘shilishi mumkin. Har bir xizmatni alohida yakunlang, keyin murojaatni «Bajarildi» deb yoping. Hamkor faqat o‘ziga biriktirilgan xizmatni boshqaradi.','Битта мурожаатга бир нечта хизмат қўшилиши мумкин. Ҳар бир хизматни алоҳида якунланг, кейин мурожаатни «Бажарилди» деб ёпинг. Ҳамкор фақат ўзига бириктирилган хизматни бошқаради.')}</p>`:''}${c.services.length?c.services.map(s=>`<article class="service-row"><div class="service-row-head"><b>${esc(s.title)}</b>${badge(s.status,true)}</div><p>${esc(s.partnerName||tr("Hamkor biriktirilmagan"))}${Number(s.price)?` · ${money(s.price)}`:''}</p>${!inactive&&!['completed','cancelled'].includes(s.status)?(isStaff?`<form class="service-update-form" data-id="${s.id}" data-case="${c.id}">${formError}<div class="service-actions"><select name="partnerId" aria-label="${esc(s.title)} ${tr('uchun hamkor')}">${options(state.partners.filter(p=>p.contractStatus==='active'||p.id===s.partnerId),s.partnerId,pageLabel('Mutaxassisni tanlang','Мутахассисни танланг'))}</select><select name="status" aria-label="${esc(s.title)} ${tr('holati')}">${simpleServiceOptions(s.status)}</select><button class="btn small" type="submit">${isCyr?'Бириктириш / Сақлаш':'Biriktirish / Saqlash'}</button></div></form>`:`<form class="service-update-form" data-id="${s.id}" data-case="${c.id}">${formError}<input type="hidden" name="status" value="${serviceOrder[serviceOrder.indexOf(s.status)+1]||'completed'}"><div class="service-actions"><button type="submit" class="btn small">${esc(partnerStepNames[s.status]||tr("Keyingi bosqich"))} ${icon('arrow')}</button></div></form>`):''}</article>`).join(''):`<p class="small-text muted">${tr("Hozircha xizmat qo‘shilmagan.")}</p>`}`;
  if(isStaff&&!inactive)html+=`<details style="margin-top:17px"><summary class="text-btn small-text">${icon('plus')} ${isCyr?'Хизмат қўшиш':'Xizmat qo‘shish'}</summary>${!state.partners.some(p=>p.contractStatus==='active')?`<div class="notice">${pageLabel('Faol mutaxassis hali qo‘shilmagan. Avval xizmat ko‘rsatuvchini ro‘yxatga kiriting.','Фаол мутахассис ҳали қўшилмаган. Аввал хизмат кўрсатувчини рўйхатга киритинг.')} <a href="#cabinet/partners">${pageLabel('Mutaxassislar ro‘yxati','Мутахассислар рўйхати')}</a></div>`:''}<form id="service-add-form" data-id="${c.id}" style="margin-top:16px">${formError}<div class="form-grid">${field('title',isCyr?'Хизмат номи':'Xizmat nomi','text',c.category==='other'?'':category(c.category),'required maxlength="200" placeholder="Masalan: Uyda shifokor ko‘rigi"',true)}${selectField('partnerId',pageLabel('Mutaxassis','Мутахассис'),options(state.partners.filter(p=>p.contractStatus==='active'),'',pageLabel('Mutaxassisni tanlang','Мутахассисни танланг')),'required')}${field('price',isCyr?'Келишилган нарх · сўм':'Kelishilgan narx · so‘m','number','','min="0" step="1" placeholder="Ixtiyoriy"')}</div><div class="form-actions"><button class="btn small" type="submit">${isCyr?'Хизматни қўшиш':'Xizmatni qo‘shish'}</button></div></form></details>`;
  html+='</details>';if(c.feedback)html+=feedbackForm(c,'');html+=`<details class="detail-section case-extra"><summary>${isStaff?(isCyr?'Жараён ва ички қайдлар':'Jarayon va ichki qaydlar'):(isCyr?'Жараён тарихи':'Jarayon tarixi')}</summary>${timeline(c)}</details>`;
 }
 if(c.attachments?.length&&isStaff)html+=`<details class="detail-section case-extra"><summary>${pageLabel('Fayllar','Файллар')} · ${c.attachments.length}</summary><div class="file-list">${c.attachments.map(f=>attachmentButton(f)).join('')}</div></details>`;
 modalOpen(isCyr?'Мурожаат тафсилотлари':'Murojaat tafsilotlari',isPartner?(isCyr?'Сизга бириктирилган хизмат ва мижоз билан боғланиш.':'Sizga biriktirilgan xizmat va mijoz bilan bog‘lanish.'):pageLabel('Mijoz bilan bog‘laning va holatini yangilang.','Мижоз билан боғланинг ва ҳолатини янгиланг.'),html);
}
async function refreshSavedCase(c,version,sourceHash){
 if(version!==routeVersion||!modal.open||(sourceHash!==undefined&&location.hash!==sourceHash))return;
 if(isMobileFormRoute()){
  if(location.hash.split('?')[0]!=='#cabinet/case')return;
  renderCaseDialog(c);finishPage();return;
 }
 const hash=location.hash,pending=renderRoute(),renderedVersion=routeVersion;
 await pending;
 if(routeVersion===renderedVersion&&location.hash===hash&&state.user)renderCaseDialog(c);
}
function toLocalInput(d){const dt=new Date(d);return new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function partnersPage(){const isCyr=state.script==='cyr';return `${pageHeading(isCyr?'Ҳамкорлар базаси':'Hamkorlar bazasi',isCyr?'Хизмат кўрсатувчилар, йўналишлар ва ҳамкорлик шартлари.':'Xizmat ko‘rsatuvchilar, yo‘nalishlar va hamkorlik shartlari.',`<button class="btn" data-action="partner-new">${icon('plus')} ${isCyr?'Ҳамкор қўшиш':'Hamkor qo‘shish'}</button>`)}<div class="filters"><input type="search" id="partner-search" placeholder="${isCyr?'Номи, телефон ёки ҳудуд…':'Nomi, telefon yoki hudud…'}" aria-label="Hamkor qidirish"><select id="partner-category" aria-label="Hamkor yo‘nalishi">${options(state.config.categories,'',isCyr?'Барча йўналишлар':'Barcha yo‘nalishlar')}</select></div><div class="panel" id="partner-results">${partnersTable(state.partners)}</div>`;}
function partnersTable(partners){const isCyr=state.script==='cyr';if(mobileViewport()&&partners.length)return `<div class="mobile-record-list">${partners.map(p=>`<article class="mobile-record partner-record"><header><span class="record-icon">${icon('briefcase')}</span><div><h2>${esc(p.name)}</h2><p>${esc(category(p.category))}</p></div><span class="pill ${p.contractStatus==='active'?'green':'amber'}">${tr({active:'Amalda',pending:'Kutilmoqda',expired:'Muddati tugagan'}[p.contractStatus]||'Kutilmoqda')}</span></header><dl><div><dt>${tr('Hudud')}</dt><dd>${esc(p.region)}</dd></div><div><dt>${tr('Ish vaqti')}</dt><dd>${esc(p.hours)}</dd></div><div class="record-full"><dt>${tr('Manzil')}</dt><dd>${esc(p.address)}</dd></div><div><dt>${tr('Boshlang‘ich narx · so‘m')}</dt><dd>${money(p.price)}</dd></div></dl><a href="tel:${esc(p.phone)}" class="record-contact">${icon('user')} ${esc(p.phone)}</a><div class="record-actions">${editButton("partner-edit",p.id)}</div></article>`).join('')}</div>`;return partners.length?`<div class="table-scroll"><table><thead><tr><th>${isCyr?'Ҳамкор':'Hamkor'}</th><th>${isCyr?'Йўналиш / ҳудуд':'Yo‘nalish / hudud'}</th><th>${isCyr?'Алоқа':'Aloqa'}</th><th>${isCyr?'Хизмат шартлари':'Xizmat shartlari'}</th><th>${isCyr?'Шартнома':'Shartnoma'}</th></tr></thead><tbody>${partners.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.address)}</small></td><td>${esc(category(p.category))}<br><small>${esc(p.region)}</small></td><td><a href="tel:${esc(p.phone)}" class="tel-link">${esc(p.phone)}</a><br><small>${esc(p.hours)}</small></td><td>${money(p.price)}</td><td><span class="pill ${p.contractStatus==='active'?'green':'amber'}">${esc(tr({active:'Amalda',pending:'Kutilmoqda',expired:'Muddati tugagan'}[p.contractStatus]))}</span> ${editButton('partner-edit',p.id)}</td></tr>`).join('')}</tbody></table></div>`:empty(isCyr?'Ҳамкор топилмади':'Hamkor topilmadi',isCyr?'Янги ҳамкор қўшинг ёки филтрларни ўзгартиринг.':'Yangi hamkor qo‘shing yoki filtrlarni o‘zgartiring.');}
function editButton(action,id){return `<button class="btn outline small" data-action="${action}" data-id="${esc(id)}">${tr('Tahrirlash')}</button>`;}
async function finishAdminSave(form,target){
 if(!form.isConnected)return;
 modal.close();modal.innerHTML='';document.body.classList.remove('mobile-page-open','route-loading');modal.classList.remove('mobile-route-page');
 if(isMobileFormRoute()){const from=history.state?.zarFrom;history.replaceState({...history.state,zarEntry:true,zarFrom:from===`#${target}`?null:from},'',`#${target}`);}
 await renderRoute();
}
async function profileEditDialog(id){
 const version=routeVersion;
 const [{user},partners]=await Promise.all([api(`/users/${id}/profile`),api('/partners')]);if(version!==routeVersion)return;
 modalOpen(tr('Profilni tahrirlash'),tr(roleNames[user.role]),`<form id="profile-edit-form" data-id="${user.id}" data-return="cabinet/${user.role==='client'?'clients':'team'}">${formError}<div class="form-grid">${field('name','Ism va familiya','text',user.name,'required maxlength="100"',true)}${field('phone','Telefon','tel',user.phone,'required')}${field('login','Login','text',user.login,'required minlength="3" maxlength="100"')}${user.role==='partner'?selectField('partnerId','Hamkor tashkilot',options(partners.partners,user.partnerId,'Tanlang'),'required'):''}</div><div class="form-actions"><button type="submit" class="btn">${tr('Saqlash')}</button></div></form>`);
}
async function partnerDialog(id=null){const version=routeVersion;const partner=id?(await api(`/partners/${id}`)).partner:null;if(version!==routeVersion)return;modalOpen('Yangi hamkor','Xizmat ko‘rsatuvchining aloqa ma’lumotlari va shartlarini kiriting.',`<form id="partner-form">${formError}<div class="form-grid">${field('name','Tashkilot yoki mutaxassis nomi','text','','required maxlength="150"',true)}${field('phone','Telefon','tel','+998','required')}${selectField('category','Xizmat yo‘nalishi',options(state.config.categories,'','Tanlang'),'required aria-describedby="partner-category-help"')}<p id="partner-category-help" class="field full small-text muted" role="status">${pageLabel('Mutaxassis qanday xizmat ko‘rsatishini tanlang.','Мутахассис қандай хизмат кўрсатишини танланг.')}</p>${selectField('region','Hudud',options(state.config.regions,'','Tanlang'),'required')}${field('hours','Ish vaqti','text','','required placeholder="Du–Sh, 09:00–18:00"')}${field('address','Manzil','text','','required maxlength="250"',true)}${field('price','Boshlang‘ich narx · so‘m','number','','required min="0" step="1" placeholder="150000"')}${selectField('contractStatus','Shartnoma holati',options([{id:'pending',name:'Kutilmoqda'},{id:'active',name:'Amalda'},{id:'expired',name:'Muddati tugagan'}],'pending'))}</div><div class="notice">${tr("Bu ma’lumotnomaga hamkor qo‘shadi. Hamkorning shaxsiy kabineti alohida biriktiriladi.")}</div><div class="form-actions"><button type="submit" class="btn">${tr("Hamkorni saqlash")}</button></div></form>`);if(partner){const form=$('#partner-form');form.dataset.id=partner.id;Object.entries(partner).forEach(([key,value])=>{const input=form.elements.namedItem(key);if(input)input.value=value??'';});$('#modal-title').textContent=tr('Hamkorni tahrirlash');promoteMobileDialog();}}
function clientsPage(){
 const isCyr=state.script==='cyr';
 if(mobileViewport())return `${pageHeading(pageLabel('Mijozlar','Мижозлар'),pageLabel('Ro‘yxatdan o‘tgan mijozlar. Hisobsiz murojaatlar Murojaatlar bo‘limida.','Рўйхатдан ўтган мижозлар. Ҳисобсиз мурожаатлар Мурожаатлар бўлимида.'))}${state.clients.length?`<div class="mobile-record-list">${state.clients.map(c=>{const p=state.packages.find(p=>p.clientId===c.id);return `<article class="mobile-record client-record"><header><span class="record-icon">${icon('user')}</span><div><h2>${esc(c.name)}</h2><p>ID #${esc(c.id)}</p>${state.user.role==='director'?editButton("client-edit",c.id):''}</div></header><a class="record-contact" href="tel:${esc(c.phone)}">${esc(c.phone)}</a><div class="record-summary"><span>${tr('Murojaatlar')}</span><b>${esc(c.caseCount??'—')}</b></div>${p?`<section class="record-package"><div class="record-summary"><b>${esc(packageName(p.tier))}</b><span class="pill ${p.status==='active'?'green':'red'}">${esc(p.remaining??p.limit-p.used)} / ${esc(p.limit)} ${pageLabel('qoldi','қолди')}</span></div><p>${tr('Amal qilish muddati')}: ${date(p.expiresAt)}</p><div class="member-tags">${p.members.map(n=>`<span>${esc(n)}</span>`).join('')}</div>${editButton("package-edit",p.id)}</section>`:`<button class="btn outline" data-action="package-new" data-client="${c.id}">${icon('plus')} ${pageLabel('Paket belgilash','Пакет белгилаш')}</button>`}</article>`;}).join('')}</div>`:empty(pageLabel('Hozircha mijoz yo‘q','Ҳозирча мижоз йўқ'),pageLabel('Ro‘yxatdan o‘tgan mijozlar shu yerda ko‘rinadi.','Рўйхатдан ўтган мижозлар шу ерда кўринади.'))}`;
 return `${pageHeading(isCyr?'Мижозлар':'Mijozlar',pageLabel('Ro‘yxatdan o‘tgan mijozlar va oila paketlari. Hisobsiz yuborilgan murojaatlar Murojaatlar bo‘limida ko‘rinadi.','Рўйхатдан ўтган мижозлар ва оила пакетлари. Ҳисобсиз юборилган мурожаатлар Мурожаатлар бўлимида кўринади.'))}<div class="panel">${state.clients.length?`<div class="table-scroll"><table><thead><tr><th>${isCyr?'Мижоз':'Mijoz'}</th><th>${isCyr?'Телефон':'Telefon'}</th><th>${isCyr?'Мурожаатлар':'Murojaatlar'}</th><th>${isCyr?'Оила пакети':'Oila paketi'}</th></tr></thead><tbody>${state.clients.map(c=>{
  const pkg=(state.packages||[]).find(p=>p.clientId===c.id);
  const pkgHtml=pkg?`<span class="pill ${pkg.status==='active'?'green':'red'}">${esc(packageName(pkg.tier))}</span> <small>${pkg.remaining??(pkg.limit-pkg.used)} / ${pkg.limit} ${isCyr?'қолди':'qoldi'} · ${date(pkg.expiresAt)}</small><div class="member-tags">${pkg.members.map(m=>`<span>${esc(m)}</span>`).join('')}</div>`:`<button class="btn outline small" data-action="package-new" data-client="${c.id}">${icon('plus')} ${isCyr?'Пакет белгилаш':'Paket belgilash'}</button>`;
  return `<tr><td><strong>${esc(c.name)}</strong><small>ID: #${c.id}</small>${state.user.role==='director'?editButton("client-edit",c.id):''}</td><td><a href="tel:${esc(c.phone)}" class="tel-link">${esc(c.phone)}</a></td><td>${esc(c.caseCount??'—')}</td><td>${pkgHtml}</td></tr>`;
 }).join('')}</tbody></table></div>`:empty(isCyr?'Ҳозирча мижоз йўқ':'Hozircha mijoz yo‘q',isCyr?'Рўйхатдан ўтган мижозлар бу ерда кўринади.':'Ro‘yxatdan o‘tgan mijozlar bu yerda ko‘rinadi.')}</div>`;
}
function packagesPage(){return `${pageHeading(staff()?'Oila paketlari':'Oila paketim','A’zolar, amal qilish muddati va foydalanish hisobi.',staff()?'<button class="btn" data-action="package-new">'+icon('plus')+' Paket belgilash</button>':'')}${paymentPanel(state.paymentData,state.script,staff()?state.clients:[],staff())}${state.user.role==='client'?`<div class="form-actions"><a class="btn" href="#family">${pageLabel('Tarif tanlash','Тариф танлаш')}</a></div>`:''}${state.packages.length||!state.paymentData?.subscriptions?.length?packageCards():''}`;}
let subscriptionEligibility=null;
async function subscriptionUseDialog(id,append=false){
 if(!staff())throw new Error(tr('Ruxsat yo‘q.'));
 const selected=append?$('#subscription-use-form [name=caseId]')?.value:'';
 const version=routeVersion,previous=append&&subscriptionEligibility?.id===id?subscriptionEligibility:null;
 const result=await api(`/payments/subscriptions/${Number(id)}/eligible?offset=${previous?.offset||0}`);if(version!==routeVersion)return;
 const seen=new Set((previous?.cases||[]).map(c=>c.id));
 subscriptionEligibility={id,cases:[...(previous?.cases||[]),...result.cases.filter(c=>!seen.has(c.id))],offset:result.offset};
 const cases=subscriptionEligibility.cases;
 modalOpen(pageLabel('Maslahatni qayd etish','Маслаҳатни қайд этиш'),pageLabel('Bitta yakunlangan murojaat bir marta hisobga olinadi.','Битта якунланган мурожаат бир марта ҳисобга олинади.'),`${cases.length?`<form id="subscription-use-form" data-id="${Number(id)}">${formError}${selectField('caseId',pageLabel('Yakunlangan murojaat','Якунланган мурожаат'),options(cases.map(c=>({id:c.id,name:`${c.number} · ${category(c.category)}`})),selected||''), 'required')}<div class="form-actions"><button type="submit" class="btn">${pageLabel('Qayd etish','Қайд этиш')}</button></div></form>`:empty(pageLabel('Mos murojaat yo‘q','Мос мурожаат йўқ'),pageLabel('Hisobga olinmagan yakunlangan maslahatlar shu yerda ko‘rinadi.','Ҳисобга олинмаган якунланган маслаҳатлар шу ерда кўринади.'))}${result.hasMore?`<button class="btn outline" data-action="subscription-more" data-id="${Number(id)}">${pageLabel('Yana ko‘rsatish','Яна кўрсатиш')}</button>`:''}`);
}
async function checkoutDialog(name='COMFORT'){
 const version=routeVersion,tier=packageTiers.find(t=>t.name===name);
 if(!tier)throw new Error(pageLabel('Tarif topilmadi.','Тариф топилмади.'));
 modalOpen(pageLabel('Oila abonementi','Оила абонементи'),tier.name,`<div class="loading">${tr('Kutilmoqda…')}</div>`);
 const options=await api('/payments/options');if(version!==routeVersion)return;
 const price=paymentMoney(tier.monthlyPrice*100);
 const summary=`<h2 class="checkout-tier">${tier.name}</h2><div class="package-price"><strong>${price}</strong> <span>${pageLabel('so‘m / oy','сўм / ой')}</span></div><p>${pageLabel(`${tier.familyMembers} nafargacha oila a’zosi.`,`${tier.familyMembers} нафаргача оила аъзоси.`)}</p>`;
 if(!options.enabled){modalOpen(pageLabel('Oila abonementi','Оила абонементи'),tier.name,`${summary}<div class="notice">${pageLabel('Payme orqali to‘lov hozircha yoqilmagan. Paketni koordinator bilan kelishishingiz mumkin.','Payme орқали тўлов ҳозирча ёқилмаган. Пакетни координатор билан келишишингиз мумкин.')}</div><button class="btn" data-action="request" data-package="${tier.name}">${pageLabel('Koordinatorga murojaat','Координаторга мурожаат')}</button>`);return;}
 if(!state.user){modalOpen(pageLabel('Payme orqali to‘lash','Payme орқали тўлаш'),tier.name,`${summary}<p>${pageLabel('Abonementni hisobingizga biriktirish uchun kiring yoki ro‘yxatdan o‘ting.','Абонементни ҳисобингизга бириктириш учун киринг ёки рўйхатдан ўтинг.')}</p><div class="form-actions"><a class="btn" href="#login">${pageLabel('Hisobga kirish','Ҳисобга кириш')}</a><a class="btn outline" href="#register">${pageLabel('Ro‘yxatdan o‘tish','Рўйхатдан ўтиш')}</a></div>`);return;}
 if(state.user.role!=='client'){modalOpen(pageLabel('Payme orqali to‘lash','Payme орқали тўлаш'),tier.name,`<div class="notice">${pageLabel('Abonement sotib olish uchun mijoz hisobidan kiring.','Абонемент сотиб олиш учун мижоз ҳисобидан киринг.')}</div>`);return;}
 modalOpen(pageLabel('Payme orqali to‘lash','Payme орқали тўлаш'),tier.name,`${summary}${options.mode==='test'?`<div class="notice">${pageLabel('TEST rejimi. Bu sinov to‘lovi, haqiqiy xizmat abonementi faollashmaydi.','TEST режими. Бу синов тўлови, ҳақиқий хизмат абонементи фаоллашмайди.')}</div>`:''}<form id="checkout-form" data-tier="${tier.name}">${formError}${textareaField('members',pageLabel('Oila a’zolari · har biri yangi qatorda','Оила аъзолари · ҳар бири янги қаторда'),state.user.name,`required maxlength="${tier.familyMembers*102}"`)}<div class="notice">${pageLabel('Bir oylik abonement Payme to‘lovni tasdiqlagandan boshlab amal qiladi. Har oy alohida to‘lanadi. Tashqi mutaxassislar xizmat haqi alohida kelishiladi.','Бир ойлик абонемент Payme тўловни тасдиқлагандан бошлаб амал қилади. Ҳар ой алоҳида тўланади. Ташқи мутахассислар хизмат ҳақи алоҳида келишилади.')}</div><label class="check-label"><input type="checkbox" name="consent" required><span>${pageLabel('Tarif narxi, oylik limitlar va to‘lov shartlariga roziman.','Тариф нархи, ойлик лимитлар ва тўлов шартларига розиман.')}</span></label><div class="form-actions"><button type="submit" class="btn">${pageLabel('Payme orqali to‘lash','Payme орқали тўлаш')} · ${price} ${pageLabel('so‘m','сўм')}</button></div></form>`);
}
function packageCards(){if(!state.packages.length)return `<div class="panel">${empty('Hozircha oila paketi yo‘q',staff()?'Mijoz uchun mos paket va foydalanish limitini belgilang.':'Oilangiz uchun mos paket haqida koordinatorga murojaat qiling.',!staff()?`<button class="btn" data-action="request" data-package="COMFORT">${tr("Paket haqida so‘rash")}</button>`:'')}</div>`;return `<div class="package-list">${state.packages.map(p=>`<article class="owned-package"><div class="detail-heading"><h3>${esc(packageName(p.tier))}</h3><span class="pill ${p.status==='active'?'green':'red'}">${tr(({active:'Amalda',expired:'Muddati tugagan',exhausted:'Limit tugagan'})[p.status])}</span></div><p>${esc(p.clientName||state.user.name)}</p><div class="balance">${esc(p.remaining??Math.max(0,p.limit-p.used))} <small>/ ${esc(p.limit)} ${tr('murojaat qoldi')}</small></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Number(p.used)/Math.max(1,Number(p.limit))*100)}%"></div></div><p class="small-text muted" style="margin-top:12px">${esc(p.used)} ${tr('ta foydalanilgan')} · ${date(p.expiresAt)} ${tr('gacha')}</p><div class="member-tags">${p.members.map(n=>`<span>${esc(n)}</span>`).join('')}</div>${staff()?`<div class="form-actions"><button class="btn outline small" data-action="package-edit" data-id="${p.id}">${tr("O‘zgartirish")}</button><button class="btn small" data-action="package-use" data-id="${p.id}">${tr("Foydalanishni qayd etish")}</button></div>`:''}</article>`).join('')}</div>`;}
async function packageDialog(id=null,clientId=''){
 const version=routeVersion;
 const loaded=await Promise.all([api('/clients'),api('/packages')]);if(version!==routeVersion)return;state.clients=loaded[0].clients;state.packages=loaded[1].packages;
 if(version!==routeVersion)return;const p=state.packages.find(p=>String(p.id)===String(id));if(id&&!p)throw new Error(tr('Paket topilmadi.'));const exp=new Date();exp.setFullYear(exp.getFullYear()+1);
 modalOpen(p?'Oila paketini yangilash':'Oila paketini belgilash','Bir mijoz uchun bitta amaldagi paket yuritiladi. Mavjud paket bo‘lsa yangilanadi.',`<form id="package-form" data-id="${p?.id||''}" data-client="${p?.clientId||''}">${formError}<div class="form-grid">${selectField('clientId','Mijoz',options(state.clients,p?.clientId||clientId,'Mijozni tanlang'),p?'required disabled':'required')}${selectField('tier','Paket',options(packageTiers.map(({name})=>name),packageName(p?.tier||'Start')))}${field('expiresAt','Amal qilish muddati','date',new Date(new Date(p?.expiresAt||exp).getTime()+5*3600000).toISOString().slice(0,10),'required')}${field('limit','Murojaatlar limiti','number',p?.limit??5,`required min="${Math.max(1,p?.used||0)}" max="1000" step="1"`)}${textareaField('members','Oila a’zolari · har biri yangi qatorda',p?.members.join('\n')||'','required maxlength="2000" placeholder="Ism va familiya"')}</div><div class="form-actions"><button type="submit" class="btn">${tr("Paketni saqlash")}</button></div></form>`);
}
let packageEligibility=null;
async function packageUseDialog(id,append=false){
 const version=routeVersion;
 const p=state.packages.find(item=>String(item.id)===String(id));
 if(!p)throw new Error(tr('Paket topilmadi.'));
 const selected=append?$('#package-use-form [name="caseId"]')?.value:'';
 const previous=append&&packageEligibility?.id===p.id?packageEligibility:null;
 const page=await api(`/cases?status=completed&clientId=${p.clientId}&offset=${previous?.offset||0}`);
 if(version!==routeVersion)return;
 const used=new Set(p.usedCaseIds||[]);
 const seen=new Set((previous?.cases||[]).map(c=>c.id));
 const eligible=[...(previous?.cases||[]),...page.cases.filter(c=>!used.has(c.id)&&!seen.has(c.id))];
 packageEligibility={id:p.id,cases:eligible,offset:(previous?.offset||0)+page.cases.length,hasMore:!!page.hasMore};
 const more=page.hasMore?`<button type="button" class="btn outline" data-action="package-eligible-more" data-id="${p.id}">${pageLabel('Yana murojaatlarni ko‘rsatish','Яна мурожаатларни кўрсатиш')}</button>`:'';
 const active=p.status==='active';
 modalOpen(tr('Paketdan foydalanishni qayd etish'),`${p.clientName} · ${packageName(p.tier)}`,`<div class="notice">${tr('Bitta yakunlangan murojaat — bitta foydalanish. Bir murojaat ikki marta hisoblanmaydi. To‘lov avtomatik olinmaydi.')}</div>${!active?`<div class="notice">${tr(p.status==='expired'?'Paket muddati tugagan.':'Paket limiti tugagan.')}</div>`:''}${eligible.length?`<form id="package-use-form" data-id="${p.id}">${formError}${selectField('caseId','Yakunlangan murojaat',options(eligible.map(c=>({id:c.id,name:`${c.number} · ${category(c.category)}`})),selected||''),'required')}<div class="form-actions"><button type="submit" class="btn" ${active?'':'disabled'}>${tr('Foydalanishni qayd etish')}</button></div></form>`:empty(pageLabel('Mos murojaat yo‘q','Мос мурожаат йўқ'),pageLabel('Hisobga olinmagan yakunlangan murojaatlar shu yerda ko‘rinadi.','Ҳисобга олинмаган якунланган мурожаатлар шу ерда кўринади.'))}${more}`);
}

function userDialog(){
 const isCyr=state.script==='cyr';
 modalOpen(isCyr?'Янги ходим ҳисобини очиш':'Yangi xodim hisobini ochish',isCyr?'Директор координатор ва ҳамкор ҳисобларини яратиши мумкин.':'Direktor koordinator va hamkor hisoblarini yaratishi mumkin.',`<form id="user-create-form">${formError}<div class="form-grid">${field('name',isCyr?'Исм ва фамилия':'Ism va familiya','text','','required maxlength="100" placeholder="Sardor Aliyev"',true)}${field('phone',isCyr?'Телефон рақами':'Telefon raqami','tel','+998','required')}${field('login',isCyr?'Логин':'Login','text','','required maxlength="50" placeholder="operator_zar"')}${selectField('role',isCyr?'Вазифа (Рол)':'Vazifa (Rol)',options([{id:'operator',name:isCyr?'Координатор / Оператор':'Koordinator / Operator'},{id:'partner',name:isCyr?'Ҳамкор':'Hamkor'}],'operator'))}${selectField('partnerId',isCyr?'Ҳамкор ташкилот (фақат ҳамкор учун)':'Hamkor tashkilot (faqat hamkor uchun)',options(state.partners,'',isCyr?'Ҳамкорни танланг':'Hamkorni tanlang'),'disabled')}${field('password',isCyr?'Парол (камида 10 белги)':'Parol (kamida 10 belgi)','password','','required minlength="10" maxlength="72" placeholder="Kamida 10 ta belgi"',true)}</div><div class="form-actions"><button type="submit" class="btn">${isCyr?'Ҳисобни яратиш':'Hisobni yaratish'}</button></div></form>`);
}
function teamPage(){
 const heading=pageHeading(pageLabel('Xodimlar va jamoa','Ходимлар ва жамоа'),pageLabel('Rahbarlar, koordinatorlar va hamkor hisoblari alohida ko‘rsatiladi. Mijozlar Mijozlar bo‘limida.','Раҳбарлар, координаторлар ва ҳамкор ҳисоблари алоҳида кўрсатилади. Мижозлар Мижозлар бўлимида.'),`<button class="btn" data-action="user-new">${icon('plus')} ${pageLabel('Xodim qo‘shish','Ходим қўшиш')}</button>`);
 return heading+teamGroups.map(group=>{
  const users=(state.teamUsers||[]).filter(u=>u.role===group.role);
  const title=pageLabel(group.lat,group.cyr);
  return `<section class="panel"><header class="panel-head"><h2>${title}</h2><span class="pill">${users.length}</span></header>${users.length?`<div class="mobile-record-list team-account-list">${users.map(u=>{
   const partner=state.partners.find(p=>p.id===u.partnerId);
   const security=u.role==='director'?`<p class="record-note">${pageLabel('Rahbar parolini Profil va xavfsizlik bo‘limidan o‘zgartiradi.','Раҳбар паролини Профил ва хавфсизлик бўлимидан ўзгартиради.')}</p>`:`<div class="record-actions"><button class="btn outline" data-action="staff-password" data-id="${u.id}">${tr('Parolni yangilash')}</button>${state.authOptions?.stage2Enabled&&u.id!==state.user.id?`<button class="btn outline" data-action="staff-block" data-id="${u.id}">${tr(u.blocked?'Faollashtirish':'Bloklash')}</button>`:''}</div>`;
   return `<article class="mobile-record team-record"><header><span class="record-icon">${icon('user')}</span><div><h3>${esc(u.name)}</h3><p>${tr(roleNames[u.role])}${u.id===state.user.id?` · ${pageLabel('Sizning hisobingiz','Сизнинг ҳисобингиз')}`:''}</p></div>${u.blocked?`<span class="pill red">${tr('Bloklangan')}</span>`:''}</header><dl><div><dt>${pageLabel('Login','Логин')}</dt><dd>${esc(u.login||'—')}</dd></div>${partner?`<div class="record-full"><dt>${pageLabel('Biriktirilgan hamkor','Бириктирилган ҳамкор')}</dt><dd>${esc(partner.name)}</dd></div>`:''}</dl><a class="record-contact" href="tel:${esc(u.phone)}">${esc(u.phone)}</a>${editButton("user-edit",u.id)}${security}</article>`;
  }).join('')}</div>`:empty(pageLabel('Bu guruhda hisob yo‘q','Бу гуруҳда ҳисоб йўқ'),group.role==='director'?'':pageLabel('Xodim qo‘shish tugmasi orqali hisob yarating.','Ходим қўшиш тугмаси орқали ҳисоб яратинг.'))}</section>`;
 }).join('');
}
function notificationDeliveryNotice(){
 const sms=state.authOptions?.smsEnabled,tg=state.authOptions?.telegramEnabled;
 return `<div class="notice"><p><strong>SMS:</strong> ${sms?pageLabel('ulangan. Faqat telefonni tasdiqlash va parolni tiklash kodi uchun. Murojaat holati haqida SMS yuborilmaydi.','уланган. Фақат телефонни тасдиқлаш ва паролни тиклаш коди учун. Мурожаат ҳолати ҳақида SMS юборилмайди.'):pageLabel('ulanmagan. Mijozga SMS yuborilmaydi.','уланмаган. Мижозга SMS юборилмайди.')}</p><p><strong>Telegram:</strong> ${tg?pageLabel('ulangan. Murojaat xabarlari faqat botga bog‘langan mijozlarga yuboriladi.','уланган. Мурожаат хабарлари фақат ботга боғланган мижозларга юборилади.'):pageLabel('ulanmagan. Telegramga xabar yuborilmaydi.','уланмаган. Telegramга хабар юборилмайди.')}</p><p>${pageLabel('Quyidagi yozuvlar tizim tayyorlagan xabarlardir. «Navbatda» — hali yuborilmagan. Telefon raqami ko‘rsatilishi SMS yuborilganini anglatmaydi.','Қуйидаги ёзувлар тизим тайёрлаган хабарлардир. «Навбатда» — ҳали юборилмаган. Телефон рақами кўрсатилиши SMS юборилганини англатмайди.')}</p></div>`;
}
function notificationStatusLabel(n){if(n.source==='internal'||n.status==='recorded')return pageLabel('Panelda qayd etildi','Панелда қайд этилди');return tr(({queued:'Navbatda',sent:'Yuborilgan',failed:'Yuborilmadi',sending:'Yuborilmoqda',pending:'Ulanish kutilmoqda'})[n.status]||'Ulanish kutilmoqda');}
function notificationRowsMarkup(){
 if(!state.notifications.length)return empty(tr('Xabarnomalar yo‘q'),tr('Murojaatlar o‘zgarganda xabarlar shu yerda qayd etiladi.'));
 if(mobileViewport())return `<div class="mobile-record-list">${state.notifications.map(n=>`<article class="mobile-record notification-record"><header><span class="record-icon">${icon('bell')}</span><div><h2>${esc(n.caseNumber||'—')}</h2><p>${date(n.createdAt,true)}</p></div><span class="pill ${n.status==='sent'?'green':n.status==='failed'?'red':'amber'}">${notificationStatusLabel(n)}</span></header><h3>${esc(notificationCopy(n,state.script).title)}</h3><p class="notification-message">${esc(notificationCopy(n,state.script).body)}</p><dl><div class="record-full"><dt>${tr('Telefon')}</dt><dd>${esc(n.recipientPhone||'—')}</dd></div></dl>${n.case_id?`<button class="btn outline small" data-action="case" data-id="${esc(n.case_id)}">${pageLabel('Murojaatni ochish','Мурожаатни очиш')}</button>`:''}</article>`).join('')}</div>`;
 return `<div class="table-scroll"><table><thead><tr><th>${tr('Murojaat')}</th><th>${pageLabel('Mijoz telefoni','Мижоз телефони')}</th><th>${tr('Hodisa')}</th><th>${tr('Xabar')}</th><th>${pageLabel('Qayd yoki yuborish holati','Қайд ёки юбориш ҳолати')}</th><th>${tr('Sana')}</th></tr></thead><tbody>${state.notifications.map(n=>`<tr><td>${n.case_id?`<button class="row-link" data-action="case" data-id="${esc(n.case_id)}">${esc(n.caseNumber||'—')}</button>`:esc(n.caseNumber||'—')}</td><td>${esc(n.recipientPhone||'—')}</td><td>${esc(notificationCopy(n,state.script).title)}</td><td>${esc(notificationCopy(n,state.script).body)}</td><td><span class="pill amber">${esc(notificationStatusLabel(n))}</span></td><td>${date(n.createdAt,true)}</td></tr>`).join('')}</tbody></table></div>`;
}
function notificationSoundControl(){
 const label=pageLabel(notificationSoundEnabled?'Ovozni o‘chirish':'Ovozni yoqish',notificationSoundEnabled?'Овозни ўчириш':'Овозни ёқиш');
 return `<button id="notification-sound-control" class="btn outline small" type="button" data-action="notification-sound" aria-pressed="${notificationSoundEnabled}">${icon(notificationSoundEnabled?'bell':'close')} ${label}</button>`;
}
function notificationsPage(){
 const mobile=mobileViewport();
 const title=pageLabel('Xabarnomalar','Хабарномалар');
 const subtitle=pageLabel('Murojaatlar bo‘yicha xabarlar tarixi va yuborish holati','Мурожаатлар бўйича хабарлар тарихи ва юбориш ҳолати');
 const refreshCopy=pageLabel('Yangi xabarlar sahifa ochiq turganda avtomatik yangilanadi. Ovoz telefonning jim rejimi va brauzer ruxsatlariga bog‘liq.','Янги хабарлар саҳифа очиқ турганда автоматик янгиланади. Овоз телефоннинг овозсиз режими ва браузер рухсатларига боғлиқ.');
 return `${pageHeading(title,subtitle)}${notificationDeliveryNotice()}<div class="notification-live notice"><p>${refreshCopy}</p>${notificationSoundControl()}</div><p class="small-text muted">${pageLabel('So‘nggi 100 ta qayd. «Panelda qayd etildi» — markaz ichidagi bildirishnoma, mijozga yuborilgan xabar emas.','Сўнгги 100 та қайд. «Панелда қайд этилди» — марказ ичидаги билдиришнома, мижозга юборилган хабар эмас.')}</p><div class="form-actions"><a class="btn outline small" href="#cabinet/cases?tab=new">${pageLabel('Yangi murojaatlar','Янги мурожаатлар')}</a><a class="btn outline small" href="#cabinet/cases?tab=completed">${pageLabel('Yakunlangan ishlar','Якунланган ишлар')}</a></div><div id="notification-feed" class="${mobile?'':'panel'}">${notificationRowsMarkup()}</div>`;
}
function updateNotificationBadges(){
 const count=state.notificationUnread;
 document.querySelectorAll('[data-nav-section="cabinet/notifications"],.side-nav a[href="#cabinet/notifications"]').forEach(link=>{
  let badge=link.querySelector('.notification-badge');
  if(!count){badge?.remove();return;}
  if(!badge){badge=document.createElement('span');badge.className='notification-badge';link.append(badge);}
  badge.textContent=count>99?'99+':String(count);
  badge.setAttribute('aria-label',`${count} ${pageLabel('yangi xabar','янги хабар')}`);
 });
}
function syncNotifications(rows){
 const changes=notificationChanges(rows,state.notificationKnownIds);
 state.notificationKnownIds=changes.knownIds;
 state.notifications=rows;
 if(changes.incoming.length){
  const viewing=route()==='notifications';
  if(!viewing)state.notificationUnread+=changes.incoming.length;
  playNotificationSound();
  if(!viewing)toast(pageLabel('Yangi xabar keldi. Xabarnomalar bo‘limiga o‘ting.','Янги хабар келди. Хабарномалар бўлимига ўтинг.'));
 }
 if(route()==='notifications'){
  state.notificationUnread=0;
  const feed=$('#notification-feed');if(feed)feed.innerHTML=notificationRowsMarkup();
 }
 updateNotificationBadges();
}
async function pollStaffNotifications(){
 if(notificationPollRunning||document.visibilityState==='hidden'||!staff())return;
 notificationPollRunning=true;
 try{const result=await api('/notifications');syncNotifications(result.notifications||[]);}catch{}finally{notificationPollRunning=false;}
}
document.addEventListener('click',async e=>{
 if(e.target.closest('.skip-link')){e.preventDefault();const main=$('#main');if(main){main.tabIndex=-1;main.focus();main.scrollIntoView();}return;}
 const sideLink=e.target.closest('.side-nav a, .sidebar-bottom a');
 if(sideLink&&window.innerWidth<=820){$('.workspace')?.classList.remove('menu-open');}
 const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;e.preventDefault();
 try{
  const mobileActions={'subscription-use':'cabinet/subscription-use','buy-package':'checkout',request:'request','request-unknown':'request?special=1',track:'track',login:'login',register:'register',privacy:'privacy','site-menu':'menu',menu:'cabinet/menu','account-settings':'cabinet/settings',password:'cabinet/password',case:'cabinet/case','partner-edit':'cabinet/partner-edit','user-edit':'cabinet/user-edit','client-edit':'cabinet/client-edit','partner-new':'cabinet/partner-new','user-new':'cabinet/user-new','package-new':'cabinet/package-new','package-edit':'cabinet/package-edit','package-use':'cabinet/package-use',recovery:'recovery','staff-password':'cabinet/staff-password','staff-block':'cabinet/staff-block','service-detail':'service'};
  if(mobileActions[action]&&(mobileViewport()||action!=='menu')){let target=mobileActions[action];const p=new URLSearchParams();if(button.dataset.id)p.set('id',button.dataset.id);if(button.dataset.category)p.set('category',button.dataset.category);if(button.dataset.package)p.set('package',button.dataset.package);if(button.dataset.client)p.set('client',button.dataset.client);if(p.size)target+=(target.includes('?')?'&':'?')+p.toString();if(location.hash.slice(1)!==target)location.hash=target;return;}
  if(action==='subscription-more'){if(button.disabled)return;button.disabled=true;try{await subscriptionUseDialog(button.dataset.id,true);}finally{if(button.isConnected)button.disabled=false;}}
  else if(action==='page-back')mobileBack();
  else if(action==='registration-restart'){const form=$('#register-form');if(form){delete form.dataset.verification;delete form.dataset.verificationPhone;delete form.dataset.verificationUrl;$('.registration-telegram',form)?.remove();}}
  else if(action==='close'){if(button.matches('a[href^="#"]')){const target=button.hash;modalClose();location.hash=target;}else modalClose(true);}
  else if(action==='request')requestDialog(button.dataset.category||(button.dataset.package?state.config.categories.find(c=>c.id==='other')?.id:''),button.dataset.package);
  else if(action==='request-unknown')requestDialog('','',true);
  else if(action==='toggle-script'){presentationDraft=presentationDraft||captureVisibleForms();state.script=state.script==='cyr'?'lat':'cyr';try{localStorage.setItem('zar_script',state.script);}catch{}app.dataset.page='';await refreshPresentation();}
  else if(action==='case-tab'){state.filters.tab=button.dataset.tab;$('#case-status').value='';if($('#case-overdue'))$('#case-overdue').checked=false;history.replaceState({...history.state},'',`#cabinet/cases?tab=${state.filters.tab}`);state.caseTabRoute=location.hash;document.querySelectorAll('.case-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.filters.tab));updateCaseFilter();}
  else if(action==='user-new'){state.partners=(await api('/partners')).partners;userDialog();}
  else if(action==='track')trackingDialog();
  else if(action==='track-prefill'){state.trackingPrefill={number:button.dataset.number,token:button.dataset.token};if(location.hash==='#track')await renderRoute();else location.hash='track';}
  else if(action==='notification-sound'){notificationSoundEnabled=!notificationSoundEnabled;try{localStorage.setItem('zar_notification_sound',notificationSoundEnabled?'on':'off');}catch{}if(notificationSoundEnabled){unlockNotificationSound();playNotificationSound();}button.outerHTML=notificationSoundControl();}
  else if(action==='login')loginDialog();
  else if(action==='register')loginDialog(true);
  else if(action==='privacy')privacyDialog();
  else if(action==='cabinet')location.hash='cabinet/overview';
  else if(action==='logout'){await api('/auth/logout',{});resetApiContext();state.user=null;resetWorkspace(state);modalClose();modal.innerHTML='';state.filters={search:'',status:'',category:'',overdue:false,tab:'all'};app.dataset.page='';location.hash='home';await renderRoute();toast('Hisobdan chiqdingiz.');}
  else if(action==='copy'){try{await navigator.clipboard.writeText(button.dataset.text);toast('Nusxalandi. Maxfiy kalitni xavfsiz saqlang.');}catch{const input=document.createElement('textarea');input.value=button.dataset.text;modal.append(input);input.select();const ok=document.execCommand('copy');input.remove();toast(ok?'Nusxalandi.':'Nusxalab bo‘lmadi. Kalitni qo‘lda belgilab nusxalang.');}}
  else if(action==='case-contact'||action==='case-finish'){
   button.disabled=true;const version=routeVersion,sourceHash=location.hash;
   try{const body={status:action==='case-contact'?'reviewing':'completed'};if(action==='case-contact'&&button.dataset.claim==='1')body.coordinatorId=state.user.id;const result=await api(`/cases/${button.dataset.id}`,body,'PATCH');await refreshSavedCase(result.case,version,sourceHash);toast(action==='case-contact'?pageLabel('Mijoz bilan gaplashilgan deb belgilandi.','Мижоз билан гаплашилган деб белгиланди.'):pageLabel('Ish yakunlandi. Yakunlangan murojaatlarda saqlanadi.','Иш якунланди. Якунланган мурожаатларда сақланади.'));}finally{if(button.isConnected)button.disabled=false;}
  }
  else if(action==='case-specialist'){
   const services=modal.querySelector('.case-services');if(services){services.open=true;const add=services.querySelector('#service-add-form');if(add&&!services.querySelector('.service-update-form'))add.closest('details').open=true;services.scrollIntoView({behavior:'smooth',block:'start'});(services.querySelector('.service-update-form select[name="partnerId"]')||add?.querySelector('select[name="partnerId"]'))?.focus({preventScroll:true});}
  }
  else if(action==='case')await caseDialog(button.dataset.id);
  else if(action==='partner-new')await partnerDialog();
  else if(action==='cases-retry')updateCaseFilter();
  else if(action==='account-settings')await accountSettings();
  else if(action==='phone-verify-request')await requestPhoneVerification(button);
  else if(action==='telegram-link')await linkTelegram(button);
  else if(action==='telegram-unlink'){if(state.accountDetails?.stage2Enabled&&state.accountDetails?.telegramEnabled){button.disabled=true;try{await api('/account/telegram/unlink',{});if(button.isConnected)await accountSettings();}finally{if(button.isConnected)button.disabled=false;}}}
  else if(action==='staff-block')staffBlockDialog(button.dataset.id);
  else if(action==='password')passwordDialog();
  else if(action==='staff-password')passwordDialog(button.dataset.id);
  else if(action==='recovery-resend'){
   const form=button.closest('#recovery-confirm-form');
   if(!form||form.dataset.channel!=='telegram')return;
   const remaining=Math.ceil((Number(button.dataset.readyAt)-Date.now())/1000);
   if(remaining>0){toast(pageLabel(`Qayta yuborish uchun ${remaining} soniya kuting.`, `Қайта юбориш учун ${remaining} сония кутинг.`));return;}
   button.disabled=true;
   try{
    const result=await api('/auth/recovery/telegram/request',{login:form.dataset.login,challenge:form.dataset.challenge});
    if(!form.isConnected)return;
    button.dataset.readyAt=String(Date.now()+60000);
    toast(tr(result.message));
   }finally{if(button.isConnected)button.disabled=false;}
  }
  else if(action==='recovery')await recoveryDialog();
  else if(action==='cases-more')await loadMoreCases(button);
  else if(action==='file')await openAttachment(button);
  else if(action==='package-new')await packageDialog(null,button.dataset.client);
  else if(action==='package-edit')await packageDialog(button.dataset.id);
  else if(action==='package-use')await packageUseDialog(button.dataset.id);
  else if(action==='package-eligible-more'){button.disabled=true;try{await packageUseDialog(button.dataset.id,true);}finally{if(button.isConnected)button.disabled=false;}}
  else if(action==='refresh')await renderRoute();
  else if(action==='site-menu')siteMenuDialog();
  else if(action==='menu'){const open=$('.workspace').classList.toggle('menu-open');button.setAttribute('aria-expanded',String(open));}
 }catch(error){toast(error.message);}
});
document.addEventListener('change',e=>{
 if(e.target.name==='role'&&e.target.form?.id==='user-create-form'){const partner=e.target.form.elements.partnerId;const isPartner=e.target.value==='partner';partner.disabled=!isPartner;partner.required=isPartner;if(!isPartner)partner.value='';}
 if(e.target.name==='status'&&e.target.form?.id==='case-update-form'&&$('#case-status-help'))$('#case-status-help').innerHTML=statusHelp(e.target.value);
 if(e.target.name==='status'&&e.target.form?.id==='case-update-form'&&e.target.value==='cancelled'){const details=e.target.form.querySelector('.case-settings');if(details)details.open=true;e.target.form.elements.note?.focus();}
 if(e.target.name==='category'&&e.target.form?.id==='partner-form'&&$('#partner-category-help'))$('#partner-category-help').textContent=serviceCopy(e.target.value,'detail');
});
document.addEventListener('input',e=>{
  if(e.target.name==='category'&&e.target.form?.id==='partner-form'&&$('#partner-category-help'))$('#partner-category-help').textContent=serviceCopy(e.target.value,'detail');if(e.target.name==='category'){
    e.target.dataset.manual='true';
  }if(e.target.name==='status'&&e.target.form?.id==='case-update-form'&&$('#case-status-help'))$('#case-status-help').innerHTML=statusHelp(e.target.value);if(['case-search','case-status','case-category','case-overdue'].includes(e.target.id))updateCaseFilter(e.target.id==='case-search');if(['partner-search','partner-category'].includes(e.target.id)){const q=$('#partner-search').value.toLowerCase(),cat=$('#partner-category').value;$('#partner-results').innerHTML=partnersTable(state.partners.filter(p=>(!q||`${p.name} ${p.phone} ${p.region}`.toLowerCase().includes(q))&&(!cat||p.category===cat)));}});
document.addEventListener('submit',async e=>{
 const form=e.target;if(!(form instanceof HTMLFormElement))return;e.preventDefault();if(form.dataset.saving==='true')return;form.dataset.saving='true';const submit=form.querySelector('[type="submit"]'),original=submit?.innerHTML,errorBox=$('.form-error',form);if(errorBox)errorBox.innerHTML='';if(submit){submit.disabled=true;submit.textContent=tr('Kutilmoqda…');}const data=Object.fromEntries(new FormData(form)),version=routeVersion,sourceHash=location.hash;
 try{
  if(form.id==='checkout-form'){const result=await api('/payments/orders',{tier:form.dataset.tier,members:data.members.split('\n').map(m=>m.trim()).filter(Boolean),consent:data.consent==='on'});location.assign(result.checkoutUrl);}
  else if(form.id==='subscription-use-form'){const item=subscriptionEligibility?.cases.find(c=>String(c.id)===data.caseId);if(!item)throw new Error(tr('Murojaat topilmadi.'));await api(`/payments/subscriptions/${Number(form.dataset.id)}/use`,{caseId:Number(data.caseId),kind:item.category==='documents'?'legal':item.category});await finishAdminSave(form,'cabinet/packages');toast(pageLabel('Maslahat qayd etildi.','Маслаҳат қайд этилди.'));}
  else if(form.id==='request-form'){data.attachments=[];data.consent=data.consent==='on';const result=await api('/requests',data);if(form.isConnected&&version===routeVersion)successDialog(result);}
  else if(form.id==='phone-verify-form'){await api('/auth/phone/verify',{challenge:form.dataset.challenge,code:data.code});if(form.isConnected&&version===routeVersion)await accountSettings();toast(tr('Telefon raqami tasdiqlandi.'));}
  else if(form.id==='staff-block-form'){if(!state.authOptions?.stage2Enabled)throw new Error(tr('Bu imkoniyat hali yoqilmagan.'));await api(`/users/${Number(form.dataset.user)}`,{blocked:form.dataset.blocked==='true',currentPassword:data.currentPassword},'PATCH');await finishAdminSave(form,'cabinet/team');toast(tr('Hisob holati yangilandi.'));}
  else if(form.id==='password-form'){
   if(data.password!==data.confirmPassword)throw new Error(tr('Yangi parollar bir xil emas.'));
   await api(form.dataset.user?`/users/${form.dataset.user}/password`:'/auth/password',{currentPassword:data.currentPassword,password:data.password});
   const own=!form.dataset.user||Number(form.dataset.user)===state.user.id;
   if(!own)await finishAdminSave(form,'cabinet/team');
   if(own){resetApiContext();state.user=null;resetWorkspace(state);state.caseOffset=0;state.casesHasMore=false;location.hash=mobileViewport()?'login':'home';await renderRoute();if(!mobileViewport())loginDialog();}toast(tr('Parol yangilandi.'));
  }
  else if(form.id==='recovery-request-form'){
   const telegramChannel=data.channel==='telegram',channel=telegramChannel?'telegram':'sms';
   const result=await api(telegramChannel?'/auth/recovery/telegram/request':'/auth/recovery/request',telegramChannel?{login:data.login}:{phone:data.login});if(!form.isConnected||version!==routeVersion)return;
   modalOpen(tr('Parolni tiklash'),tr('Tasdiqlash kodini va yangi parolni kiriting.'),`<form id="recovery-confirm-form" data-challenge="${esc(result.challenge)}" data-channel="${channel}" data-login="${esc(data.login)}">${formError}<div class="notice" role="status">${esc(pageLabel(telegramChannel?'Hisobingizga Telegram oldindan bog‘langan bo‘lsa, kod botga yuboriladi. Kod 10 daqiqa amal qiladi.':'Telefon oldindan tasdiqlangan bo‘lsa, kod SMS orqali yuboriladi. Kod 10 daqiqa amal qiladi.',telegramChannel?'Ҳисобингизга Telegram олдиндан боғланган бўлса, код ботга юборилади. Код 10 дақиқа амал қилади.':'Телефон олдиндан тасдиқланган бўлса, код SMS орқали юборилади. Код 10 дақиқа амал қилади.'))}</div>${telegramChannel&&result.url?`<p>${esc(tr(result.message))}</p><a class="btn outline" href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">${tr("Telegramda raqamni tasdiqlash")}</a>`:""}${field('code',tr('Tasdiqlash kodi'),'text','','required inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="6" pattern="[0-9]{6}"')}${field('password',tr('Yangi parol'),'password','','required minlength="10" maxlength="72" autocomplete="new-password"')}${field('confirmPassword',tr('Yangi parolni takrorlang'),'password','','required minlength="10" maxlength="72" autocomplete="new-password"')}<div class="form-actions"><button class="btn" type="submit">${tr('Parolni saqlash')}</button>${telegramChannel?`<button type="button" class="btn outline" data-action="recovery-resend" data-ready-at="${Date.now()+60000}">${pageLabel('Kodni qayta yuborish','Кодни қайта юбориш')}</button>`:''}<button type="button" class="btn outline" data-action="recovery">${pageLabel('Qayta boshlash','Қайта бошлаш')}</button></div></form>`);
  }
  else if(form.id==='recovery-confirm-form'){if(data.password!==data.confirmPassword)throw new Error(tr('Yangi parollar bir xil emas.'));await api(form.dataset.channel==='telegram'?'/auth/recovery/telegram/confirm':'/auth/recovery/confirm',{challenge:form.dataset.challenge,code:data.code,password:data.password});if(!form.isConnected||version!==routeVersion)return;resetApiContext();state.user=null;resetWorkspace(state);modalClose();if(mobileViewport())location.hash='login';else loginDialog();toast(tr('Parol yangilandi.'));}
  else if(form.id==='track-form'){state.lastTrack=null;$('#tracking-result').replaceChildren();const result=await api('/track',data);if(!form.isConnected||version!==routeVersion)return;state.lastTrack={case:result.case,token:data.token};$('#tracking-result').innerHTML=`<div class="divider"></div>${caseReadOnly(result.case,data.token)}`;}
  else if(form.id==='login-form'||form.id==='register-form'){
   const register=form.id==='register-form';
   if(register){
    data.consent=data.consent==='on';
    const auth=await api('/auth/options');if(!form.isConnected||version!==routeVersion)return;
    if(auth.registrationTelegramRequired){
     if(!form.dataset.verification||form.dataset.verificationPhone!==normalizePhone(data.phone)){
      const proof=await api('/auth/register/telegram/start',{phone:data.phone,consent:data.consent});
      if(!form.isConnected||version!==routeVersion)return;
      registrationVerification(form,{...proof,phone:normalizePhone(data.phone)});return;
     }
     data.verification=form.dataset.verification;
    }
   }else if(data.login)data.login=normalizeLogin(data.login);
   const signedIn=(await api(register?'/auth/register':'/auth/login',data)).user;resetApiContext();resetWorkspace(state);state.user=signedIn;modalClose();app.dataset.page='';location.hash='cabinet/overview';await renderRoute();
  }
  else if(form.id==='feedback-form'){await api('/feedback',{...data,number:form.dataset.number,token:form.dataset.token,rating:Number(data.rating)});form.innerHTML=`<div class="notice">${tr("Fikringiz uchun rahmat. Bahoyingiz saqlandi.")}</div>`;toast('Baho saqlandi.');}
  else if(form.id==='case-update-form'){const body={status:data.status,priority:data.priority,coordinatorId:data.coordinatorId?Number(data.coordinatorId):null};Object.assign(body,deadlineChanges(data.dueAt,form.dataset.originalDueAt,state.authOptions?.clarificationEnabled===true));if(data.category)body.category=data.category;if(data.region)body.region=data.region;if(data.preferredTime)body.preferredTime=data.preferredTime;if(data.note.trim())body.note=data.note.trim();const result=await api(`/cases/${form.dataset.id}`,body,'PATCH');await refreshSavedCase(result.case,version,sourceHash);toast('Murojaat yangilandi.');}
  else if(form.id==='service-add-form'){const body={title:data.title};if(data.partnerId)body.partnerId=Number(data.partnerId);if(data.price!=='')body.price=Number(data.price);const result=await api(`/cases/${form.dataset.id}/services`,body);await refreshSavedCase(result.case,version,sourceHash);toast('Xizmat qo‘shildi.');}
  else if(form.classList.contains('service-update-form')){const body={status:data.status};if(staff())body.partnerId=data.partnerId?Number(data.partnerId):null;const result=await api(`/services/${form.dataset.id}`,body,'PATCH');await refreshSavedCase(result.case,version,sourceHash);toast('Xizmat yangilandi.');}
  else if(form.id==='partner-form'){await api(form.dataset.id?`/partners/${form.dataset.id}`:'/partners',{...data,price:Number(data.price)},form.dataset.id?'PATCH':'POST');await finishAdminSave(form,'cabinet/partners');toast(tr('Hamkor saqlandi.'));}
  else if(form.id==='profile-edit-form'){const result=await api(`/users/${form.dataset.id}/profile`,{...data,...(data.partnerId?{partnerId:Number(data.partnerId)}:{})},'PATCH');if(result.user.id===state.user.id)Object.assign(state.user,result.user);await finishAdminSave(form,form.dataset.return);toast(tr('Profil saqlandi.'));}
  else if(form.id==='package-form'){await api(form.dataset.id?`/packages/${form.dataset.id}`:'/packages',{...data,clientId:Number(form.dataset.client||data.clientId),limit:Number(data.limit),expiresAt:new Date(data.expiresAt+'T23:59:59.999+05:00').toISOString(),members:data.members.split('\n').map(m=>m.trim()).filter(Boolean)},form.dataset.id?'PATCH':'POST');await finishAdminSave(form,'cabinet/packages');toast(tr('Oila paketi saqlandi.'));}
  else if(form.id==='package-use-form'){await api(`/packages/${form.dataset.id}/use`,{caseId:Number(data.caseId)});await finishAdminSave(form,'cabinet/packages');toast('Foydalanish hisobi yangilandi.');}
  else if(form.id==='user-create-form'){
    const body={name:data.name,phone:data.phone,login:data.login,role:data.role,password:data.password};
    if(data.role==='partner'&&data.partnerId)body.partnerId=Number(data.partnerId);
    await api('/users',body);
    await finishAdminSave(form,'cabinet/team');
    toast(state.script==='cyr'?'Янги ходим ҳисоби яратилди!':'Yangi xodim hisobi yaratildi!');
  }
 }catch(error){if(errorBox?.isConnected){errorBox.innerHTML=`<div class="error-box">${esc(tr(error.message))}</div>`;errorBox.scrollIntoView({block:'nearest'});}else toast(error.message);}finally{delete form.dataset.saving;if(submit?.isConnected){submit.disabled=false;submit.innerHTML=original;}}
});
window.addEventListener('hashchange',e=>{if(!history.state?.zarEntry)history.replaceState({zarEntry:true,zarFrom:new URL(e.oldURL).hash||'#home'},'');if(navigationReady)renderRoute();});
window.addEventListener('zar-auth-expired',()=>{if(state.user){resetApiContext();state.user=null;resetWorkspace(state);location.hash='login';toast(pageLabel('Sessiya tugadi. Davom etish uchun qayta kiring.','Сессия тугади. Давом этиш учун қайта киринг.'));}});
matchMedia('(max-width: 820px)').addEventListener('change',()=>{if(state.config)refreshPresentation();});
new MutationObserver(()=>{if(document.body.classList.contains('mobile-page-open'))promoteMobileDialog();}).observe(modal,{childList:true,subtree:true});
async function init(){
 navigationReady=false;
 try{
  state.config=await api('/config');
  const cabinetRequested=!!route();
  let authError=null;
  try{const auth=await api('/auth/me');state.user=auth.user;state.backendConfigured=auth.configured!==false;}catch(error){state.user=null;authError=error;if(error.status===503)state.backendConfigured=false;}
  navigationReady=true;
  if(authError&&cabinetRequested){toast(authError.message);throw authError;}
  else{if(state.user)app.dataset.page='';await renderRoute();}
 }catch(error){app.innerHTML=`<main class="public-error" id="main">${brand()}<h1 style="margin-top:30px">${tr("Hozir ulanish imkoni bo‘lmadi.")}</h1><p class="muted">${esc(tr(error.message))}</p><button class="btn" id="retry-init">${tr("Qayta urinib ko‘rish")}</button></main>`;$('#retry-init').addEventListener('click',init);}
}
init().then(()=>pollStaffNotifications());
window.setInterval(pollStaffNotifications,15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pollStaffNotifications();});
window.addEventListener('focus',pollStaffNotifications);
