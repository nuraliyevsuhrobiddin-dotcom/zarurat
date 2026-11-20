import {query} from './db.mjs';

const quotas={legal:'legalConsultations',psychology:'psychologicalConsultations',business:'businessConsultations'};
export async function rows(db,table,filters){
 const all=[];
 for(let offset=0;;offset+=500){
  const page=await db(table,{query:query({...filters,limit:500,offset})});
  all.push(...page);if(page.length<500)return all;
 }
}
export async function subscriptionCounts(db,now=new Date()){
 try{const active=await rows(db,'family_subscriptions',{select:'id,client_id',mode:'eq.live',status:'eq.active',starts_at:`lte.${now.toISOString()}`,expires_at:`gt.${now.toISOString()}`,order:'id.asc'});
  return {activeSubscriptions:active.length,subscribedClients:new Set(active.map(s=>String(s.client_id))).size};
 }catch{return {activeSubscriptions:null,subscribedClients:null};}
}

// Only enrich records already authorized by the route. Payment errors must not
// hide cases or incorrectly describe a customer as having no subscription.
export async function enrichSubscriptions(result,user,db,now=new Date()){
 if(!['operator','director'].includes(user?.role))return;
 const records=[...(result.clients||[]),...(result.cases||[]),...(result.case?[result.case]:[])];
 if(!records.length)return;
 const clients=new Set(result.clients||[]);
 const clientId=r=>clients.has(r)?r.id:r.clientId;
 const ids=[...new Set(records.map(clientId).filter(id=>/^\d+$/.test(String(id))))];
 try{
  const subscriptions=[];
  const base={select:'id,client_id,tier,mode,status,starts_at,expires_at,terms',mode:'eq.live',status:'eq.active',starts_at:`lte.${now.toISOString()}`,expires_at:`gt.${now.toISOString()}`,order:'id.asc'};
  if(clients.size&&ids.length>200){const allowed=new Set(ids.map(String));subscriptions.push(...(await rows(db,'family_subscriptions',base)).filter(s=>allowed.has(String(s.client_id))));}
  else for(let i=0;i<ids.length;i+=40)subscriptions.push(...await rows(db,'family_subscriptions',{
   select:'id,client_id,tier,mode,status,starts_at,expires_at,terms',client_id:`in.(${ids.slice(i,i+40).join(',')})`,
   mode:'eq.live',status:'eq.active',starts_at:`lte.${now.toISOString()}`,expires_at:`gt.${now.toISOString()}`,order:'id.asc'
  }));
  // Also validate returned rows: test, future and cancelled records are never benefits.
  const active=subscriptions.filter(s=>s.mode==='live'&&s.status==='active'&&new Date(s.starts_at)<=now&&new Date(s.expires_at)>now);
  const usage=[];
  for(let i=0;i<active.length;i+=40)usage.push(...await rows(db,'subscription_usage',{
   select:'subscription_id,kind,case_id',subscription_id:`in.(${active.slice(i,i+40).map(s=>s.id).join(',')})`,order:'id.asc'
  }));
  for(const r of records){
   const owned=active.filter(s=>String(s.client_id)===String(clientId(r)));
   r.subscription={state:!clientId(r)?'unlinked':owned.length?'active':'none',items:owned.map(s=>({
    id:s.id,tier:s.tier,expiresAt:s.expires_at,
    remaining:Object.fromEntries(Object.entries(quotas).map(([kind,key])=>[kind,Math.max(0,Number(s.terms?.[key]||0)-usage.filter(u=>u.subscription_id===s.id&&u.kind===kind).length)])),
    caseRecorded:!clients.has(r)&&usage.some(u=>u.subscription_id===s.id&&String(u.case_id)===String(r.id))
   }))};
  }
 }catch{
  for(const r of records)r.subscription={state:'unavailable',items:[]};
 }
}
