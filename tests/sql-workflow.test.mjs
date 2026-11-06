import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {testDatabase} from './helpers/database.mjs';

let pg,handler;
const env={PUBLIC_ORIGIN:'https://sql-test.example',SESSION_SECRET:'sql-workflow-only-test-secret',FEATURE_STAGE2:'true'};
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 for(const file of (await readdir('migrations')).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await pg.exec(await readFile('migrations/'+file,'utf8'));
 await pg.exec(`INSERT INTO partners(name,phone,address,category,hours,region,contract_status) VALUES
 ('Active partner','+998908000001','QA Qarshi','legal','24/7','Qashqadaryo','active'),
 ('Pending partner','+998908000002','QA Qarshi','legal','24/7','Qashqadaryo','pending');
 INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES
 ('sql-boss','Boss','+998908000003',extensions.crypt('sql-password-2026',extensions.gen_salt('bf',4)),'director',null),
 ('sql-operator','Operator','+998908000004','unused','operator',null),
 ('sql-client','Client','+998908000005','unused','client',null),
 ('sql-partner','Partner','+998908000006','unused','partner',1),
 ('sql-blocked','Blocked','+998908000007','unused','operator',null);
 UPDATE users SET blocked_at=now() WHERE id=5;`);
 handler=createHandler({db:testDatabase(pg),env});
});
after(async()=>{await pg?.close();});
async function value(sql,args=[]){return (await pg.query(sql,args)).rows[0].r;}
async function create(clientId=3,extra={}){
 return value('SELECT zar_create_request($1::jsonb,$2) AS r',[JSON.stringify({name:'SQL QA client',phone:'+998908000005',region:'Qashqadaryo',category:'legal',description:'SQL workflow verification request',preferred_time:'Istalgan vaqt',attachments:[],...extra}),clientId]);
}
async function call(path,{method='GET',body,cookie}={}){
 const req={url:'/api'+path,method,body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',...(cookie?{cookie}:{})},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.data=JSON.parse(s);}};
 await handler(req,res);return res;
}

test('all SQL migrations execute; request, assignment, partner steps, notifications and package persist together',async()=>{
 assert.equal(await value('SELECT zar_assignment_ready() AS r'),true);
 const created=await create(),id=created.case.id;
 assert.equal(await value('SELECT count(*)::int AS r FROM notifications WHERE case_id=$1 AND event=\'request.created\'',[id]),1);
 await pg.query('SELECT zar_update_case($1,$2::jsonb,1)',[id,JSON.stringify({coordinator_id:2,status:'reviewing',note:'PRIVATE SQL NOTE'})]);
 assert.equal(await value('SELECT coordinator_id::int AS r FROM cases WHERE id=$1',[id]),2);
 await assert.rejects(pg.query('SELECT zar_add_service($1,$2,2,0,2)',[id,'Pending must fail']),/faol shartnomali/);
 assert.equal(await value('SELECT count(*)::int AS r FROM services WHERE case_id=$1',[id]),0);
 await pg.query('SELECT zar_add_service($1,$2,1,0,2)',[id,'Legal service']);
 const sid=await value('SELECT id AS r FROM services WHERE case_id=$1',[id]);
 await assert.rejects(pg.query('SELECT zar_update_case($1,$2::jsonb,2)',[id,'{"status":"completed"}']),/Avval barcha/);
 await assert.rejects(pg.query('SELECT zar_update_service($1,$2,null,false,4)',[sid,'completed']),/Keyingi bosqich/);
 for(const status of ['accepted','contacted','delivered','completed'])await pg.query('SELECT zar_update_service($1,$2,null,false,4)',[sid,status]);
 await pg.query('SELECT zar_update_case($1,$2::jsonb,2)',[id,'{"status":"completed"}']);
 assert.equal(await value('SELECT status AS r FROM cases WHERE id=$1',[id]),'completed');
 assert.equal(await value('SELECT count(*)::int AS r FROM notifications WHERE case_id=$1',[id]),8);
 assert.equal(await value('SELECT count(*)::int AS r FROM history WHERE case_id=$1 AND kind=\'note\'',[id]),1);
 const p=await value(`SELECT zar_save_package(3,'Komfort',now()+interval '1 year',1,'["SQL client"]') AS r`);
 await pg.query('SELECT zar_use_package($1,$2,2)',[p.id,id]);
 await assert.rejects(pg.query('SELECT zar_use_package($1,$2,2)',[p.id,id]));
 assert.equal(await value('SELECT count(*)::int AS r FROM package_usage WHERE package_id=$1',[p.id]),1);
});

test('SQL rejects new blocked coordinator assignments and blocked actors without partial writes',async()=>{
 const {case:c}=await create();
 const before=await value('SELECT count(*)::int AS r FROM history WHERE case_id=$1',[c.id]);
 await assert.rejects(pg.query('SELECT zar_update_case($1,$2::jsonb,1)',[c.id,'{"coordinator_id":5,"note":"must rollback"}']),/Faol koordinatorni tanlang/);
 assert.equal(await value('SELECT coordinator_id AS r FROM cases WHERE id=$1',[c.id]),null);
 assert.equal(await value('SELECT count(*)::int AS r FROM history WHERE case_id=$1',[c.id]),before);
 await assert.rejects(pg.query('SELECT zar_update_case($1,$2::jsonb,5)',[c.id,'{"status":"reviewing"}']),/Ruxsat yo‘q/);
 await pg.query('SELECT zar_update_case($1,$2::jsonb,1)',[c.id,'{"coordinator_id":2}']);
 await pg.exec('UPDATE users SET blocked_at=now() WHERE id=2');
 try{
  await pg.query('SELECT zar_update_case($1,$2::jsonb,1)',[c.id,'{"coordinator_id":2,"note":"Existing assignment history preserved"}']);
  await pg.query('SELECT zar_update_case($1,$2::jsonb,1)',[c.id,'{"coordinator_id":1}']);
  assert.equal(await value('SELECT coordinator_id::int AS r FROM cases WHERE id=$1',[c.id]),1);
 }finally{await pg.exec('UPDATE users SET blocked_at=null WHERE id=2');}
});

test('team excludes blocked staff and API cannot assign them, including Telegram-only configuration',async()=>{
 const login=await call('/auth/login',{method:'POST',body:{login:'sql-boss',password:'sql-password-2026'}});
 assert.equal(login.statusCode,200);const cookie=login.headers['Set-Cookie'].split(';')[0];
 const team=await call('/team',{cookie});assert.equal(team.statusCode,200);
 assert.ok(team.data.users.some(u=>u.id===2));assert.ok(!team.data.users.some(u=>u.id===5));
 const c=await create();
 assert.equal((await call('/cases/'+c.case.id,{method:'PATCH',cookie,body:{coordinatorId:5}})).statusCode,400);
 const original=handler;
 try{
  handler=createHandler({db:testDatabase(pg),env:{...env,FEATURE_STAGE2:'false',FEATURE_TELEGRAM:'true',TELEGRAM_BOT_TOKEN:'qa-only',TELEGRAM_WEBHOOK_SECRET:'qa-only'}});
  assert.ok(!(await call('/team',{cookie})).data.users.some(u=>u.id===5));
 }finally{handler=original;}
});

test('invalid request attachment rolls back case, history and notification SQL writes',async()=>{
 const counts=async()=> (await pg.query('SELECT (SELECT count(*) FROM cases) AS cases,(SELECT count(*) FROM history) AS history,(SELECT count(*) FROM notifications) AS notifications')).rows[0];
 const before=await counts();
 await assert.rejects(create(3,{attachments:[{name:'bad.pdf',type:'application/pdf',data:'AA=='}]}));
 assert.deepEqual(await counts(),before);
});

test('migration 011 is repeatable, preserves records and restricts RPC to server role',async()=>{
 const before=(await pg.query('SELECT id,coordinator_id,status FROM cases ORDER BY id')).rows;
 for(let i=0;i<2;i++)await pg.exec(await readFile('migrations/011_active_coordinator_assignment.sql','utf8'));
 assert.deepEqual((await pg.query('SELECT id,coordinator_id,status FROM cases ORDER BY id')).rows,before);
 assert.equal(await value('SELECT zar_assignment_ready() AS r'),true);
 for(const role of ['anon','authenticated']){
  assert.equal(await value('SELECT has_function_privilege($1,\'zar_update_case(bigint,jsonb,bigint)\',\'EXECUTE\') AS r',[role]),false);
  assert.equal(await value('SELECT has_function_privilege($1,\'zar_assignment_ready()\',\'EXECUTE\') AS r',[role]),false);
 }
 assert.equal(await value('SELECT has_function_privilege(\'service_role\',\'zar_update_case(bigint,jsonb,bigint)\',\'EXECUTE\') AS r'),true);
});
