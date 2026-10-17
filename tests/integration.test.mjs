import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createHandler } from '../server/api.mjs';
import { testDatabase } from './helpers/database.mjs';

// In-memory PostgreSQL adapter for exercising the HTTP handler against real SQL.
// Production uses PostgREST; this adapter is deliberately confined to tests.
let pg, handler;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'integration-test-session-secret'};
let db;

before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES('boss','Rahbar','+998901111111',extensions.crypt('secure-password',extensions.gen_salt('bf',4)),'director');`);
 db=testDatabase(pg);
 handler=createHandler({db,env});
});
after(async()=>{await pg?.close();});
async function call(path,{method='GET',body,cookie}={}){
 const req={url:'/api'+path,method,body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(cookie?{cookie}: {})},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.data=JSON.parse(s);}};
 await handler(req,res);return res;
}
test('registration, request, tracking, file access, ownership, coordinator, completion, rating and logout',async()=>{
 const registration=await call('/auth/register',{method:'POST',body:{name:'Test mijoz',phone:'+998902222222',password:'client-password',consent:true}});
 assert.equal(registration.statusCode,200);assert.equal(registration.data.user.role,'client');
 const cookie=registration.headers['Set-Cookie'].split(';')[0];
 assert.equal((await call('/auth/me',{cookie})).data.user.name,'Test mijoz');
 const bytes=Buffer.from('%PDF-1.7\nIntegration');
 const created=await call('/requests',{method:'POST',cookie,body:{name:'Test mijoz',phone:'+998902222222',region:'Toshkent shahri',category:'legal',description:'Menga huquqiy maslahat zarur',consent:true,attachments:[{name:'test.pdf',type:'application/pdf',size:bytes.length,data:bytes.toString('base64')}]}});
 assert.equal(created.statusCode,200);
 const {number,id}=created.data.case, secret=created.data.trackingToken;
 const track=await call('/track',{method:'POST',body:{number,token:secret}});
 assert.equal(track.statusCode,200);assert.equal(track.data.case.attachments.length,1);
 const fileId=track.data.case.attachments[0].id;
 assert.equal((await call(`/files/${fileId}`)).statusCode,401);
 const file=await call(`/files/${fileId}`,{method:'POST',body:{number,token:secret}});
 assert.equal(file.statusCode,200);assert.equal(file.data.file.data,bytes.toString('base64'));
 const badTrack=await call('/track',{method:'POST',body:{number,token:'invalid-secret'}});
 assert.equal(badTrack.statusCode,404);
 const other=await call('/auth/register',{method:'POST',body:{name:'Other client',phone:'+998903333333',password:'other-password',consent:true}});
 const otherCookie=other.headers['Set-Cookie'].split(';')[0];
 assert.equal((await call(`/cases/${id}`,{cookie:otherCookie})).statusCode,404);
 assert.equal((await call(`/files/${fileId}`,{cookie:otherCookie})).statusCode,404);
 const boss=await call('/auth/login',{method:'POST',body:{login:'boss',password:'secure-password'}});
 const bossCookie=boss.headers['Set-Cookie'].split(';')[0];
 const partner=await call('/partners',{method:'POST',cookie:bossCookie,body:{name:'Test hamkor',phone:'+998904444444',address:'Toshkent, test',category:'legal',hours:'09:00–18:00',region:'Toshkent shahri',price:0,contractStatus:'active'}});
 assert.equal(partner.statusCode,200);
 await call(`/cases/${id}`,{method:'PATCH',cookie:bossCookie,body:{coordinatorId:1,note:'Faqat ichki qayd'}});
 const detail=await call(`/cases/${id}`,{cookie});
 assert.equal(detail.data.case.coordinatorName,'Rahbar');
 assert.ok(!detail.data.case.history.some(h=>h.kind==='note'));
 assert.equal((await call(`/cases/${id}`,{method:'PATCH',cookie:bossCookie,body:{status:'completed'}})).statusCode,400);
 const service=await call(`/cases/${id}/services`,{method:'POST',cookie:bossCookie,body:{title:'Huquqiy maslahat',partnerId:partner.data.partner.id,price:0}});
 assert.equal(service.statusCode,200);
 await call(`/services/${service.data.case.services[0].id}`,{method:'PATCH',cookie:bossCookie,body:{status:'completed'}});
 assert.equal((await call(`/cases/${id}`,{method:'PATCH',cookie:bossCookie,body:{status:'completed'}})).statusCode,200);
 assert.equal((await call('/feedback',{method:'POST',cookie,body:{number,token:secret,rating:5,comment:'Rahmat'}})).statusCode,200);
 assert.equal((await call(`/cases/${id}`,{cookie})).data.case.feedback.rating,5);
 assert.equal((await call('/stats',{cookie:bossCookie})).data.stats.completed,1);
 assert.equal((await call('/notifications',{cookie:bossCookie})).statusCode,200);
 assert.equal((await call('/users',{cookie:bossCookie})).statusCode,200);
 const wrongChange=await call('/auth/password',{method:'POST',cookie,body:{currentPassword:'wrong-password',password:'new-client-password'}});
 assert.equal(wrongChange.statusCode,401);
 const changed=await call('/auth/password',{method:'POST',cookie,body:{currentPassword:'client-password',password:'new-client-password'}});
 assert.equal(changed.statusCode,200);
 assert.equal((await call('/auth/me',{cookie})).data.user,null);
 assert.equal((await call('/auth/login',{method:'POST',body:{login:'+998902222222',password:'client-password'}})).statusCode,401);
 assert.equal((await call('/auth/login',{method:'POST',body:{login:'+998902222222',password:'new-client-password'}})).statusCode,200);
 assert.equal((await call('/auth/logout',{method:'POST',body:{},cookie})).statusCode,200);
 assert.equal((await call('/auth/me',{cookie})).data.user,null);
});

test('coordinator clarifies the short request, clears a deadline and preserves audited history',async()=>{
 const boss=await call('/auth/login',{method:'POST',body:{login:'boss',password:'secure-password'}});
 const cookie=boss.headers['Set-Cookie'].split(';')[0];
 const created=await call('/requests',{method:'POST',body:{name:'Qarshi mijoz',phone:'55 406 77 55',region:'Qashqadaryo',category:'other',description:'Qaysi yordam kerakligini aniqlash',consent:true}});
 const id=created.data.case.id;
 assert.equal((await call('/auth/options',{cookie})).data.clarificationEnabled,true);
 const update=await call(`/cases/${id}`,{method:'PATCH',cookie,body:{category:'legal',preferredTime:'14:00 dan keyin',dueAt:'2027-01-01T10:00:00.000Z'}});
 assert.equal(update.statusCode,200);assert.equal(update.data.case.category,'legal');
 assert.equal(update.data.case.preferredTime,'14:00 dan keyin');
 assert.ok(update.data.case.history.some(h=>h.kind==='clarification'));
 const cleared=await call(`/cases/${id}`,{method:'PATCH',cookie,body:{dueAt:null}});
 assert.equal(cleared.statusCode,200);assert.equal(cleared.data.case.dueAt,null);
 assert.ok(cleared.data.case.history.some(h=>h.kind==='deadline'));
 // Upgrade is repeatable and does not remove the request or existing history.
 await pg.exec(await readFile('migrations/003_intake_clarification.sql','utf8'));
 assert.equal((await call(`/cases/${id}`,{cookie})).data.case.category,'legal');
});

test('public package names work with legacy storage and client counts cover more than one page',async()=>{
 const boss=await call('/auth/login',{method:'POST',body:{login:'boss',password:'secure-password'}});
 const cookie=boss.headers['Set-Cookie'].split(';')[0];
 const client=(await pg.query("SELECT id FROM users WHERE role='client' ORDER BY id LIMIT 1")).rows[0].id;
 const saved=await call('/packages',{method:'POST',cookie,body:{clientId:client,tier:'COMFORT',expiresAt:'2027-12-31T00:00:00.000Z',limit:5,members:['Test oila']}});
 assert.equal(saved.statusCode,200);assert.equal(saved.data.package.tier,'COMFORT');
 assert.equal((await pg.query('SELECT tier FROM packages WHERE client_id=$1',[client])).rows[0].tier,'Komfort');
 assert.equal((await call('/packages',{cookie})).data.packages.find(p=>p.clientId===client).tier,'COMFORT');
 await pg.query(`INSERT INTO cases(number,name,phone,region,category,description,client_id,tracking_token) SELECT 'ZAR-'||(800000+n)::text,'Count test','+998901234567','Qashqadaryo','other','Count across all pages',$1,encode(extensions.gen_random_bytes(32),'hex') FROM generate_series(1,55) n`,[client]);
 const clients=(await call('/clients',{cookie})).data.clients;
 const actual=Number((await pg.query('SELECT count(*) AS total FROM cases WHERE client_id=$1',[client])).rows[0].total);
 assert.equal(clients.find(c=>c.id===client).caseCount,actual);assert.ok(actual>50);
 const first=await call(`/cases?clientId=${client}&offset=0`,{cookie});
 const second=await call(`/cases?clientId=${client}&offset=50`,{cookie});
 assert.equal(first.data.hasMore,true);assert.ok(second.data.cases.length>0);
 assert.ok([...first.data.cases,...second.data.cases].every(c=>c.clientId===client));
});

test('staff usernames containing hyphens can sign in',async()=>{
 await pg.exec("INSERT INTO users(name,phone,login,password_hash,role) VALUES('QA operator','+998905555555','qa-operator',extensions.crypt('test-password',extensions.gen_salt('bf',4)),'operator')");
 const result=await call('/auth/login',{method:'POST',body:{login:'QA-Operator',password:'test-password'}});
 assert.equal(result.statusCode,200);assert.equal(result.data.user.login,'qa-operator');
});

test('customer requests, customer accounts and staff accounts remain separate',async()=>{
 const boss=await call('/auth/login',{method:'POST',body:{login:'boss',password:'secure-password'}});
 const cookie=boss.headers['Set-Cookie'].split(';')[0];
 const created=await call('/requests',{method:'POST',cookie,body:{name:'Separate customer',phone:'+998906666666',region:'Qashqadaryo',category:'other',description:'Customer needs help with documents',consent:true}});
 assert.equal(created.statusCode,200);
 const id=created.data.case.id;
 const detail=(await call(`/cases/${id}`,{cookie})).data.case;
 assert.equal(detail.name,'Separate customer');assert.equal(detail.clientId,null);
 const clients=(await call('/clients',{cookie})).data.clients;
 assert.ok(clients.every(u=>u.role==='client'));
 assert.ok(!clients.some(u=>u.id===boss.data.user.id));
 const staff=(await call('/users',{cookie})).data.users;
 assert.ok(staff.every(u=>['director','operator','partner'].includes(u.role)));
 const team=(await call('/team',{cookie})).data.users;
 assert.ok(team.every(u=>['director','operator'].includes(u.role)));
 const assigned=await call(`/cases/${id}`,{method:'PATCH',cookie,body:{coordinatorId:boss.data.user.id}});
 assert.equal(assigned.statusCode,200);assert.equal(assigned.data.case.coordinatorRole,'director');
 assert.equal(assigned.data.case.name,'Separate customer');
 const customer=await call('/auth/login',{method:'POST',body:{login:'+998902222222',password:'new-client-password'}});
 const customerCookie=customer.headers['Set-Cookie'].split(';')[0];
 for(const path of ['/users','/clients','/team','/stats'])assert.equal((await call(path,{cookie:customerCookie})).statusCode,403);
 assert.equal((await call(`/cases/${id}`,{cookie:customerCookie})).statusCode,404);
});

test('staff notification feed includes audited activity without exposing internal note text',async()=>{
 const boss=await call('/auth/login',{method:'POST',body:{login:'boss',password:'secure-password'}});
 const cookie=boss.headers['Set-Cookie'].split(';')[0];
 const created=await call('/requests',{method:'POST',cookie,body:{name:'Notification customer',phone:'+998907777777',region:'Qashqadaryo',category:'other',description:'Notification activity test',consent:true}});
 const id=created.data.case.id;
 const changed=await call(`/cases/${id}`,{method:'PATCH',cookie,body:{coordinatorId:boss.data.user.id,dueAt:'2027-01-02T10:00:00.000Z',category:'legal',note:'PRIVATE NOTE MUST NOT ENTER FEED'}});
 assert.equal(changed.statusCode,200);
 const feed=await call('/notifications',{cookie});assert.equal(feed.statusCode,200);
 const activity=feed.data.notifications.filter(n=>n.case_id===id&&n.source==='internal');
 assert.deepEqual(new Set(activity.map(n=>n.event)),new Set(['case.assignment_changed','case.deadline_changed','case.clarified']));
 assert.ok(activity.every(n=>n.status==='recorded'&&n.caseNumber===created.data.case.number));
 assert.ok(!JSON.stringify(feed.data).includes('PRIVATE NOTE MUST NOT ENTER FEED'));
});
