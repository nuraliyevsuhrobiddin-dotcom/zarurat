export function partnerAccessCopy(partner,script='lat'){
 const pick=values=>values[script==='cyr'?1:0];
 const states={
  active:{tone:'green',title:['Kabinetga kirish faol','Кабинетга кириш фаол'],body:['Hamkor shu tashkilotga biriktirilgan hisob orqali xizmatni ko‘radi.','Ҳамкор шу ташкилотга бириктирилган ҳисоб орқали хизматни кўради.']},
  blocked:{tone:'red',title:['Hamkor hisobi bloklangan','Ҳамкор ҳисоби блокланган'],body:['Hamkor hozir kabinetga kira olmaydi. Ishni telefon orqali kelishing yoki rahbardan hisobni tekshirishni so‘rang.','Ҳамкор ҳозир кабинетга кира олмайди. Ишни телефон орқали келишинг ёки раҳбардан ҳисобни текширишни сўранг.']},
  missing:{tone:'amber',title:['Kabinet hisobi ochilmagan','Кабинет ҳисоби очилмаган'],body:['Biriktirish mumkin. Hamkor bilan telefon orqali kelishing; kabinetdan ishlashi uchun alohida hisob kerak.','Бириктириш мумкин. Ҳамкор билан телефон орқали келишинг; кабинетдан ишлаши учун алоҳида ҳисоб керак.']},
  unknown:{tone:'amber',title:['Hisob holati tekshirilmagan','Ҳисоб ҳолати текширилмаган'],body:['Kabinetga kira olishini rahbar bilan tekshiring. Zarur bo‘lsa, ishni telefon orqali kelishing.','Кабинетга кира олишини раҳбар билан текширинг. Зарур бўлса, ишни телефон орқали келишинг.']}
 };
 const copy=states[partner?.accountStatus]||states.unknown;
 return {tone:copy.tone,title:pick(copy.title),body:pick(copy.body)};
}
export function partnerChoiceLabel(partner,direction){
 return [partner.name,direction,partner.region].filter(Boolean).join(' · ');
}
