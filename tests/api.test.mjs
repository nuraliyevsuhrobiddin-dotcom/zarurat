import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler,formatCase } from '../server/api.mjs';
import { attachments,requestInput,integer,password } from '../server/validation.mjs';
import { digest,sessionCookie,sessionSignature } from '../server/security.mjs';
import { hashSync } from 'bcryptjs';

const env={PUBLIC_ORIGIN:'https://zaruriyat.example',SESSION_SECRET:'unit-test-session-secret'};
const testHash=hashSync('long-password',4);
async function request(path,{method='GET',body,headers={},db=async()=>[]}={}){
 const req={url:'/api'+path,method,body,headers:{...headers},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.data=s?JSON.parse(s):null;}};
 await createHandler({db,env})(req,res);return res;
}
test('API rejects unauthenticated private routes and forged local storage cannot authorize',async()=>{
 const res=await request('/cases',{headers:{'x-role':'director'}});
 assert.equal(res.statusCode,401);
});
test('Vercel rewritten route resolves the same session endpoint',async()=>{
 const res=await request('/index?route=auth/me');
 assert.equal(res.statusCode,200);assert.equal(res.data.user,null);
});
test('API rejects cross-origin mutations before database calls',async()=>{
 const res=await request('/auth/login',{method:'POST',body:{},headers:{origin:'https://evil.example','content-type':'application/json'},db:()=>{throw new Error('must not run');}});
 assert.equal(res.statusCode,403);
});
test('role boundary rejects client staff creation',async()=>{
 const db=async(name)=>name==='sessions'?[{user_id:1}]:[{id:1,role:'client',password_hash:testHash}];
 const value='a'.repeat(64);const cookie=`zar_session=${value}.${sessionSignature(value,1,testHash,env)}`;
 const res=await request('/users',{method:'POST',body:{},headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json',cookie},db});
 assert.equal(res.statusCode,403);
});
test('case formatter hides notes, tokens and other partner services',()=>{
 const c={id:1,client_id:7,tracking_token:'secret',history:[{id:1,kind:'note',message:'private'},{id:2,kind:'status',message:'received'}],services:[{id:1,partner_id:4},{id:2,partner_id:5}],attachments:[{id:3}],feedback:[]};
 const customer=formatCase(c,{id:7,role:'client'});
 assert.equal(customer.history.length,1);assert.equal(customer.trackingToken,'secret');
 const partner=formatCase(c,{role:'partner',partner_id:4});
 assert.deepEqual(partner.services.map(s=>s.id),[1]);assert.equal(partner.attachments.length,0);assert.equal(partner.history.length,0);assert.equal(partner.trackingToken,undefined);
 assert.equal(formatCase(c,null).history.length,1);
});
test('file validation checks bytes, declared size and MIME signature',()=>{
 const bytes=Buffer.from('%PDF-1.7\ntest');
 const f={name:'document.pdf',type:'application/pdf',size:bytes.length,data:bytes.toString('base64')};
 assert.equal(attachments([f])[0].size,bytes.length);
 assert.throws(()=>attachments([{...f,size:1}]));
 assert.throws(()=>attachments([{...f,type:'image/png'}]));
 assert.throws(()=>attachments(Array(4).fill(f)));
 assert.throws(()=>requestInput({consent:false}));
});
test('login session cookie is HttpOnly Secure and random token is hashed',async()=>{
 const db=async(name)=>name==='rpc/zar_rate_limit'?true:name==='rpc/zar_login'?{id:1,name:'Test',role:'client',phone:'+998901111111'}:name==='users'?[{id:1,password_hash:testHash}]:[];
 const res=await request('/auth/login',{method:'POST',body:{login:'+998901111111',password:'long-password'},headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json'},db});
 assert.equal(res.statusCode,200);
 assert.match(res.headers['Set-Cookie'],/HttpOnly; SameSite=Lax; Max-Age=43200; Secure/);
 assert.equal(digest('session').length,64);assert.match(sessionCookie('',true,true),/Max-Age=0/);
});

test('strict numeric validation and passwords preserve spaces without bcrypt truncation',()=>{
 assert.throws(()=>integer(true,'ID'));assert.throws(()=>integer('','ID'));
 assert.equal(password('  long password  '),'  long password  ');
 assert.throws(()=>password('ю'.repeat(37)));
});
test('health endpoint supports HEAD and backup jobs require a secret',async()=>{
 const healthy=await request('/health',{method:'HEAD',db:async()=>({total:1})});
 assert.equal(healthy.statusCode,200);assert.equal(healthy.data,null);
 assert.match(healthy.headers['Cache-Control'],/s-maxage=30/);
 assert.equal((await request('/jobs/backup')).statusCode,401);
});
