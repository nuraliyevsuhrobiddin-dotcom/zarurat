import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encryptBackup,decryptBackup,runBackup} from '../server/backup.mjs';
import {requireJob} from '../server/jobs.mjs';
const secret='e'.repeat(64);
test('backup encryption authenticates content, key and random nonce',()=>{
 const value={tables:{users:[{id:1,password_hash:'test-only'}]}};
 const first=encryptBackup(value,secret),second=encryptBackup(value,secret);
 assert.ok(!first.equals(second));assert.deepEqual(decryptBackup(first,secret),value);
 assert.ok(!first.includes(Buffer.from('test-only')));
 assert.throws(()=>decryptBackup(first,'f'.repeat(64)));
 const corrupted=Buffer.from(first);corrupted[40]^=1;assert.throws(()=>decryptBackup(corrupted,secret));
});
test('backup refuses public storage and never uploads plaintext',async()=>{
 let uploaded;
 const fetcher=async(url,opts)=>{
  if(url.includes('/bucket/'))return Response.json({public:false});
  if(url.includes('/object/info/'))return new Response('',{status:404});
  if(url.includes('/rest/v1/'))return Response.json([{id:1,created_at:'2026-01-01',name:'Test fixture'}]);
  if(url.includes('/object/')){uploaded=opts.body;return Response.json({ok:true});}
  throw new Error('Unexpected URL');
 };
 const env={BACKUP_ENCRYPTION_KEY:secret,SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-key'};
 const result=await runBackup(env,{fetcher,now:new Date('2026-10-10T01:00:00Z')});
 assert.equal(result.ok,true);assert.ok(Buffer.isBuffer(uploaded));
 assert.equal(decryptBackup(uploaded,secret).tables.cases.length,1);
 await assert.rejects(runBackup(env,{fetcher:async()=>Response.json({public:true})}));
});
test('daily backup is idempotent and unauthenticated jobs are rejected',async()=>{
 const result=await runBackup({BACKUP_ENCRYPTION_KEY:secret,SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake'}, {fetcher:async url=>url.includes('/bucket/')?Response.json({public:false}):Response.json({exists:true})});
 assert.equal(result.alreadyExists,true);
 assert.throws(()=>requireJob({headers:{}},{CRON_SECRET:'secret'}));
 assert.doesNotThrow(()=>requireJob({headers:{authorization:'Bearer secret'}},{CRON_SECRET:'secret'}));
});
test('Supabase HTTP400 missing-bucket response creates a private bucket before upload',async()=>{
 let created=false;
 const fetcher=async(url,opts)=>{
  if(url.endsWith('/bucket')&&opts.method==='POST'){assert.equal(JSON.parse(opts.body).public,false);created=true;return Response.json({});}
  if(url.includes('/bucket/'))return created?Response.json({public:false}):Response.json({statusCode:'404',error:'Bucket not found'},{status:400});
  if(url.includes('/object/info/'))return Response.json({});
  throw new Error('Unexpected request');
 };
 const result=await runBackup({BACKUP_ENCRYPTION_KEY:secret,SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'fake'},{fetcher});
 assert.equal(created,true);assert.equal(result.alreadyExists,true);
});
