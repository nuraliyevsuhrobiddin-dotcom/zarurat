import {rows} from './subscription-summary.mjs';

// Staff need readiness, not the login credentials or personal data of partners.
export async function partnerAccess(partners,db){
 if(!partners.length)return [];
 let accounts;
 try{
  accounts=await rows(db,'users',{select:'id,partner_id,blocked_at',role:'eq.partner',order:'id.asc'});
 }catch{
  return partners.map(p=>({...p,accountStatus:'unknown'}));
 }
 const states=new Map();
 for(const account of accounts){
  if(account.partner_id==null)continue;
  const id=String(account.partner_id);
  if(!account.blocked_at)states.set(id,'active');
  else if(!states.has(id))states.set(id,'blocked');
 }
 return partners.map(p=>({...p,accountStatus:states.get(String(p.id))||'missing'}));
}
