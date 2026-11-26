// Payment outside Payme: the client pays the company (MChJ) through its bank QR code,
// a bank transfer or in cash, then staff confirm the money and activate the subscription.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(script,lat,cyr)=>script==='cyr'?cyr:lat;

export const paymentMethods=[
 ['bank','QR-kod yoki MChJ hisob raqamiga o‘tkazma','QR-код ёки МЧЖ ҳисоб рақамига ўтказма'],
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

// The bank's static QR code carries no amount: the client types the tariff price.
// On a phone the code cannot be scanned from its own screen, so it can be saved to the
// gallery and opened from the bank app's QR scanner.
function qrPayment({qr,price,t}){
 const image=String(qr.image||'').trim(),merchant=String(qr.merchant||'').trim();
 if(!image)return '';
 const name=merchant?`«${esc(merchant)}»`:t('markaz','марказ');
 return `<div class="payment-qr"><img src="${esc(image)}" width="260" height="260" alt="${t('To‘lov QR-kodi','Тўлов QR-коди')}${merchant?`: ${esc(merchant)}`:''}" loading="lazy" decoding="async">`
  +(merchant?`<p class="payment-qr-merchant">${t('Qabul qiluvchi','Қабул қилувчи')}: <b>${esc(merchant)}</b></p>`:'')
  +`<a class="btn outline small" href="${esc(image)}" download="zaruriyat-tolov-qr.png">${t('QR-kodni rasmga saqlash','QR-кодни расмга сақлаш')}</a></div>`
  +`<ol><li>${t('Bank ilovangizni oching va QR-kodni skanerlang. Telefondan kirgan bo‘lsangiz, QR-kodni rasmga saqlang (iPhone’da rasmni bosib turing) va ilovadagi QR skanerda galereyadan tanlang.','Банк иловангизни очинг ва QR-кодни сканерланг. Телефондан кирган бўлсангиз, QR-кодни расмга сақланг (iPhone’да расмни босиб туринг) ва иловадаги QR сканерда галереядан танланг.')}</li>`
  +`<li>${t(`Summaga ${esc(price)} so‘m yozing. Qabul qiluvchi ${name} ekanini tekshirib, to‘lovni tasdiqlang.`,`Суммага ${esc(price)} сўм ёзинг. Қабул қилувчи ${name} эканини текшириб, тўловни тасдиқланг.`)}</li>`;
}

export function manualPaymentInfo({price,tier,script='lat',bank={},qr={},phone='',open=false,signedIn=true}){
 const t=(lat,cyr)=>label(script,lat,cyr);
 const rows=[[t('Tashkilot','Ташкилот'),bank.company],[t('Hisob raqam','Ҳисоб рақам'),bank.account],[t('Bank','Банк'),bank.bank],[t('MFO','МФО'),bank.mfo],[t('STIR','СТИР'),bank.inn]].filter(([,value])=>String(value||'').trim());
 const tel=String(phone).replace(/[^\d+]/g,'');
 const details=rows.length?`<dl class="bank-details">${rows.map(([name,value])=>`<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:'';
 const qrSteps=qrPayment({qr,price,t});
 const body=qrSteps
  ?qrSteps
   +`<li>${t(`Chekni saqlang va koordinatorga qo‘ng‘iroq qiling: telefon raqamingiz va «${esc(tier)}» tarifini ayting. Pul tushgach, obuna hisobingizda yoqiladi.`,`Чекни сақланг ва координаторга қўнғироқ қилинг: телефон рақамингиз ва «${esc(tier)}» тарифини айтинг. Пул тушгач, обуна ҳисобингизда ёқилади.`)}</li></ol>`
   +(details?`<p class="small-text">${t('Hisob raqamga o‘tkazma uchun rekvizitlar:','Ҳисоб рақамга ўтказма учун реквизитлар:')}</p>${details}`:'')
   +`<p class="small-text muted">${t('Markazda naqd yoki karta terminali orqali ham to‘lash mumkin.','Марказда нақд ёки карта терминали орқали ҳам тўлаш мумкин.')}</p>`
  :`<ol><li>${t(`${esc(price)} so‘mni markazning MChJ hisob raqamiga o‘tkazing: Click, Uzum, bank ilovasi yoki bank kassasi orqali. Markazda naqd to‘lash ham mumkin.`,`${esc(price)} сўмни марказнинг МЧЖ ҳисоб рақамига ўтказинг: Click, Uzum, банк иловаси ёки банк кассаси орқали. Марказда нақд тўлаш ҳам мумкин.`)}</li>`
   +`<li>${t(`To‘lov izohiga telefon raqamingiz va «${esc(tier)}» deb yozing.`,`Тўлов изоҳига телефон рақамингиз ва «${esc(tier)}» деб ёзинг.`)}</li>`
   +`<li>${t('Koordinatorga qo‘ng‘iroq qiling. Pul tushgach, obuna hisobingizda yoqiladi.','Координаторга қўнғироқ қилинг. Пул тушгач, обуна ҳисобингизда ёқилади.')}</li></ol>`
   +(details||`<p class="notice">${t('Hisob raqam rekvizitlarini koordinatordan so‘rang.','Ҳисоб рақам реквизитларини координатордан сўранг.')}</p>`);
 const summary=qrSteps?t('QR-kod orqali to‘lash (bank ilovasi)','QR-код орқали тўлаш (банк иловаси)'):t('Click, Uzum yoki boshqa ilova orqali to‘lash','Click, Uzum ёки бошқа илова орқали тўлаш');
 return `<details class="manual-payment"${open?' open':''}><summary>${summary}</summary>`
  +body
  +(signedIn?'':`<p class="small-text">${t('Obuna sizning hisobingizga yoqiladi. Avval hisobga kiring yoki ro‘yxatdan o‘ting.','Обуна сизнинг ҳисобингизга ёқилади. Аввал ҳисобга киринг ёки рўйхатдан ўтинг.')}</p>`)
  +(/^\+998\d{9}$/.test(tel)?`<a class="btn outline" href="tel:${tel}">${t('Koordinatorga qo‘ng‘iroq','Координаторга қўнғироқ')} · ${esc(phone)}</a>`:'')
  +`</details>`;
}
