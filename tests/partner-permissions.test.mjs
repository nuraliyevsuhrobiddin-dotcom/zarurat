import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler,formatCase} from '../server/api.mjs';
import {createSession} from '../server/security.mjs';
import {testDatabase} from './helpers/database.mjs';

let pg,db,handler,first,other,unassigned,ownService,otherService,unassignedService;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'role-audit-secret',FEATURE_STAGE2:'true'};
const cookies={};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(await readFile('migrations/002_accounts_notifications.sql','utf8'));
 const upgrade=await readFile('migrations/013_partner_service_permissions.sql','utf8');
 await pg.exec(upgrade);await pg.exec(upgrade);
 await pg.exec(`INSERT INTO partners(name,phone,address,category,hours,region,price,contract_status) VALUES
 ('Partner A','+998901111111','Qarshi','legal','09-18','Qashqadaryo',0,'active'),('Partner B','+998901111112','Qarshi','legal','09-18','Qashqadaryo',0,'active');
 INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES
 ('director','Director','+998902222221',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'director',NULL),
 ('operator','Operator','+998902222222',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'operator',NULL),
 ('client','Client','+998902222223',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client',NULL),
 ('partner','Partner','+998902222224',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'partner',1),
 ('other','Other partner','+998902222225',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'partner',2),
 ('orphan','Unlinked partner','+998902222226',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'partner',NULL);`);
 db=testDatabase(pg);handler=createHandler({db,env});
 for(const u of (await pg.query('SELECT id,login FROM users')).rows)cookies[u.login]='zar_session='+await createSession(u,'audit-password',db,env);
 async function make(){return(await db('rpc/zar_create_request',{method:'POST',body:{p_input:{name:'Client',phone:'+998902222223',region:'Qashqadaryo',category:'legal',description:'Private case details',preferred_time:'Istalgan vaqt',attachments:[]},p_user_id:3}})).case.id;}
 first=await make();other=await make();unassigned=await make();
 await pg.query("SELECT zar_add_service($1,'Own service',1,100,2)",[first]);
 await pg.query("SELECT zar_add_service($1,'Another partner service',2,200,2)",[first]);
 await pg.query("SELECT zar_add_service($1,'Other case service',2,200,2)",[other]);
 await pg.query("SELECT zar_add_service($1,'Unassigned service',NULL,0,2)",[unassigned]);
 const services=(await pg.query('SELECT id,case_id,partner_id FROM services ORDER BY id')).rows;
 ownService=services[0].id;otherService=services[1].id;unassignedService=services[3].id;
 await pg.query("INSERT INTO history(case_id,kind,message,actor_name)VALUES($1,'note','Internal coordinator secret','Operator')",[first]);
});
after(async()=>await pg?.close());
async function call(path,role='partner',body,method=body?'PATCH':'GET'){
 const req={url:'/api'+path,method,body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(role?{cookie:cookies[role]}:{})},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.data=JSON.parse(value);}};
 await handler(req,res);return res;
}
test('partner sees only own assigned cases/services and cannot use coordinator directories',async()=>{
 const result=await call('/cases');assert.equal(result.statusCode,200);
 assert.deepEqual(result.data.cases.map(c=>c.id),[first]);
 const c=(await call('/cases/'+first)).data.case;
 assert.deepEqual(c.services.map(s=>s.id),[ownService]);
 assert.deepEqual(c.history,[]);assert.deepEqual(c.attachments,[]);assert.equal(c.trackingToken,undefined);assert.equal(c.subscription,undefined);
 assert.equal((await call('/cases/'+other)).statusCode,404);
 for(const route of ['/partners','/partners/1','/clients','/team','/users','/stats','/notifications','/packages','/payments','/files/1'])assert.equal((await call(route)).statusCode,403,route);
 assert.equal((await call('/cases/'+first,'partner',{status:'completed'})).statusCode,403);
 assert.equal((await call('/cases/'+first+'/services','partner',{title:'Forged service',partnerId:1},'POST')).statusCode,403);
});

