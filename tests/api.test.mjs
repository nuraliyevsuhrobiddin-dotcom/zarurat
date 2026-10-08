import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';

let app,base,operator,partner,client,created,secondClient;
const dir=mkdtempSync(join(tmpdir(),'zaruriyat-test-'));
async function request(path,{method='GET',body,cookie,headers={}}={}) {
  const response=await fetch(`${base}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(login){const r=await request('/api/auth/login',{method:'POST',body:{login,password:'Zaruriyat2026!'}});assert.equal(r.status,200);return r.cookie;}
const input={name:'Test mijoz',phone:'+998901234567',region:'Toshkent shahri',category:'care',description:'Uyda parvarish xizmatini tashkil qilish kerak.',preferredTime:'Ertalab 10:00',consent:true};
before(async()=>{app=createApp({database:join(dir,'test.sqlite')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;operator=await login('operator');partner=await login('partner');client=await login('client');});
after(async()=>{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});});

test('anonymous and client cannot access staff data',async()=>{
  const health=await request('/api/health');assert.equal(health.status,200);assert.deepEqual(health.data,{ok:true});
  assert.equal((await request('/api/cases')).status,401);
  assert.equal((await request('/api/partners',{cookie:client})).status,403);
  assert.equal((await request('/api/stats',{cookie:partner})).status,403);
  const own=await request('/api/cases',{cookie:client});assert.equal(own.data.cases.length,3);assert.ok(own.data.cases.every(c=>c.clientId===4));
});
test('request validation and atomic file validation',async()=>{
  assert.equal((await request('/api/requests',{method:'POST',body:{...input,consent:false}})).status,400);
  assert.equal((await request('/api/requests',{method:'POST',body:{...input,phone:'not phone'}})).status,400);
  assert.equal((await request('/api/requests',{method:'POST',body:{...input,attachments:[{name:'a.png',type:'image/png',data:Buffer.from('<script>bad</script>').toString('base64')}]}})).status,400);
  assert.equal(app.db.prepare('SELECT count(*) n FROM cases').get().n,4);
});
test('unknown API routes return JSON 404 and malformed input is rejected',async()=>{
  const missing=await request('/api/not-a-route');
  assert.equal(missing.status,404);
  assert.equal(typeof missing.data.error,'string');
  const malformed=await fetch(`${base}/api/requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:'null'});
  assert.equal(malformed.status,400);
});
test('only directors manage staff accounts and credentials remain private',async()=>{
  const director=await login('director');
  const account={login:'qa_partner',name:'Sinov hamkor',phone:'+998909998877',password:'TestPartnerPassword2026!',role:'partner',partnerId:1};
  assert.equal((await request('/api/users',{cookie:operator})).status,403);
  assert.equal((await request('/api/users',{method:'POST',cookie:client,body:account})).status,403);
  assert.equal((await request('/api/users',{method:'POST',cookie:director,body:{...account,partnerId:3}})).status,400);
  const createdUser=await request('/api/users',{method:'POST',cookie:director,body:account});
  assert.equal(createdUser.status,201);
  assert.equal(createdUser.data.user.partnerId,1);
  assert.equal((await request('/api/users',{method:'POST',cookie:director,body:account})).status,409);
  const users=await request('/api/users',{cookie:director});
  assert.equal(users.status,200);
  assert.ok(users.data.users.every(u=>u.password===undefined&&u.password_hash===undefined));
  const stored=app.db.prepare('SELECT password_hash FROM users WHERE login=?').get(account.login);
  assert.notEqual(stored.password_hash,account.password);
  assert.equal((await request('/api/auth/login',{method:'POST',body:{login:account.login,password:'wrong password'}})).status,401);
  assert.equal((await request('/api/auth/login',{method:'POST',body:{login:account.login,password:account.password}})).status,200);
});
test('create request, persist private attachments, protect tracking token',async()=>{
  const r=await request('/api/requests',{method:'POST',cookie:client,body:{...input,attachments:[{name:'test.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4\nexample').toString('base64')}]}});
  assert.equal(r.status,201);created=r.data;assert.match(created.case.number,/^ZAR-\d{6}$/);assert.ok(created.trackingToken.length>=24);
  assert.equal((await request('/api/track',{method:'POST',body:{number:created.case.number,token:'wrong-secret-token'}})).status,404);
  const tracked=await request('/api/track',{method:'POST',body:{number:created.case.number,token:created.trackingToken}});assert.equal(tracked.status,200);assert.equal(tracked.data.case.trackingToken,undefined);assert.deepEqual(tracked.data.case.attachments,[]);
  const staffCase=await request(`/api/cases/${created.case.id}`,{cookie:operator});assert.equal(staffCase.data.case.trackingToken,undefined);
  const attachment=staffCase.data.case.attachments[0];
  assert.equal((await fetch(`${base}/api/files/${attachment.id}`)).status,401);
  const downloaded=await fetch(`${base}/api/files/${attachment.id}`,{headers:{Cookie:client}});assert.equal(downloaded.status,200);assert.ok(downloaded.headers.get('content-disposition').startsWith('attachment;'));
});
test('register different client, never attach old guest cases by phone alone',async()=>{
  const r=await request('/api/auth/register',{method:'POST',body:{name:'Ikkinchi mijoz',phone:input.phone,password:'LongPassword123!',consent:true}});assert.equal(r.status,201);secondClient=r.cookie;
  assert.equal((await request(`/api/cases/${created.case.id}`,{cookie:secondClient})).status,404);
  assert.equal((await request('/api/cases',{cookie:secondClient})).data.cases.length,0);
});
test('CSRF cross-origin mutations blocked',async()=>{
  assert.equal((await request('/api/auth/logout',{method:'POST',cookie:operator,body:{},headers:{Origin:'https://example.org'}})).status,403);
  assert.equal((await request('/api/auth/me',{cookie:operator})).data.user.role,'operator');
});
test('only the configured Vercel origin may send mutations through proxy',async()=>{
  const previous=process.env.PUBLIC_ORIGIN;
  try {
    process.env.PUBLIC_ORIGIN='https://zaruriyat-test.vercel.app';
    const headers={Origin:process.env.PUBLIC_ORIGIN,'Sec-Fetch-Site':'same-origin'};
    assert.equal((await request('/api/requests',{method:'POST',body:{},headers})).status,400);
    assert.equal((await request('/api/requests',{method:'POST',body:{},headers:{...headers,Origin:'https://another.vercel.app'}})).status,403);
    assert.equal((await request('/api/requests',{method:'POST',body:{},headers:{...headers,'Sec-Fetch-Site':'cross-site'}})).status,403);
  } finally {
    if(previous===undefined)delete process.env.PUBLIC_ORIGIN;else process.env.PUBLIC_ORIGIN=previous;
  }
});
test('multi-service completion gate, active partner validation, notes remain private',async()=>{
  const id=created.case.id;
  assert.equal((await request(`/api/cases/${id}`,{method:'PATCH',cookie:operator,body:{status:'completed'}})).status,409);
  assert.equal((await request(`/api/cases/${id}/services`,{method:'POST',cookie:operator,body:{title:'Klining',partnerId:3}})).status,400);
  const add=await request(`/api/cases/${id}/services`,{method:'POST',cookie:operator,body:{title:'Parvarish',partnerId:1,price:150000}});assert.equal(add.status,201);
  created.serviceId=add.data.case.services[0].id;
  assert.equal((await request(`/api/cases/${id}`,{method:'PATCH',cookie:operator,body:{status:'reviewing',coordinatorId:1,note:'MAXFIY ICHKI IZOH'}})).status,200);
  const customer=await request(`/api/cases/${id}`,{cookie:client});assert.ok(!JSON.stringify(customer.data).includes('MAXFIY'));
  const partners=await request('/api/cases',{cookie:partner});assert.ok(partners.data.cases.every(c=>c.services.every(s=>s.partnerId===1)));assert.ok(!JSON.stringify(partners.data).includes('MAXFIY'));
});
test('partner can only update own service in sequence',async()=>{
  assert.equal((await request('/api/services/1',{method:'PATCH',cookie:operator,body:{partnerId:1,status:'contacted'}})).status,200);
  assert.equal((await request('/api/services/1',{method:'PATCH',cookie:operator,body:{partnerId:2,status:'contacted'}})).status,409);
  assert.equal((await request('/api/services/3',{method:'PATCH',cookie:partner,body:{status:'completed'}})).status,404);
  assert.equal((await request(`/api/services/${created.serviceId}`,{method:'PATCH',cookie:partner,body:{status:'completed'}})).status,409);
  assert.equal((await request(`/api/services/${created.serviceId}`,{method:'PATCH',cookie:partner,body:{partnerId:2}})).status,403);
  for(const status of ['accepted','contacted','delivered','completed']) assert.equal((await request(`/api/services/${created.serviceId}`,{method:'PATCH',cookie:partner,body:{status}})).status,200);
  assert.equal((await request(`/api/cases/${created.case.id}`,{method:'PATCH',cookie:partner,body:{status:'completed'}})).status,403);
});
test('complete case and accept one valid feedback only',async()=>{
  assert.equal((await request('/api/feedback',{method:'POST',body:{number:created.case.number,token:created.trackingToken,rating:5,comment:'Yaxshi'}})).status,409);
  assert.equal((await request(`/api/cases/${created.case.id}`,{method:'PATCH',cookie:operator,body:{status:'completed'}})).status,200);
  assert.equal((await request('/api/feedback',{method:'POST',body:{number:created.case.number,token:created.trackingToken,rating:6}})).status,400);
  assert.equal((await request('/api/feedback',{method:'POST',body:{number:created.case.number,token:created.trackingToken,rating:5,comment:'Yaxshi'}})).status,200);
  assert.equal((await request('/api/feedback',{method:'POST',body:{number:created.case.number,token:created.trackingToken,rating:5}})).status,409);
  assert.equal((await request(`/api/cases/${created.case.id}`,{method:'PATCH',cookie:operator,body:{status:'received'}})).status,409);
});
test('package use is idempotent, validates ownership, respects exhausted limit',async()=>{
  let r=await request('/api/packages/1/use',{method:'POST',cookie:operator,body:{caseId:created.case.id}});assert.equal(r.status,200);assert.equal(r.data.package.used,2);
  r=await request('/api/packages/1/use',{method:'POST',cookie:operator,body:{caseId:created.case.id}});assert.equal(r.data.package.used,2);
  assert.equal((await request('/api/packages/1/use',{method:'POST',cookie:operator,body:{caseId:4}})).status,400);
  assert.equal((await request('/api/packages',{method:'POST',cookie:operator,body:{clientId:4,tier:'Start',expiresAt:new Date(Date.now()+86400000).toISOString(),limit:1,members:[]}})).status,400);
  app.db.prepare('UPDATE packages SET service_limit=2 WHERE id=1').run();
  app.db.prepare("UPDATE cases SET status='completed' WHERE id=2").run();
  assert.equal((await request('/api/packages/1/use',{method:'POST',cookie:operator,body:{caseId:2}})).status,409);
});
test('partner directory creation and outbox queue are real',async()=>{
  const r=await request('/api/partners',{method:'POST',cookie:operator,body:{name:'Test hamkor',phone:'+998909876543',address:'Test ko‘chasi 1',category:'repair',hours:'09:00–18:00',region:'Toshkent shahri',price:100000,contractStatus:'active'}});assert.equal(r.status,201);assert.equal(r.data.partner.contractStatus,'active');
  const notifications=await request('/api/notifications',{cookie:operator});assert.ok(notifications.data.notifications.length>4);assert.ok(notifications.data.notifications.every(n=>n.status==='queued'));
});
test('unconfigured delivery never marks queued notifications as sent',async()=>{
  const notification=app.db.prepare("SELECT id FROM notifications WHERE status='queued' LIMIT 1").get();
  assert.equal((await request(`/api/notifications/${notification.id}/send`,{method:'POST',cookie:operator,body:{}})).status,503);
  assert.equal((await request('/api/notifications/dispatch-all',{method:'POST',cookie:operator,body:{}})).status,503);
  assert.equal(app.db.prepare('SELECT status FROM notifications WHERE id=?').get(notification.id).status,'queued');
  assert.equal((await request('/api/notifications/dispatch-all',{method:'POST',cookie:client,body:{}})).status,403);
});

