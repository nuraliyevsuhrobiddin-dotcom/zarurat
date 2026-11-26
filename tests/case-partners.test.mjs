import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {createSession} from '../server/security.mjs';
import {testDatabase} from './helpers/database.mjs';

// Coordinators arrange specialists by phone and record which partner took the request.
// Only staff see it; the partner directory counts requests per partner.
let pg,db,handler,caseId;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'case-partner-secret',FEATURE_STAGE2:'true'};
const cookies={};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(await readFile('migrations/002_accounts_notifications.sql','utf8'));
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES
 ('director','Director','+998902222221',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'director'),
 ('operator','Operator','+998902222222',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'operator'),
 ('client','Client','+998902222223',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client');
 INSERT INTO partners(name,phone,address,category,hours,region,contract_status) VALUES
 ('Advokat Karimov','+998905555555','Qarshi','legal','09-18','Qashqadaryo','active'),
 ('Old notary','+998906666666','Qarshi','legal','09-18','Qashqadaryo','expired');`);
 db=testDatabase(pg);handler=createHandler({db,env});
 for(const u of (await pg.query('SELECT id,login FROM users')).rows)cookies[u.login]='zar_session='+await createSession(u,'audit-password',db,env);
 const input={name:'Client',phone:'+998902222223',region:'Qashqadaryo',category:'legal',description:'Ijara bo‘yicha maslahat kerak',preferred_time:'Istalgan vaqt',attachments:[]};
 caseId=Number((await db('rpc/zar_submit_request',{method:'POST',body:{p_input:input,p_user_id:3}})).case.id);
});
after(async()=>await pg?.close());
async function call(path,role,body,method=body?'POST':'GET'){
 const req={url:'/api'+path,method,body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(role?{cookie:cookies[role]}:{})},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.data=JSON.parse(value);}};
 await handler(req,res);return res;
}
const count=async sql=>(await pg.query(sql)).rows[0].n;

test('staff record the arranged partner once; customers can neither record nor see it',async()=>{
 const notifications=await count('SELECT count(*)::int AS n FROM notifications');
 assert.equal((await call(`/cases/${caseId}/partners`,'client',{partnerId:1})).statusCode,403);
 assert.equal((await call(`/cases/${caseId}/partners`,null,{partnerId:1})).statusCode,401);
 const expired=await call(`/cases/${caseId}/partners`,'operator',{partnerId:2});
 assert.equal(expired.statusCode,400);assert.match(expired.data.error,/amaldagi hamkor/);
 assert.equal((await call(`/cases/${caseId}/partners`,'operator',{partnerId:'x'})).statusCode,400);
 assert.equal((await call(`/cases/${caseId}/partners`,'operator',{partnerId:99})).statusCode,404);
 const res=await call(`/cases/${caseId}/partners`,'operator',{partnerId:1});
 assert.equal(res.statusCode,200);
 const [service]=res.data.case.services;
 assert.equal(service.partnerName,'Advokat Karimov');assert.equal(service.partnerPhone,'+998905555555');assert.equal(service.status,'accepted');
 // A second tap does not add the partner twice.
 assert.equal((await call(`/cases/${caseId}/partners`,'director',{partnerId:1})).data.case.services.length,1);
 const history=(await pg.query("SELECT message,actor_name FROM history WHERE kind='partner'")).rows;
 assert.deepEqual(history,[{message:'Hamkor bilan kelishildi: Advokat Karimov',actor_name:'Operator'}]);
 // The customer is not told and does not receive partner details.
 assert.equal(await count('SELECT count(*)::int AS n FROM notifications'),notifications);
 const own=await call(`/cases/${caseId}`,'client');
 assert.equal(own.statusCode,200);assert.deepEqual(own.data.case.services,[]);
 assert.doesNotMatch(JSON.stringify(own.data),/Karimov|905555555/);
 assert.doesNotMatch(JSON.stringify((await call('/cases','client')).data),/Karimov|905555555/);
});

test('the partner directory counts requests and opens the matching requests',async()=>{
 assert.equal((await call('/partners','client')).statusCode,403);
 const partners=(await call('/partners','operator')).data.partners;
 assert.equal(partners.find(p=>p.name==='Advokat Karimov').caseCount,1);
 assert.equal(partners.find(p=>p.name==='Old notary').caseCount,0);
 assert.deepEqual((await call('/cases?partnerId=1','operator')).data.cases.map(c=>Number(c.id)),[caseId]);
 assert.equal((await call('/cases?partnerId=2','operator')).data.cases.length,0);
 assert.equal((await call('/cases?partnerId=abc','operator')).statusCode,400);
});

test('removing is recorded, closed requests are locked and closing completes the record',async()=>{
 const serviceId=(await pg.query("SELECT id FROM services WHERE status='accepted'")).rows[0].id;
 assert.equal((await call(`/cases/${caseId}/partners/${serviceId}/remove`,'client',{})).statusCode,403);
 const removed=await call(`/cases/${caseId}/partners/${serviceId}/remove`,'operator',{});
 assert.equal(removed.statusCode,200);assert.equal(removed.data.case.services[0].status,'cancelled');
 assert.equal((await pg.query("SELECT message FROM history WHERE kind='partner' ORDER BY id DESC LIMIT 1")).rows[0].message,'Hamkor olib tashlandi: Advokat Karimov');
 assert.equal((await call(`/cases/${caseId}/partners/${serviceId}/remove`,'operator',{})).statusCode,404);
 assert.equal((await call('/partners','operator')).data.partners.find(p=>p.name==='Advokat Karimov').caseCount,0);
 assert.equal((await call('/cases?partnerId=1','operator')).data.cases.length,0);
 // Recorded again, then the request is closed: the record is completed and locked.
 assert.equal((await call(`/cases/${caseId}/partners`,'operator',{partnerId:1})).statusCode,200);
 assert.equal((await call(`/cases/${caseId}`,'operator',{status:'completed'},'PATCH')).statusCode,200);
 assert.deepEqual((await pg.query('SELECT status FROM services ORDER BY id')).rows.map(r=>r.status),['cancelled','completed']);
 const locked=await call(`/cases/${caseId}/partners`,'operator',{partnerId:1});
 assert.equal(locked.statusCode,400);assert.match(locked.data.error,/Yopilgan murojaat/);
 assert.equal((await call('/partners','operator')).data.partners.find(p=>p.name==='Advokat Karimov').caseCount,1);
});