test('account profile returns only the authenticated partner organization',async()=>{
 const own=await call('/account?partnerId=2');
 assert.equal(own.statusCode,200);assert.equal(own.data.partner.id,1);
 assert.equal(own.data.partner.name,'Partner A');
 assert.deepEqual(Object.keys(own.data.partner).sort(),['id','name','phone','address','category','hours','region','contractStatus'].sort());
 assert.equal((await call('/account','other')).data.partner.id,2);
 assert.equal((await call('/account','orphan')).data.partner,null);
 for(const role of ['client','operator','director'])assert.equal('partner' in (await call('/account',role)).data,false);
 assert.equal((await call('/account',null)).statusCode,401);
});
test('unlinked partners cannot view or mutate unassigned work through HTTP or SQL',async()=>{
 assert.equal((await call('/cases','orphan')).data.cases.length,0);
 assert.equal((await call('/cases/'+unassigned,'orphan')).statusCode,404);
 assert.equal((await call('/services/'+unassignedService,'orphan',{status:'accepted'})).statusCode,403);
 await assert.rejects(pg.query("SELECT zar_update_service($1,'accepted',NULL,false,6)",[unassignedService]),/Ruxsat/);
 assert.deepEqual(formatCase({services:[{partner_id:null}],history:[]},{role:'partner',partner_id:null}).services,[]);
});

test('coordinator partner directory exposes readiness without partner logins or passwords',async()=>{
 const response=await call('/partners','operator');
 assert.equal(response.statusCode,200);
 assert.equal(response.data.partners.find(p=>p.id===1).accountStatus,'active');
 for(const p of response.data.partners){
  assert.equal('login' in p,false);assert.equal('password_hash' in p,false);assert.equal('users' in p,false);
 }
});
test('partner progresses own service; coordinator retains case completion and reassignment authority',async()=>{
 assert.equal((await call('/services/'+otherService,'partner',{status:'accepted'})).statusCode,400);
 assert.equal((await call('/services/'+ownService,'partner',{status:'accepted',partnerId:2})).statusCode,403);
 assert.equal((await call('/services/'+ownService,'partner',{status:'completed'})).statusCode,400);
 for(const status of ['accepted','contacted','delivered','completed'])assert.equal((await call('/services/'+ownService,'partner',{status})).statusCode,200,status);
 // Own service is completed even though the coordinator case is still received.
 const done=await call('/cases?serviceStatus=completed');assert.equal(done.data.cases.length,1);
 assert.equal(done.data.cases[0].status,'received');assert.equal(done.data.cases[0].services[0].status,'completed');
 assert.equal((await call('/cases?serviceStatus=pending')).data.cases.length,0);
 assert.equal((await call('/cases/'+first,'operator',{status:'completed'})).statusCode,400);
 assert.equal((await call('/services/'+otherService,'operator',{status:'completed'})).statusCode,200);
 assert.equal((await call('/cases/'+first,'operator',{status:'completed'})).statusCode,200);
 assert.equal((await call('/services/'+ownService,'partner',{status:'accepted'})).statusCode,400);
 for(const route of ['/partners','/clients','/team','/stats','/notifications','/packages','/payments'])assert.equal((await call(route,'operator')).statusCode,200,route);
 assert.equal((await call('/users','operator')).statusCode,403);
});
test('database service mutation rejects blocked partner and coordinator identities',async()=>{
 await pg.exec('UPDATE users SET blocked_at=now() WHERE id IN (2,5)');
 await assert.rejects(pg.query("SELECT zar_update_service($1,'accepted',NULL,false,5)",[unassignedService]),/Ruxsat/);
 await assert.rejects(pg.query("SELECT zar_update_service($1,'cancelled',NULL,false,2)",[unassignedService]),/Ruxsat/);
 assert.equal((await call('/cases','operator')).statusCode,401);
 const directory=await call('/partners','director');
 assert.equal(directory.data.partners.find(p=>p.id===2).accountStatus,'blocked');
});
