// Coordinators arrange specialists by phone; this records which partner a request went to.
// The record is a service row, so closing or cancelling the request closes it too
// (migration 016), and partner counts need no new table. Customers never see it and
// get no notification about it.
import { HttpError } from './db.mjs';
import { integer } from './validation.mjs';

export const arrangedTitle='Telefon orqali kelishildi';
const query=values=>new URLSearchParams(values).toString();

async function openCase(db,caseId){
 const found=(await db('cases',{query:query({select:'id,status',id:`eq.${caseId}`,limit:'1'})}))[0];
 if(!found)throw new HttpError(404,'Murojaat topilmadi.');
 if(['completed','cancelled'].includes(found.status))throw new HttpError(400,'Yopilgan murojaatda hamkorni o‘zgartirib bo‘lmaydi.');
}
async function partnerName(db,id){
 return (await db('partners',{query:query({select:'name',id:`eq.${id}`,limit:'1'})}))[0]?.name||'';
}

export async function arrangePartner(db,user,caseId,body){
 await openCase(db,caseId);
 const partnerId=integer(body.partnerId,'Hamkor',1);
 const partner=(await db('partners',{query:query({select:'id,name,contract_status',id:`eq.${partnerId}`,limit:'1'})}))[0];
 if(!partner)throw new HttpError(404,'Hamkor topilmadi.');
 if(partner.contract_status!=='active')throw new HttpError(400,'Faqat shartnomasi amaldagi hamkorni belgilash mumkin.');
 // A second tap on the same partner changes nothing.
 const existing=await db('services',{query:query({select:'id',case_id:`eq.${caseId}`,partner_id:`eq.${partnerId}`,status:'not.in.(cancelled)',limit:'1'})});
 if(existing.length)return;
 await db('services',{method:'POST',body:{case_id:caseId,title:arrangedTitle,partner_id:partnerId,status:'accepted',price:0}});
 await db('history',{method:'POST',body:{case_id:caseId,kind:'partner',message:`Hamkor bilan kelishildi: ${partner.name}`,actor_name:user.name}});
}

export async function removeArrangedPartner(db,user,caseId,serviceId){
 await openCase(db,caseId);
 const service=(await db('services',{query:query({select:'id,partner_id,status',id:`eq.${serviceId}`,case_id:`eq.${caseId}`,limit:'1'})}))[0];
 if(!service||service.status==='cancelled')throw new HttpError(404,'Kelishilgan hamkor topilmadi.');
 await db('services',{method:'PATCH',query:query({id:`eq.${serviceId}`,case_id:`eq.${caseId}`}),body:{status:'cancelled'}});
 const name=service.partner_id==null?'':await partnerName(db,service.partner_id);
 await db('history',{method:'POST',body:{case_id:caseId,kind:'partner',message:`Hamkor olib tashlandi${name?`: ${name}`:''}`,actor_name:user.name}});
}

// Requests per partner for the partner directory: each request counts once.
export async function partnerCaseCounts(db){
 const links=await db('services',{query:query({select:'partner_id,case_id',status:'not.in.(cancelled)',limit:'10000'})});
 const cases={};
 for(const link of links||[])if(link.partner_id!=null)(cases[link.partner_id]??=new Set()).add(String(link.case_id));
 return Object.fromEntries(Object.entries(cases).map(([id,set])=>[id,set.size]));
}
