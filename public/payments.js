import {subscriptionSummary} from './subscription-summary.js?v=2';
import {activeSubscription,displayDate} from './payment-state.js';
import {paymentMethodLabel} from './manual-payment.js?v=1';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const paymentMoney=amount=>String(Math.round(Number(amount)/100)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
export function paymentPanel(data,script='lat',clients=[],staff=false,director=false){
 const label=(lat,cyr)=>script==='cyr'?cyr:lat;
 const subs=data?.subscriptions||[],orders=data?.payments||[];
 const statuses={pending:label('To‘lov kutilmoqda','Тўлов кутилмоқда'),reserved:label('Tasdiq kutilmoqda','Тасдиқ кутилмоқда'),paid:label('To‘langan','Тўланган'),cancelled:label('Bekor qilingan','Бекор қилинган'),expired:label('Muddati tugagan','Муддати тугаган')};
 const test=mode=>mode==='test'?`<span class="pill amber">${label('TEST · xizmat faollashmaydi','TEST · хизмат фаоллашмайди')}</span>`:'';
 const refresh=`<button class="btn outline small" data-action="refresh">${label('Yangilash','Янгилаш')}</button>`;
 const resume=o=>{
  try{const url=new URL(o.checkoutUrl);if(staff||o.status!=='pending'||!['https://checkout.paycom.uz','https://test.paycom.uz'].includes(url.origin))return '';
   return `<a class="btn outline small" href="${escape(url.href)}">${label('To‘lovni davom ettirish','Тўловни давом эттириш')}</a>`;
  }catch{return '';}
 };
 const paymentRow=o=>`<article class="payment-row"><div><strong>${escape(o.tier)} · ${paymentMoney(o.amount)} ${label('so‘m','сўм')}</strong><p>${displayDate(o.created_at)}${staff?` · ${escape(clients.find(c=>String(c.id)===String(o.client_id))?.name||label('Mijoz','Мижоз'))}`:''} · ${escape(paymentMethodLabel(o.method,script))}${staff&&o.reference?` · ${escape(o.reference)}`:''}</p><details><summary>${label('To‘lov raqami','Тўлов рақами')} ${escape(String(o.id).slice(0,8))}</summary><code>${escape(o.id)}</code></details></div><div>${resume(o)}${test(o.mode)}<span class="pill ${o.status==='paid'?'green':o.status==='cancelled'?'red':'amber'}">${escape(statuses[o.status]||o.status)}</span>${director&&o.status==='paid'&&o.method&&o.method!=='payme'?`<button class="btn outline small" data-action="manual-payment-cancel" data-id="${escape(o.id)}">${label('Xato yoqilgan · bekor qilish','Хато ёқилган · бекор қилиш')}</button>`:''}</div></article>`;
 const subscriptionCard=s=>{
  const active=activeSubscription(s);
  const limits=[['legal','legalConsultations',label('Huquqiy','Ҳуқуқий')],['psychology','psychologicalConsultations',label('Psixolog','Психолог')],['business','businessConsultations',label('Tadbirkorlik','Тадбиркорлик')]];
  return `<article class="owned-package"><div class="detail-heading"><h3>${escape(s.tier)}</h3><span class="pill ${active?'green':'amber'}">${s.mode==='test'?'TEST':s.status==='cancelled'?statuses.cancelled:active?label('Amalda','Амалда'):statuses.expired}</span></div>${test(s.mode)}<p>${displayDate(s.starts_at)} — ${displayDate(s.expires_at)}</p><details><summary>${label('Oila a’zolari','Оила аъзолари')}</summary><div class="member-tags">${(s.members||[]).map(m=>`<span>${escape(m)}</span>`).join('')}</div><p class="small-text">${label('Oila nomidan murojaatlarni obuna egasi o‘z hisobidan yuboradi. Izohda kim uchun xizmat kerakligini yozing.','Оила номидан мурожаатларни обуна эгаси ўз ҳисобидан юборади. Изоҳда ким учун хизмат кераклигини ёзинг.')}</p></details><ul class="package-services">${limits.filter(([,key])=>Number(s.terms?.[key])>0).map(([kind,key,title])=>`<li><span>${title}</span><b>${Math.max(0,Number(s.terms[key])-Number(s.used?.[kind]||0))} / ${escape(s.terms[key])} ${label('qoldi','қолди')}</b></li>`).join('')}</ul></article>`;
 };
 const history=(allOrders,oldSubs,title)=>allOrders.length||oldSubs.length?`<details class="case-extra payment-history-details"><summary>${title}</summary><div class="payment-history">${allOrders.map(paymentRow).join('')}</div>${oldSubs.length?`<div class="package-list">${oldSubs.map(subscriptionCard).join('')}</div>`:''}<p class="small-text muted">${label('So‘nggi 100 ta to‘lov. Abonement har oy alohida to‘lanadi.','Сўнгги 100 та тўлов. Абонемент ҳар ой алоҳида тўланади.')}</p></details>`:'';
 if(staff){
  const active=clients.filter(c=>c.subscription?.state==='active');
  const unavailable=clients.some(c=>!c.subscription||c.subscription.state==='unavailable');
  return `<section class="payment-section"><div class="detail-heading"><h2>${label('Faol obunali mijozlar','Фаол обунали мижозлар')} · ${active.length}</h2>${refresh}</div>${unavailable?`<p role="status">${label('Ayrim obunalar holati olinmadi. Yangilab ko‘ring.','Айрим обуналар ҳолати олинмади. Янгилаб кўринг.')}</p>`:''}${active.length?`<div class="package-list">${active.map(c=>`<article class="owned-package"><h3>${escape(c.name)}</h3><a class="tel-link" href="tel:${escape(c.phone)}">${escape(c.phone)}</a>${subscriptionSummary(c.subscription,script)}<div class="form-actions"><a class="btn outline small" href="#cabinet/cases?clientId=${encodeURIComponent(c.id)}">${label('Murojaatlari','Мурожаатлари')}</a>${c.subscription.items.map(s=>`<button class="btn outline small" data-action="subscription-use" data-id="${escape(s.id)}">${label('Maslahatni qayd etish','Маслаҳатни қайд этиш')}</button>`).join('')}</div></article>`).join('')}</div>`:`<p>${label('Faol obunalar topilmadi.','Фаол обуналар топилмади.')}</p>`}${history(orders,subs.filter(s=>!activeSubscription(s)),label('To‘lovlar tarixi va sinov yozuvlari','Тўловлар тарихи ва синов ёзувлари'))}</section>`;
 }
 if(!subs.length&&!orders.length)return '';
 const active=subs.filter(s=>activeSubscription(s)),pending=orders.filter(o=>['pending','reserved'].includes(o.status));
 return `<section class="payment-section"><div class="detail-heading"><h2>${label(active.length?'Amaldagi obuna':'To‘lovlar',active.length?'Амалдаги обуна':'Тўловлар')}</h2>${refresh}</div>${active.length?`<div class="package-list">${active.map(subscriptionCard).join('')}</div>`:''}${pending.length?`<div class="payment-history">${pending.map(paymentRow).join('')}</div>`:''}${history(orders.filter(o=>!pending.includes(o)),subs.filter(s=>!active.includes(s)),label('To‘lovlar tarixi','Тўловлар тарихи'))}</section>`;
}
