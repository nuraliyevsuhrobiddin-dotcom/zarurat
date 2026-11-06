// Presentation helpers only: existing service IDs, sold terms and account permissions stay intact.
const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ь:'',э:'e',ю:'yu',я:'ya',қ:'q',ғ:'g',ҳ:'h',ў:'o'};
export const normalizeServiceSearch=value=>String(value||'').toLowerCase().replace(/[а-яёқғҳў]/g,c=>letters[c]||c).replace(/[‘’ʻʼ'`]/g,'').replace(/\s+/g,' ').trim();
const keywords={legal:'aliment nikoh ajrashish meros mulk huquq yuridik',documents:'kadastr hujjat ariza ijara uy joy davlat',psychology:'psixolog ruhiy stress oilaviy maslahat',medical:'shifokor tibbiy klinika qabul',business:'biznes tadbirkor shartnoma',bank:'bank kredit qarz',children:'bola bolalar talim repetitor',women:'ayol ayollar oila aliment',elderly:'keksa keksalar nafaqa',nanny:'enaga bola parvarish',care:'qarovchi parvarish bemor',cleaning:'tozalash klining uy',repair:'usta tamir santexnik elektr',other:'boshqa yordam aniqlash'};
export function serviceMatches(id,name,description,query){
 const terms=normalizeServiceSearch(query).split(' ').filter(Boolean);
 const haystack=normalizeServiceSearch(`${name} ${description} ${keywords[id]||''}`);
 return terms.every(term=>haystack.includes(term));
}
export function checkoutQuotaRows(tier,script='lat'){
 const cyr=script==='cyr';
 return [
  {id:'legal',title:cyr?'Ҳуқуқий маслаҳат':'Huquqiy maslahat',count:tier.legalConsultations},
  {id:'psychology',title:cyr?'Психологик маслаҳат':'Psixologik maslahat',count:tier.psychologicalConsultations},
  {id:'business',title:cyr?'Тадбиркорлик маслаҳати':'Tadbirkorlik maslahati',count:tier.businessConsultations}
 ];
}
export function createServiceSelection(){
 let pending=null;
 return {
  begin(owner,values,options={}){pending={owner,values:{name:values.name,phone:values.phone,description:values.description,consent:Boolean(values.consent)},packageName:options.packageName||'',special:Boolean(options.special)};},
  peek(owner){if(pending?.owner!==owner){pending=null;return null;}return pending;},
  consume(owner){const result=this.peek(owner);pending=null;return result;},
  clear(){pending=null;}
 };
}
export function verifiedContactDetails(content,script='lat'){
 const text=value=>typeof value==='string'?value.trim():String(value?.[script]||value?.lat||'').trim();
 let map='';
 try{const url=new URL(content.mapUrl||'');if(url.protocol==='https:'&&['maps.google.com','www.google.com','maps.app.goo.gl','yandex.uz','yandex.ru','yandex.com','2gis.uz'].includes(url.hostname))map=url.href;}catch{}
 return {hours:text(content.hours),responseTime:text(content.responseTime),map};
}
