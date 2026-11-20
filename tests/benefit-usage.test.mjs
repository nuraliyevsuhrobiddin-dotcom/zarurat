import{test,before,after}from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{PGlite}from'@electric-sql/pglite';
import{pgcrypto}from'@electric-sql/pglite/contrib/pgcrypto';
import{testDatabase}from'./helpers/database.mjs';
import{requireUnusedBenefit}from'../server/benefit-usage.mjs';
let pg,db;
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 const migration=await readFile('migrations/012_single_benefit.sql','utf8');await pg.exec(migration);await pg.exec(migration);
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role)VALUES('qa-boss','QA Boss','+998901234567','qa-only','director'),('qa-client','QA Family','+998901234568','qa-only','client');
 SELECT zar_save_package(2,'Start',now()+interval '1 month',10,'["QA Family"]');
 INSERT INTO payment_orders(client_id,tier,amount,members,terms,mode,status)VALUES(2,'PREMIUM',39900000,'["QA Family"]','{"legalConsultations":4}','live','paid');
 INSERT INTO family_subscriptions(order_id,client_id,tier,mode,members,terms,starts_at,expires_at)SELECT id,client_id,tier,mode,members,terms,now()-interval '1 day',now()+interval '1 month' FROM payment_orders;`);
 db=testDatabase(pg);
});
after(async()=>await pg?.close());
async function completedCase(){const result=await db('rpc/zar_create_request',{method:'POST',body:{p_input:{name:'QA Family',phone:'+998901234568',region:'Qashqadaryo',category:'legal',description:'QA family consultation',preferred_time:'Istalgan vaqt',attachments:[]},p_user_id:2}});await pg.query("UPDATE cases SET status='completed' WHERE id=$1",[result.case.id]);return result.case.id;}
test('one case cannot consume paid and manual benefits in either order',async()=>{
 const a=await completedCase();await requireUnusedBenefit(db,a);
 await pg.query("SELECT zar_use_subscription(1,$1,'legal',1)",[a]);
 await assert.rejects(requireUnusedBenefit(db,a),/allaqachon/);
 await assert.rejects(pg.query('SELECT zar_use_package(1,$1,1)',[a]),/allaqachon obunadan/);
 const b=await completedCase();await pg.query('SELECT zar_use_package(1,$1,1)',[b]);
 await assert.rejects(pg.query("SELECT zar_use_subscription(1,$1,'legal',1)",[b]),/allaqachon qo‘lda/);
 assert.equal(Number((await pg.query('SELECT count(*) AS n FROM subscription_usage')).rows[0].n),1);
 assert.equal(Number((await pg.query('SELECT count(*) AS n FROM package_usage')).rows[0].n),1);
});
test('trigger blocks direct cross-source inserts and keeps existing records',async()=>{
 await pg.exec(await readFile('migrations/012_single_benefit.sql','utf8'));
 assert.equal((await pg.query('SELECT zar_benefit_ready() AS ready')).rows[0].ready,true);
 const used=(await pg.query('SELECT case_id FROM subscription_usage LIMIT 1')).rows[0].case_id;
 await assert.rejects(pg.query('INSERT INTO package_usage(package_id,case_id)VALUES(1,$1)',[used]),/allaqachon/);
 const blocked=(await pg.query("SELECT has_function_privilege('anon','zar_single_benefit()','EXECUTE') AS allowed")).rows[0];assert.equal(blocked.allowed,false);
});
