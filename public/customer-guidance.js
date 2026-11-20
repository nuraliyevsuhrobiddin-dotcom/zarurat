const label=(script,lat,cyr)=>script==='cyr'?cyr:lat;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>String(value).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const phone='<a href="tel:+998554067755">+998 55 406 77 55</a>';

export function tariffComparison(tiers,script='lat'){
 const t=(lat,cyr)=>label(script,lat,cyr);
 const rows=[
  [t('Oyiga, so‘m','Ойига, сўм'),tier=>money(tier.monthlyPrice)],
  [t('Oila a’zolari, nafargacha','Оила аъзолари, нафаргача'),tier=>tier.familyMembers],
  [t('Huquqiy maslahat, oyiga','Ҳуқуқий маслаҳат, ойига'),tier=>tier.legalConsultations],
  [t('Psixologik maslahat, oyiga','Психологик маслаҳат, ойига'),tier=>tier.psychologicalConsultations],
  [t('Tadbirkorlik maslahati, oyiga','Тадбиркорлик маслаҳати, ойига'),tier=>tier.businessConsultations||'—']
 ];
 return `<details class="tariff-comparison"><summary>${t('Uchta tarifni solishtirish','Учта тарифни солиштириш')}</summary><table><caption>${t('Bir oylik narx va maslahat limitlari','Бир ойлик нарх ва маслаҳат лимитлари')}</caption><thead><tr><th scope="col">${t('Imkoniyat','Имконият')}</th>${tiers.map(tier=>`<th scope="col">${escape(tier.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([name,value])=>`<tr><th scope="row">${name}</th>${tiers.map(tier=>`<td>${escape(value(tier))}</td>`).join('')}</tr>`).join('')}</tbody></table><p>${t('“—” ushbu maslahat tarifga kirmasligini bildiradi. Barcha tariflarda koordinatorga murojaat qilish mumkin. PREMIUM’da shaxsiy oila koordinatori va ustuvor navbat bor; xizmat vaqti alohida kelishiladi.','“—” ушбу маслаҳат тарифга кирмаслигини билдиради. Барча тарифларда координаторга мурожаат қилиш мумкин. PREMIUM’да шахсий оила координатори ва устувор навбат бор; хизмат вақти алоҳида келишилади.')}</p></details>`;
}

export function tariffConditions(tier,script='lat'){
 const t=(lat,cyr)=>label(script,lat,cyr);
 const allowances=[t(`${tier.legalConsultations} huquqiy`,`${tier.legalConsultations} ҳуқуқий`),t(`${tier.psychologicalConsultations} psixologik`,`${tier.psychologicalConsultations} психологик`)];
 if(tier.businessConsultations)allowances.push(t(`${tier.businessConsultations} tadbirkorlik`,`${tier.businessConsultations} тадбиркорлик`));
 return `<div class="tariff-conditions"><p><strong>${t('Narxga kiradi:','Нархга киради:')}</strong> ${t('koordinator yordami; oyiga','координатор ёрдами; ойига')} ${allowances.map(escape).join(', ')} ${t('maslahat.','маслаҳат.')}</p><p><strong>${t('Narxga kirmaydi:','Нархга кирмайди:')}</strong> ${t('tashqi mutaxassislar xizmat haqi va qo‘shimcha xarajatlar. Ular oldindan alohida kelishiladi.','ташқи мутахассислар хизмат ҳақи ва қўшимча харажатлар. Улар олдиндан алоҳида келишилади.')}</p><p>${t('Obuna bir oylik. Har oy alohida to‘lanadi. Oila nomidan murojaatlarni obuna egasi o‘z hisobidan yuboradi.','Обуна бир ойлик. Ҳар ой алоҳида тўланади. Оила номидан мурожаатларни обуна эгаси ўз ҳисобидан юборади.')}</p></div>`;
}

export function responseGuidance(script='lat'){
 return `<p class="customer-response-note">${label(script,'Murojaatni istalgan vaqtda yuborishingiz mumkin. Koordinatorning bog‘lanish vaqti alohida kelishiladi. Tezroq bog‘lanish uchun markazga qo‘ng‘iroq qiling:','Мурожаатни исталган вақтда юборишингиз мумкин. Координаторнинг боғланиш вақти алоҳида келишилади. Тезроқ боғланиш учун марказга қўнғироқ қилинг:')} ${phone}.</p>`;
}

export function paymentHelp(script='lat'){
 return `<details class="customer-help payment-help"><summary>${label(script,'To‘lov va qaytarish bo‘yicha yordam','Тўлов ва қайтариш бўйича ёрдам')}</summary><p>${label(script,'To‘lovni bekor qilish yoki qaytarish bo‘yicha markazga murojaat qiling. To‘lov raqamini ayting. Qaytarish imkoniyati va tartibini to‘lovdan oldin aniqlashtiring.','Тўловни бекор қилиш ёки қайтариш бўйича марказга мурожаат қилинг. Тўлов рақамини айтинг. Қайтариш имконияти ва тартибини тўловдан олдин аниқлаштиринг.')} ${phone}.</p><p>${label(script,'Karta paroli va tasdiqlash kodlarini yubormang.','Карта пароли ва тасдиқлаш кодларини юборманг.')} <a href="#privacy">${label(script,'Ma’lumotlardan foydalanish shartlari','Маълумотлардан фойдаланиш шартлари')}</a></p></details>`;
}

export function trackingHelp(script='lat',signedClient=false){
 const t=(lat,cyr)=>label(script,lat,cyr);
 return `<details class="customer-help tracking-help"><summary>${t('Raqam yoki kalit yo‘qoldimi?','Рақам ёки калит йўқолдими?')}</summary><p>${t('Hisobingizga bog‘langan murojaatlarni kabinetdan kalitsiz ko‘rishingiz mumkin. Hisobsiz yuborilgan murojaat uchun markaz bilan bog‘laning.','Ҳисобингизга боғланган мурожаатларни кабинетдан калитсиз кўришингиз мумкин. Ҳисобсиз юборилган мурожаат учун марказ билан боғланинг.')}</p><div class="customer-help-actions"><a href="${signedClient?'#cabinet/cases':'#login'}">${signedClient?t('Murojaatlarim','Мурожаатларим'):t('Hisobga kirish','Ҳисобга кириш')}</a>${phone}</div></details>`;
}

export function recoveryGuidance(script='lat'){
 const t=(lat,cyr)=>label(script,lat,cyr);
 return `<div class="recovery-guidance"><p>${t('Kod Telegram botga yuboriladi. Telegram hali bog‘lanmagan bo‘lsa, keyingi qadamda bot orqali o‘z telefon raqamingizni tasdiqlang.','Код Telegram ботга юборилади. Telegram ҳали боғланмаган бўлса, кейинги қадамда бот орқали ўз телефон рақамингизни тасдиқланг.')}</p><details class="customer-help"><summary>${t('Xodim yoki rahbar hisobi uchun','Ходим ёки раҳбар ҳисоби учун')}</summary><p>${t('Telegram hisobingizga oldindan bog‘langan bo‘lishi kerak. Koordinator va hamkor parolini rahbar ham almashtirishi mumkin.','Telegram ҳисобингизга олдиндан боғланган бўлиши керак. Координатор ва ҳамкор паролини раҳбар ҳам алмаштириши мумкин.')}</p></details></div>`;
}

export function customerFaqs(script='lat'){
 const t=(lat,cyr)=>label(script,lat,cyr);
 const entries=[
  [t('Koordinator qachon bog‘lanadi?','Координатор қачон боғланади?'),responseGuidance(script)],
  [t('Oila a’zolari qanday foydalanadi?','Оила аъзолари қандай фойдаланади?'),`<p>${t('Murojaatlarni obuna egasi o‘z hisobidan yuboradi. Izohda kim uchun yordam kerakligini yozadi. Oila a’zolari soni tanlangan tarifga bog‘liq; ular uchun alohida hisob ochish shart emas.','Мурожаатларни обуна эгаси ўз ҳисобидан юборади. Изоҳда ким учун ёрдам кераклигини ёзади. Оила аъзолари сони танланган тарифга боғлиқ; улар учун алоҳида ҳисоб очиш шарт эмас.')}</p>`],
  [t('Mutaxassisning xizmat haqi ham kiradimi?','Мутахассиснинг хизмат ҳақи ҳам кирадими?'),`<p>${t('Abonementga koordinator yordami va tarifdagi oylik maslahat limitlari kiradi. Tashqi mutaxassislar xizmat haqi abonementga kirmaydi. Qo‘shimcha ishlar va xarajatlar oldindan alohida kelishiladi. Mutaxassis mavjudligini koordinator aniqlashtiradi.','Абонементга координатор ёрдами ва тарифдаги ойлик маслаҳат лимитлари киради. Ташқи мутахассислар хизмат ҳақи абонементга кирмайди. Қўшимча ишлар ва харажатлар олдиндан алоҳида келишилади. Мутахассис мавжудлигини координатор аниқлаштиради.')}</p>`]
 ];
 return entries.map(([question,answer])=>`<details><summary>${question}</summary>${answer}</details>`).join('')+paymentHelp(script);
}
