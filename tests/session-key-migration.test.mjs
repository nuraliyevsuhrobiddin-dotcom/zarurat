import{test}from'node:test';
import assert from'node:assert/strict';
import{currentUser,sessionSignature}from'../server/security.mjs';
const value='a'.repeat(64),user={id:3,name:'QA Client',role:'client',password_hash:'hash-v1'};
const legacy={SUPABASE_SERVICE_ROLE_KEY:'qa-old-signing-key'},dedicated={...legacy,SESSION_SECRET:'qa-dedicated-signing-key'};
const request=env=>({headers:{cookie:`zar_session=${value}.${sessionSignature(value,3,user.password_hash,env)}`}});
const db=async resource=>resource==='sessions'?[{user_id:3}]:[user];
test('new dedicated signing key keeps old users signed in only during a bounded migration',async()=>{
 const grace={...dedicated,SESSION_LEGACY_UNTIL:new Date(Date.now()+60000).toISOString()};
 assert.equal((await currentUser(request(legacy),db,grace)).id,3);
 assert.equal((await currentUser(request(dedicated),db,grace)).id,3);
 assert.equal(await currentUser(request(legacy),db,dedicated),null);
 assert.equal(await currentUser(request(legacy),db,{...grace,SESSION_LEGACY_UNTIL:new Date(Date.now()-1000).toISOString()}),null);
 assert.equal((await currentUser(request(dedicated),db,dedicated)).id,3);
});
test('legacy grace never restores revoked, blocked or password-changed sessions',async()=>{
 const env={...dedicated,SESSION_LEGACY_UNTIL:new Date(Date.now()+60000).toISOString()};
 assert.equal(await currentUser(request(legacy),async()=>[],env),null);
 for(const changed of [{...user,blocked_at:new Date().toISOString()},{...user,password_hash:'hash-v2'}]){
  assert.equal(await currentUser(request(legacy),async r=>r==='sessions'?[{user_id:3}]:[changed],env),null);
 }
});
