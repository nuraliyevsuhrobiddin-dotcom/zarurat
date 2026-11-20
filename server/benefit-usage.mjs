import {HttpError,query} from './db.mjs';
export async function requireUnusedBenefit(db,caseId){
 const filters=query({select:'case_id',case_id:`eq.${caseId}`,limit:1});
 const used=await Promise.all(['package_usage','subscription_usage'].map(table=>db(table,{query:filters})));
 if(used.some(rows=>rows.length))throw new HttpError(400,'Bu murojaat allaqachon paket yoki obunadan hisoblangan.');
}
