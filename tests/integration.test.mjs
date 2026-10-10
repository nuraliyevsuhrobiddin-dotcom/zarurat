import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createHandler } from '../server/api.mjs';
import { HttpError } from '../server/db.mjs';

// In-memory PostgreSQL adapter for exercising the HTTP handler against real SQL.
// Production uses PostgREST; this adapter is deliberately confined to tests.
let pg, handler;
const env={PUBLIC_ORIGIN:'https://test.example',SESSION_SECRET:'integration-test-session-secret'};
const tables=new Set(['sessions','users','cases','services','history','attachments','feedback','partners','packages','package_usage','notifications']);
async function db(resource,{method='GET',body,query=''}={}){
 if(resource.startsWith('rpc/')){
  const fn=resource.slice(4);assert.match(fn,/^zar_[a-z_]+$/);
  const entries=Object.entries(body||{});
  const args=entries.map(([key],i)=>{assert.match(key,/^p_[a-z_]+$/);return `${key}=>$${i+1}`;}).join(',');
  const values=entries.map(([,v])=>typeof v==='object'&&v!==null?JSON.stringify(v):v);
  try{return (await pg.query(`SELECT ${fn}(${args}) AS value`,values)).rows[0].value;}
  catch(error){if(error.code==='P0001')throw new HttpError(400,error.message);throw error;}
 }
 assert.ok(tables.has(resource));
 const params=new URLSearchParams(query), values=[],clauses=[];
 for(const [key,value]of params){
  if(['select','order','limit','offset'].includes(key))continue;
  assert.match(key,/^[a-z_]+$/);
  if(value.startsWith('in.(')){
   const items=value.slice(4,-1).split(',');clauses.push(`${key} IN (${items.map(v=>{values.push(v);return '$'+values.length;}).join(',')})`);
  }else{
   const dot=value.indexOf('.'),op=value.slice(0,dot);assert.ok(['eq','gt','lt'].includes(op));values.push(value.slice(dot+1));clauses.push(`${key}${{eq:'=',gt:'>',lt:'<'}[op]}$${values.length}`);
  }
 }
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 if(method==='POST'){
  const keys=Object.keys(body);keys.forEach(k=>assert.match(k,/^[a-z_]+$/));
  return (await pg.query(`INSERT INTO ${resource}(${keys.join(',')}) VALUES(${keys.map((k,i)=>'$'+(i+1)).join(',')}) RETURNING *`,keys.map(k=>body[k]))).rows;
 }
 if(method==='DELETE')return(await pg.query(`DELETE FROM ${resource}${where} RETURNING *`,values)).rows;
 if(method==='PATCH'){
  const sets=Object.entries(body).map(([key,value])=>{assert.match(key,/^[a-z_]+$/);values.push(value);return `${key}=$${values.length}`;});
  return(await pg.query(`UPDATE ${resource} SET ${sets.join(',')}${where} RETURNING *`,values)).rows;
 }
 let suffix='';
 if(params.has('order')){const [col,dir]=params.get('order').split('.');assert.match(col,/^[a-z_]+$/);suffix+=` ORDER BY ${col} ${dir==='desc'?'DESC':'ASC'}`;}
 for(const key of ['limit','offset'])if(params.has(key))suffix+=` ${key.toUpperCase()} ${Number(params.get(key))}`;
 const rows=(await pg.query(`SELECT * FROM ${resource}${where}${suffix}`,values)).rows;
 if(resource==='cases')for(const c of rows){
  c.coordinator=(await pg.query('SELECT name FROM users WHERE id=$1',[c.coordinator_id])).rows[0];
  c.services=(await pg.query('SELECT * FROM services WHERE case_id=$1',[c.id])).rows;
  for(const s of c.services)s.partners=(await pg.query('SELECT name FROM partners WHERE id=$1',[s.partner_id])).rows[0];
  c.history=(await pg.query('SELECT * FROM history WHERE case_id=$1',[c.id])).rows;
  c.attachments=(await pg.query('SELECT id,name,type,size FROM attachments WHERE case_id=$1',[c.id])).rows;
  c.feedback=(await pg.query('SELECT * FROM feedback WHERE case_id=$1',[c.id])).rows[0]||null;
 }
 return rows;
}
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await readFile('supabase-schema.sql','utf8'));
 await pg.exec(`INSERT INTO users(login,name,phone,password_hash,role) VALUES('boss','Rahbar','+998901111111',extensions.crypt('secure-password',extensions.gen_salt('bf',4)),'director');`);
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
