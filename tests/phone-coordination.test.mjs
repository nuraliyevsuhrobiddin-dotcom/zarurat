import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {createSession} from '../server/security.mjs';
import {testDatabase} from './helpers/database.mjs';

// Coordinators phone every new request and arrange partners by phone.
// Partners keep a directory entry but no longer sign in or accept assigned work.
let pg,db,handler,first,legacy;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'phone-coordination-secret',FEATURE_STAGE2:'true'};
const cookies={};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(await readFile('migrations/002_accounts_notifications.sql','utf8'));
 await pg.exec(await readFile('migrations/013_partner_service_permissions.sql','utf8'));
 await pg.exec(await readFile('migrations/016_phone_coordination.sql','utf8'));
 await pg.exec(`INSERT INTO partners(name,phone,address,category,hours,region,price,contract_status) VALUES
 ('Partner A','+998901111111','Qarshi','legal','09-18','Qashqadaryo',0,'active');
 INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES
 ('director','Director','+998902222221',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'director',NULL),
 ('operator','Operator','+998902222222',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'operator',NULL),
 ('client','Client','+998902222223',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'client',NULL),
 ('partner','Partner','+998902222224',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'partner',1);`);
 db=testDatabase(pg);handler=createHandler({db,env});
 for(const u of (await pg.query('SELECT id,login FROM users')).rows)cookies[u.login]='zar_session='+await createSession(u,'audit-password',db,env);
 async function make(){return(await db('rpc/zar_create_request',{method:'POST',body:{p_input:{name:'Client',phone:'+998902222223',region:'Qashqadaryo',category:'legal',description:'Private case details',preferred_time:'Istalgan vaqt',attachments:[]},p_user_id:3}})).case.id;}
 first=await make();legacy=await make();
 await pg.query("SELECT zar_add_service($1,'Old partner service',1,100,2)",[legacy]);
});
after(async()=>await pg?.close());
async function call(path,role,body,method=body?'PATCH':'GET'){
 const req={url:'/api'+path,method,body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(role?{cookie:cookies[role]}:{})},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.data=JSON.parse(value);}};
 await handler(req,res);return res;
}

test('partner accounts cannot sign in and their old sessions are no longer accepted',async()=>{
 const login=await call('/auth/login',null,{login:'partner',password:'audit-password'},'POST');
 assert.equal(login.statusCode,403);assert.match(login.data.error,/telefon orqali/);
 assert.equal(login.headers['Set-Cookie'],undefined);
 for(const route of ['/cases','/cases/'+first,'/account','/partners'])assert.equal((await call(route,'partner')).statusCode,401,route);
 assert.equal((await call('/auth/me','partner')).data.user,null);
 assert.equal((await call('/auth/login',null,{login:'operator',password:'audit-password'},'POST')).statusCode,200);
});

test('coordinator closes a phoned request without assigning any partner',async()=>{
 const contacted=await call('/cases/'+first,'operator',{status:'reviewing',coordinatorId:2});
 assert.equal(contacted.statusCode,200);assert.equal(contacted.data.case.coordinatorId,2);
 const closed=await call('/cases/'+first,'operator',{status:'completed',note:'Advokat bilan telefon orqali kelishildi'});
 assert.equal(closed.statusCode,200);assert.equal(closed.data.case.status,'completed');assert.deepEqual(closed.data.case.services,[]);
 assert.ok(closed.data.case.history.some(h=>h.kind==='note'&&/telefon/.test(h.message)));
 const customer=(await call('/cases/'+first,'client')).data.case;
 assert.equal(customer.status,'completed');assert.ok(!customer.history.some(h=>h.kind==='note'));
});

test('an older request with an unfinished partner service can still be closed',async()=>{
 const closed=await call('/cases/'+legacy,'operator',{status:'completed'});
 assert.equal(closed.statusCode,200);
 assert.deepEqual(closed.data.case.services.map(s=>s.status),['completed']);
});

test('partner assignment endpoints and partner staff accounts are gone',async()=>{
 assert.equal((await call('/cases/'+legacy+'/services','operator',{title:'Forged',partnerId:1},'POST')).statusCode,404);
 assert.equal((await call('/services/1','operator',{status:'accepted'})).statusCode,404);
 const users=await call('/users','director');assert.equal(users.statusCode,200);
 assert.ok(users.data.users.every(u=>['director','operator'].includes(u.role)));
 const partnerAccount=await call('/users','director',{name:'New partner',phone:'+998903333333',login:'new-partner',password:'audit-password-2026',role:'partner',partnerId:1},'POST');
 assert.equal(partnerAccount.statusCode,400);
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM users WHERE login='new-partner'")).rows[0].n,0);
 const coordinator=await call('/users','director',{name:'New coordinator',phone:'+998903333334',login:'new-coordinator',password:'audit-password-2026'},'POST');
 assert.equal(coordinator.statusCode,200);assert.equal(coordinator.data.user.role,'operator');
 assert.equal((await call('/users/4/password','director',{currentPassword:'audit-password',password:'another-password-2026'},'POST')).statusCode,404);
});

test('coordinators keep the partner phone directory without account details',async()=>{
 const response=await call('/partners','operator');
 assert.equal(response.statusCode,200);
 const partner=response.data.partners.find(p=>p.id===1);
 assert.equal(partner.phone,'+998901111111');assert.equal(partner.contractStatus,'active');
 for(const p of response.data.partners){for(const key of ['accountStatus','login','password_hash','users'])assert.equal(key in p,false,key);}
 assert.equal((await call('/partners','client')).statusCode,403);
});
