import {randomInt} from 'node:crypto';

// 8 symbols without 0/O and 1/I/L: easy to read over the phone and type on a keyboard.
// 31^8 (about 8.5e11) combinations, together with the case number and the /track rate limit.
const alphabet='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const trackingKeyLength=8;

export function newTrackingKey(){
 let key='';
 for(let i=0;i<trackingKeyLength;i++)key+=alphabet[randomInt(alphabet.length)];
 return key;
}

// Accepts the short key in any letter case, with spaces or dashes, and older 64-character keys.
export function normalizeTrackingKey(value){
 const raw=String(value??'').replace(/[\s-]/g,'');
 return /^[0-9a-f]{64}$/i.test(raw)?raw.toLowerCase():raw.toUpperCase();
}

// The database still issues a long key; replace it right after creation.
// On failure the long key stays valid and is returned unchanged.
export async function shortenTrackingKey(db,caseId,current){
 if(!caseId)return current;
 const key=newTrackingKey();
 try{
  await db('cases',{method:'PATCH',query:new URLSearchParams({id:`eq.${caseId}`}).toString(),body:{tracking_token:key}});
  return key;
 }catch(error){
  console.error(JSON.stringify({event:'tracking_key_failure',category:error.name}));
  return current;
 }
}
