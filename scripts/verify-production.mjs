// Read-only production verification, apart from temporary login sessions and rate counters.
// No test users or requests are created and no credentials/customer records are printed.
import { readFile, access } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';

const base='https://zarurat-inky.vercel.app';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['index.html','app.js','api.js','auth-input.js','package-tiers.js','site-content.js','service-content.js','ui-localization.js','styles.css','mobile-app.css','manifest.json','images/qarshi-center.jpg'];
const mismatches=[];
await Promise.all(files.map(async file=>{
 const response=await fetch(`${base}/${file}`,{signal:AbortSignal.timeout(20000)});
 if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==hash(await readFile(`public/${file}`)))mismatches.push(file);
}));
console.log(`Published assets: ${files.length-mismatches.length}/${files.length} match local files`);
if(mismatches.length)throw new Error('Published asset mismatch: '+mismatches.join(', '));
for(const path of ['/health','/auth/me']){
 const response=await fetch(`${base}/api${path}`);const body=await response.json();
 console.log(path,response.status,path==='/health'?body.status:`configured=${body.configured}`);
 if(!response.ok)throw new Error('Production API check failed');
}
const mutation=(path,body,cookie)=>fetch(`${base}/api${path}`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
const invalid=await mutation('/requests',{consent:false});
console.log('Invalid request rejected without creating a record:',invalid.status===400);
if(invalid.status!==400)throw new Error('Production request validation failed');
const candidates=[];const seen=new Set();
for(const file of ['.env','.env.vercel','.vercel/.env.production.local']){
 try{await access(file);const values=parseEnv(await readFile(file,'utf8'));
  if(values.ADMIN_PHONE&&values.ADMIN_PASSWORD){const id=hash(values.ADMIN_PHONE+'\0'+values.ADMIN_PASSWORD);if(!seen.has(id)){seen.add(id);candidates.push(values);}}
 }catch{}
}
let authenticated=false;
for(const values of candidates){
 const response=await mutation('/auth/login',{login:values.ADMIN_PHONE,password:values.ADMIN_PASSWORD});
 console.log('Stored account login HTTP:',response.status);
 if(!response.ok)continue;
 const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 try{
  const profile=await response.json();
  if(!['director','operator'].includes(profile.user?.role))continue;
  authenticated=true;
  for(const path of ['/stats','/auth/options']){
   const result=await fetch(`${base}/api${path}`,{headers:{Cookie:cookie}});const data=await result.json();
   console.log(`Authenticated ${path}:`,result.status,...(path==='/auth/options'?[`clarification=${data.clarificationEnabled}`]:[]));
   if(!result.ok)throw new Error('Authenticated verification failed');
  }
  break;
 }finally{await mutation('/auth/logout',{},cookie);}
}
console.log('Authenticated staff verification:',authenticated?'passed':'requires valid current account login');
