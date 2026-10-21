import {HttpError,query} from './db.mjs';
import {requireRole} from './security.mjs';
import {text,phone,integer,choice,timestamp,fail} from './validation.mjs';
import {publicConfig} from '../public/supabase-api.js';
import {normalizeLogin} from '../public/auth-input.js';
import {packageValue,packageTiers} from '../public/package-tiers.js';
import {stage2} from './providers.mjs';

export const partnerInput=body=>({name:text(body.name,'Nomi',2,150),phone:phone(body.phone),address:text(body.address,'Manzil',2,250),category:choice(body.category,publicConfig.categories.map(c=>c.id),'Yo‘nalish'),hours:text(body.hours,'Ish vaqti',2,100),region:choice(body.region,publicConfig.regions,'Hudud'),price:integer(body.price,'Narx',0,1000000000),contract_status:choice(body.contractStatus,['active','pending','expired'],'Shartnoma')});
const safeProfile=u=>({id:u.id,name:u.name,phone:u.phone,login:u.login,role:u.role,partnerId:u.partner_id});

export async function handleAdminEditing({path,method,user,body,db,env}){
 const partner=path.match(/^\/partners\/(\d+)$/);
 const profile=path.match(/^\/users\/(\d+)\/profile$/);
 const pkg=path.match(/^\/packages\/(\d+)$/);
 if(!partner&&!profile&&!pkg)return undefined;
 requireRole(user,profile?['director']:['director','operator']);
 if(!['GET','PATCH'].includes(method))throw new HttpError(405,'Bu usul qo‘llab-quvvatlanmaydi.');
 const id=integer((partner||profile||pkg)[1],'ID');
 const table=partner?'partners':profile?'users':'packages';
 const [current]=await db(table,{query:query({id:`eq.${id}`,limit:1})});
 if(!current)throw new HttpError(404,'Ma’lumot topilmadi.');
 if(method==='GET')return partner?{partner:{...current,contractStatus:current.contract_status}}:profile?{user:safeProfile(current)}:{package:current};
 if(partner){
  const [updated]=await db('partners',{method:'PATCH',query:query({id:`eq.${id}`}),body:partnerInput(body)});
  if(!updated)throw new HttpError(404,'Hamkor topilmadi.');
  return {partner:{...updated,contractStatus:updated.contract_status}};
 }
 if(profile){
  const changes={name:text(body.name,'Ism',2,100),phone:phone(body.phone),login:normalizeLogin(text(body.login,'Login',3,100))};
  // Roles and passwords have separate workflows; profile editing cannot elevate access.
  if(body.role!==undefined||body.password!==undefined||body.blocked!==undefined)fail('Faqat profil ma’lumotlarini o‘zgartirish mumkin.');
  if(current.role==='partner'){
   changes.partner_id=integer(body.partnerId,'Hamkor');
   const partners=await db('partners',{query:query({id:`eq.${changes.partner_id}`,limit:1})});
   if(!partners.length)throw new HttpError(404,'Hamkor topilmadi.');
  }
  if(changes.phone!==current.phone&&stage2(env))changes.phone_verified_at=null;
  const [updated]=await db('users',{method:'PATCH',query:query({id:`eq.${id}`,role:`eq.${current.role}`}),body:changes});
  if(!updated)throw new HttpError(409,'Hisob o‘zgargan. Sahifani yangilang.');
  return {user:safeProfile(updated)};
 }
 if(body.clientId!==undefined&&integer(body.clientId,'Mijoz')!==current.client_id)fail('Tahrirlashda paket mijozini almashtirish mumkin emas.');
 if(!Array.isArray(body.members)||!body.members.length||body.members.length>30)fail('1 dan 30 tagacha oila a’zosini kiriting.');
 const saved=await db('rpc/zar_save_package',{method:'POST',body:{p_client_id:current.client_id,p_tier:choice(packageValue(body.tier),packageTiers.map(t=>t.id),'Paket'),p_expires_at:timestamp(body.expiresAt),p_limit:integer(body.limit,'Limit',1,1000),p_members:body.members.map(m=>text(m,'A’zo',2,100))}});
 return {package:saved};
}
