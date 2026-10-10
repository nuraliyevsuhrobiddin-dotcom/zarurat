import { writeFile } from 'node:fs/promises';
const base=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw new Error('Server settings missing');
console.log('Supabase host:',new URL(base).host);
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
const response=await fetch(`${base}/rest/v1/rpc/zar_stats`,{method:'POST',headers,body:'{}'});
console.log('Stats RPC HTTP:',response.status);
if(!response.ok)throw new Error('Required database migration is not ready');
const stats=await response.json();
console.log('Aggregate counts:',JSON.stringify({total:stats.total,open:stats.open,completed:stats.completed}));
for(const table of ['sessions','rate_limits']){
 const r=await fetch(`${base}/rest/v1/${table}?select=*&limit=1`,{method:'HEAD',headers});
 console.log(`Server ${table} access HTTP:`,r.status);
 if(!r.ok)throw new Error('Server table unavailable');
}
const anon=process.env.SUPABASE_ANON_KEY;
if(anon)for(const table of ['users','cases','attachments']){
 const r=await fetch(`${base}/rest/v1/${table}?select=*&limit=1`,{method:'HEAD',headers:{apikey:anon,Authorization:`Bearer ${anon}`}});
 console.log(`Anonymous ${table} access HTTP:`,r.status);
 if(r.ok)throw new Error('Anonymous access still open');
}