test('family package is recognized by account and kept private',async()=>{
  const own=await request('/api/cases/1',{cookie:client});
  assert.equal(own.data.case.familyPackage.status,'exhausted');
  assert.equal(own.data.case.familyPackage.remaining,0);
  const assigned=await request('/api/cases/1',{cookie:partner});
  assert.ok(!('familyPackage' in assigned.data.case));
  const guest=await request('/api/cases/4',{cookie:operator});
  assert.equal(guest.data.case.familyPackage,null);
  const original=app.db.prepare('SELECT expires_at FROM packages WHERE id=1').get().expires_at;
  try {
    app.db.prepare('UPDATE packages SET expires_at=? WHERE id=1').run('2000-01-01T00:00:00.000Z');
    assert.equal((await request('/api/cases/1',{cookie:client})).data.case.familyPackage.status,'expired');
  } finally {
    app.db.prepare('UPDATE packages SET expires_at=? WHERE id=1').run(original);
  }
});

test('logout revokes server session',async()=>{
  assert.equal((await request('/api/auth/logout',{method:'POST',cookie:secondClient,body:{}})).status,200);
  assert.equal((await request('/api/auth/me',{cookie:secondClient})).data.user,null);
});
test('case cancellation requires a reason and closes unfinished services',async()=>{
  assert.equal((await request('/api/cases/1',{method:'PATCH',cookie:operator,body:{status:'cancelled'}})).status,400);
  const r=await request('/api/cases/1',{method:'PATCH',cookie:operator,body:{status:'cancelled',note:'Mijoz xizmatni bekor qilishni so‘radi.'}});assert.equal(r.status,200);assert.ok(r.data.case.services.every(s=>s.status==='cancelled'));
  assert.equal((await request('/api/services/1',{method:'PATCH',cookie:partner,body:{status:'contacted'}})).status,409);
});
test('simultaneous requests get unique sequential numbers',async()=>{
  const results=await Promise.all([request('/api/requests',{method:'POST',body:input}),request('/api/requests',{method:'POST',body:input})]);
  assert.ok(results.every(r=>r.status===201));assert.notEqual(results[0].data.case.number,results[1].data.case.number);
});
test('database and session survive server restart',async()=>{
  await new Promise(r=>app.server.close(r));
  app=createApp({database:join(dir,'test.sqlite')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
  const r=await request(`/api/cases/${created.case.id}`,{cookie:client});assert.equal(r.status,200);assert.equal(r.data.case.status,'completed');assert.equal(r.data.case.feedback.rating,5);assert.equal(r.data.case.attachments.length,1);
});
