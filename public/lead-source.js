// Remembers which ad brought the visitor (utm_* or ad click ids) for 30 days on
// this device, so the request sent later — even after sign-up — keeps its source.
// Only short marketing labels are stored, never personal data.
const KEY='zar_lead_source',DAYS_30=30*24*60*60*1000;
const clean=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,60);

export function readLeadSource(storage=globalThis.localStorage,now=Date.now()){
 try{
  const saved=JSON.parse(storage.getItem(KEY)||'null');
  if(!saved?.source||now-saved.at>DAYS_30)return null;
  return {source:saved.source,medium:saved.medium||'',campaign:saved.campaign||''};
 }catch{return null;}
}

export function captureLeadSource(search=globalThis.location?.search||'',storage=globalThis.localStorage,now=Date.now()){
 try{
  const params=new URLSearchParams(search);
  const source=clean(params.get('utm_source'))||(params.has('fbclid')?'facebook':params.has('gclid')?'google':'');
  if(!source)return readLeadSource(storage,now);
  const value={source,medium:clean(params.get('utm_medium')),campaign:clean(params.get('utm_campaign')),at:now};
  storage.setItem(KEY,JSON.stringify(value));
  return {source:value.source,medium:value.medium,campaign:value.campaign};
 }catch{return null;}
}
