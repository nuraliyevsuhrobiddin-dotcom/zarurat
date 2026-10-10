import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

let db;
before(async()=>{
 db=new PGlite({extensions:{pgcrypto}});
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 const schema=await readFile('supabase-schema.sql','utf8');
 await db.exec(schema);
 await db.exec(await readFile('migrations/001_secure_server.sql','utf8'));
 await db.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES('boss','Rahbar','+998901111111',extensions.crypt('secure-password',extensions.gen_salt('bf',4)),'director');`);
});
after(async()=>{await db?.close();});

test('anonymous users cannot read tables or call server RPC',async()=>{
 for(const table of ['users','cases','attachments','sessions','history']){
  const {rows}=await db.query(`SELECT has_table_privilege('anon',$1,'SELECT') AS allowed`,[table]);
  assert.equal(rows[0].allowed,false);
 }
 const {rows}=await db.query(`SELECT has_function_privilege('anon','zar_login(text,text)','EXECUTE') AS allowed`);
 assert.equal(rows[0].allowed,false);
 const rls=await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='cases'`);
 assert.equal(rls.rows[0].relrowsecurity,true);
});

test('password auth hashes passwords and public registration never creates director',async()=>{
 const created=await db.query(`SELECT zar_create_user('Mijoz','+998902222222','+998902222222','long-password','client',null) AS u`);
 assert.equal(created.rows[0].u.role,'client');
 assert.equal(created.rows[0].u.password_hash,undefined);
 const login=await db.query(`SELECT zar_login('+998902222222','long-password') AS u`);
 assert.equal(login.rows[0].u.name,'Mijoz');
 const wrong=await db.query(`SELECT zar_login('+998902222222','wrong') AS u`);
 assert.equal(wrong.rows[0].u,null);
 await assert.rejects(db.query(`SELECT zar_create_user('Bad','+998903333333','bad','long-password','director',null)`));
});

test('request creation is atomic, numbered and enqueues notification',async()=>{
 const input={name:'Test odam',phone:'+998904444444',region:'Toshkent shahri',category:'legal',description:'Huquqiy yordam zarur',preferred_time:'Istalgan vaqt',attachments:[]};
 const result=await db.query('SELECT zar_create_request($1::jsonb,2) AS result',[JSON.stringify(input)]);
 assert.match(result.rows[0].result.case.number,/^ZAR-\d{6,}$/);
 assert.equal(result.rows[0].result.trackingToken.length,64);
 const before=(await db.query('SELECT count(*) AS n FROM cases')).rows[0].n;
 await assert.rejects(db.query('SELECT zar_create_request($1::jsonb,2)',[JSON.stringify({...input,attachments:[{name:'broken',type:'application/pdf',data:'AA=='}]})]));
 assert.equal((await db.query('SELECT count(*) AS n FROM cases')).rows[0].n,before);
 assert.equal((await db.query('SELECT count(*) AS n FROM notifications')).rows[0].n,1);
});

test('case completion and cancellation enforce business rules',async()=>{
 await assert.rejects(db.query(`SELECT zar_update_case(1,'{"status":"completed"}',1)`));
 await assert.rejects(db.query(`SELECT zar_update_case(1,'{"status":"cancelled"}',1)`));
 await db.exec(`INSERT INTO partners(name,phone,address,category,hours,region) VALUES('Hamkor','+998905555555','Manzil','legal','09–18','Toshkent shahri');`);
 await db.query(`SELECT zar_add_service(1,'Maslahat',1,0,1)`);
 await assert.rejects(db.query(`SELECT zar_update_case(1,'{"status":"completed"}',1)`));
 await db.query(`SELECT zar_update_service(1,'completed',null,false,1)`);
 await db.query(`SELECT zar_update_case(1,'{"status":"completed"}',1)`);
 await assert.rejects(db.query(`SELECT zar_update_case(1,'{"status":"received"}',1)`));
});

test('partner can only advance their assigned service one step',async()=>{
 await db.exec(`INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES('partner','Hamkor xodimi','+998906666666','unused','partner',1);`);
 const input={name:'Yana mijoz',phone:'+998907777777',region:'Toshkent shahri',category:'legal',description:'Yangi murojaat tavsifi',preferred_time:'Istalgan vaqt',attachments:[]};
 const result=(await db.query('SELECT zar_create_request($1::jsonb,2) AS r',[JSON.stringify(input)])).rows[0].r;
 await db.query('SELECT zar_add_service($1,$2,1,0,1)',[result.case.id,'Ikkinchi xizmat']);
 const id=(await db.query('SELECT id FROM services WHERE case_id=$1',[result.case.id])).rows[0].id;
 await assert.rejects(db.query(`SELECT zar_update_service($1,'completed',null,false,3)`,[id]));
 await assert.rejects(db.query(`SELECT zar_update_service($1,'accepted',1,true,3)`,[id]));
 await db.query(`SELECT zar_update_service($1,'accepted',null,false,3)`,[id]);
});

test('package use checks completion, expiry, client and remaining limit',async()=>{
 await db.query(`SELECT zar_save_package(2,'Start',now()+interval '1 year',1,'["Mijoz"]')`);
 await db.query('SELECT zar_use_package(1,1,1)');
 await assert.rejects(db.query('SELECT zar_use_package(1,1,1)'));
 await assert.rejects(db.query(`SELECT zar_save_package(2,'Start',now()+interval '1 year',0,'[]')`));
 const stats=(await db.query('SELECT zar_stats() AS s')).rows[0].s;
 assert.equal(stats.total,2);
 assert.equal(stats.completed,1);
 assert.equal(stats.activePackagesCount,0);
});

test('rate limiting persists attempts and denies excess',async()=>{
 for(let i=0;i<3;i++)assert.equal((await db.query(`SELECT zar_rate_limit('test',3,900) AS ok`)).rows[0].ok,true);
 assert.equal((await db.query(`SELECT zar_rate_limit('test',3,900) AS ok`)).rows[0].ok,false);
});

test('server service_role can access pgcrypto and run the secured RPC',async()=>{
 await db.exec('SET ROLE service_role;');
 try{
  const result=await db.query(`SELECT zar_login('boss','secure-password') AS u`);
  assert.equal(result.rows[0].u.role,'director');
  assert.equal((await db.query(`SELECT zar_rate_limit('service-role-test',3,900) AS ok`)).rows[0].ok,true);
 }finally{await db.exec('RESET ROLE;');}
});

test('legacy upgrade preserves account IDs, roles and records, hashes passwords once',async()=>{
 const legacy=new PGlite({extensions:{pgcrypto}});
 try{
  await legacy.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  const schema=await readFile('supabase-schema.sql','utf8');
  await legacy.exec(schema.split('-- Apply to the existing')[0]);
  await legacy.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES('legacy','Existing boss','+998 90 999 99 99','old-password','director');`);
  const migration=await readFile('migrations/001_secure_server.sql','utf8');
  await legacy.exec(migration);
  const first=(await legacy.query(`SELECT * FROM users WHERE id=1`)).rows[0];
  assert.equal(first.role,'director');assert.notEqual(first.password_hash,'old-password');
  assert.equal((await legacy.query(`SELECT zar_login('legacy','old-password') AS u`)).rows[0].u.id,1);
  assert.equal((await legacy.query(`SELECT zar_login('+998909999999','old-password') AS u`)).rows[0].u.id,1);
  await legacy.exec(migration);
  assert.equal((await legacy.query(`SELECT password_hash FROM users WHERE id=1`)).rows[0].password_hash,first.password_hash);
 }finally{await legacy.close();}
});
