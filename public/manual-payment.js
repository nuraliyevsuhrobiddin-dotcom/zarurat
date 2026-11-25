// Payment outside Payme: the client pays the company (MChJ) bank account from any
// app or in cash, then staff confirm the money and activate the subscription.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(script,lat,cyr)=>script==='cyr'?cyr:lat;

export const paymentMethods=[
 ['bank','MChJ hisob raqamiga o‘tkazma (Click, Uzum, bank ilovasi)','МЧЖ ҳисоб рақамига ўтказма (Click, Uzum, банк иловаси)'],
 ['cash','Naqd (markaz kassasi)','Нақд (марказ кассаси)'],
 ['terminal','Karta terminali','Карта терминали']
];

export function paymentMethodLabel(method,script='lat'){
 if(!method||method==='payme')return 'Payme';
 const found=paymentMethods.find(([id])=>id===method);
 return found?label(script,found[1],found[2]):'';
}

export function cardPaymentNote(script='lat'){
 return `<p class="card-payment-note">${label(script,'Istalgan Uzcard yoki Humo karta bilan to‘lash mumkin — Payme ilovasi shart emas. Karta raqami va SMS-kod kifoya.','Исталган Uzcard ёки Humo карта билан тўлаш мумкин — Payme иловаси шарт эмас. Карта рақами ва SMS-код кифоя.')}</p>`;
}

export function manualPaymentInfo({price,tier,script='lat',bank={},phone='',open=false,signedIn=true}){
 const t=(lat,cyr)=>label(script,lat,cyr);
 const rows=[[t('Tashkilot','Ташкилот'),bank.company],[t('Hisob raqam','Ҳисоб рақам'),bank.account],[t('Bank','Банк'),bank.bank],[t('MFO','МФО'),bank.mfo],[t('STIR','СТИР'),bank.inn]].filter(([,value])=>String(value||'').trim());
 const tel=String(phone).replace(/[^\d+]/g,'');
 const details=rows.length
  ?`<dl class="bank-details">${rows.map(([name,value])=>`<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`
  :`<p class="notice">${t('Hisob raqam rekvizitlarini koordinatordan so‘rang.','Ҳисоб рақам реквизитларини координатордан сўранг.')}</p>`;
 return `<details class="manual-payment"${open?' open':''}><summary>${t('Click, Uzum yoki boshqa ilova orqali to‘lash','Click, Uzum ёки бошқа илова орқали тўлаш')}</summary><ol>`
  +`<li>${t(`${esc(price)} so‘mni markazning MChJ hisob raqamiga o‘tkazing: Click, Uzum, bank ilovasi yoki bank kassasi orqali. Markazda naqd to‘lash ham mumkin.`,`${esc(price)} сўмни марказнинг МЧЖ ҳисоб рақамига ўтказинг: Click, Uzum, банк иловаси ёки банк кассаси орқали. Марказда нақд тўлаш ҳам мумкин.`)}</li>`
  +`<li>${t(`To‘lov izohiga telefon raqamingiz va «${esc(tier)}» deb yozing.`,`Тўлов изоҳига телефон рақамингиз ва «${esc(tier)}» деб ёзинг.`)}</li>`
  +`<li>${t('Koordinatorga qo‘ng‘iroq qiling. Pul tushgach, obuna hisobingizda yoqiladi.','Координаторга қўнғироқ қилинг. Пул тушгач, обуна ҳисобингизда ёқилади.')}</li></ol>`
  +details
  +(signedIn?'':`<p class="small-text">${t('Obuna sizning hisobingizga yoqiladi. Avval hisobga kiring yoki ro‘yxatdan o‘ting.','Обуна сизнинг ҳисобингизга ёқилади. Аввал ҳисобга киринг ёки рўйхатдан ўтинг.')}</p>`)
  +(/^\+998\d{9}$/.test(tel)?`<a class="btn outline" href="tel:${tel}">${t('Koordinatorga qo‘ng‘iroq','Координаторга қўнғироқ')} · ${esc(phone)}</a>`:'')
  +`</details>`;
}
