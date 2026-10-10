import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {HttpError} from './db.mjs';

const tables=['users','partners','cases','services','history','attachments','feedback','packages','package_usage','notifications'];
const bucketName='zaruriyat-backups';
const magic=Buffer.from('ZARBKP01');
function keyBytes(secret){
 if(!/^[a-f0-9]{64}$/i.test(secret||''))throw new HttpError(503,'Zaxiralash kaliti sozlanmagan.');
 return Buffer.from(secret,'hex');
}
export function encryptBackup(value,secret){
 const nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',keyBytes(secret),nonce);
 cipher.setAAD(magic);
 const encrypted=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(value)))),cipher.final()]);
 return Buffer.concat([magic,nonce,cipher.getAuthTag(),encrypted]);
}
export function decryptBackup(bytes,secret){
 if(bytes.length<36||!bytes.subarray(0,8).equals(magic))throw new Error('Invalid backup format');
 const cipher=createDecipheriv('aes-256-gcm',keyBytes(secret),bytes.subarray(8,20));
 cipher.setAAD(magic);cipher.setAuthTag(bytes.subarray(20,36));
 return JSON.parse(gunzipSync(Buffer.concat([cipher.update(bytes.subarray(36)),cipher.final()])).toString('utf8'));
}
export async function runBackup(env,{fetcher=fetch,now=new Date()}={}){
 keyBytes(env.BACKUP_ENCRYPTION_KEY);
 if(!env.SUPABASE_SERVICE_ROLE_KEY||!env.SUPABASE_URL)throw new HttpError(503,'Zaxiralash xizmati sozlanmagan.');
 const base=env.SUPABASE_URL.replace(/\/$/,'');
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
 const objectName=`daily/${now.toISOString().slice(0,10)}.zarb`;
 const request=async(path,options={})=>fetcher(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});
 let bucket=await request(`/storage/v1/bucket/${bucketName}`);
 const bucketError=bucket.ok?null:await bucket.clone().json().catch(()=>null);
 const missingBucket=bucket.status===404||(bucket.status===400&&String(bucketError?.statusCode)==='404'&&bucketError?.error==='Bucket not found');
 if(missingBucket){
  const created=await request('/storage/v1/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bucketName,name:bucketName,public:false,file_size_limit:52428800,allowed_mime_types:['application/octet-stream']})});
  if(!created.ok&&created.status!==409)throw new HttpError(503,'Zaxira joyini yaratib bo‘lmadi.');
  bucket=await request(`/storage/v1/bucket/${bucketName}`);
 }
 if(!bucket.ok||(await bucket.json()).public!==false)throw new HttpError(503,'Zaxira joyi yopiq va ruxsatli bo‘lishi kerak.');
 const existing=await request(`/storage/v1/object/info/${bucketName}/${objectName}`,{method:'GET'});
 if(existing.ok)return {ok:true,alreadyExists:true,object:objectName};
 if(![400,404].includes(existing.status))throw new HttpError(503,'Zaxira holatini tekshirib bo‘lmadi.');
 const snapshot={version:1,schemaVersion:'0.4.0',createdAt:now.toISOString(),consistency:'application logical backup; per-table reads',tables:{}};
 const counts={};let rawBytes=0;
 for(const table of tables){
  const rows=[];const order=table==='feedback'?'case_id':'id';
  for(let offset=0;;offset+=500){
   const params=new URLSearchParams({select:'*',order:`${order}.asc`,limit:'500',offset:String(offset),created_at:`lte.${now.toISOString()}`});
   const response=await request(`/rest/v1/${table}?${params}`);
   if(!response.ok)throw new HttpError(503,'Zaxira ma’lumotlarini olish imkoni bo‘lmadi.');
   const page=await response.json();rawBytes+=Buffer.byteLength(JSON.stringify(page));
   if(rawBytes>52428800)throw new HttpError(503,'Katta baza uchun PostgreSQL zaxiralash infratuzilmasi kerak.');
   rows.push(...page);
   if(page.length<500)break;
   if(rows.length>100000)throw new HttpError(503,'Zaxira hajmi uchun alohida infratuzilma kerak.');
  }
  snapshot.tables[table]=rows;counts[table]=rows.length;
 }
 const encrypted=encryptBackup(snapshot,env.BACKUP_ENCRYPTION_KEY);
 if(encrypted.length>52428800)throw new HttpError(503,'Zaxira hajmi cheklovdan oshdi.');
 const response=await request(`/storage/v1/object/${bucketName}/${objectName}`,{method:'POST',headers:{'Content-Type':'application/octet-stream','x-upsert':'false'},body:encrypted});
 if(!response.ok){
  const conflict=await request(`/storage/v1/object/info/${bucketName}/${objectName}`);
  if(conflict.ok)return {ok:true,alreadyExists:true,object:objectName};
  throw new HttpError(503,'Shifrlangan zaxirani saqlab bo‘lmadi.');
 }
 return {ok:true,object:objectName,bytes:encrypted.length,sha256:createHash('sha256').update(encrypted).digest('hex'),counts};
}
