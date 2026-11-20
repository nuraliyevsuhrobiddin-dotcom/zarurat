import {test} from 'node:test';
import assert from 'node:assert/strict';
import {caseFilters} from '../server/search.mjs';
import {sessionSignature,currentUser} from '../server/security.mjs';

test('server search preserves client and partner boundaries with all filters',()=>{
 const f=caseFilters(new URL('https://example.test/?search=ZAR-000001&status=reviewing&category=legal&overdue=true&offset=50'),{id:9,role:'client'});
 assert.equal(f.client_id,'eq.9');assert.equal(f.offset,50);assert.equal(f.limit,51);
 assert.equal(f.status,'eq.reviewing');assert.equal(f.category,'eq.legal');assert.ok(f.or.includes('ZAR-000001'));
 assert.ok(f.and.includes('status.not.in'));assert.ok(f.due_at.startsWith('lt.'));
 const partner=caseFilters(new URL('https://example.test/?tab=open'),{role:'partner',partner_id:3});
 assert.ok(partner.select.includes('services!inner'));assert.equal(partner['services.partner_id'],'eq.3');
});
test('search cannot inject a filter or accept unsupported status',()=>{
 const f=caseFilters(new URL('https://example.test/?search='+encodeURIComponent('x),role.eq.director,(name.eq.y')),{role:'client',id:2});
 assert.ok(!f.or.includes('role.eq.director'));assert.equal(f.client_id,'eq.2');
 assert.throws(()=>caseFilters(new URL('https://example.test/?status=invalid'),{role:'client'}));
});

test('partner service status filters never substitute coordinator request statuses',()=>{
 const url=new URL('https://example.test/?serviceStatus=completed');
 const partner=caseFilters(url,{role:'partner',partner_id:3});
 assert.equal(partner['services.status'],'eq.completed');assert.equal(partner.status,undefined);
 assert.equal(caseFilters(url,{role:'operator'})['services.status'],undefined);
 assert.throws(()=>caseFilters(new URL('https://example.test/?serviceStatus=reviewing'),{role:'partner',partner_id:3}));
});
test('staff responsibility filters use the authenticated ID and retain role boundaries',()=>{
 const url=value=>new URL('https://example.test/?assignee='+value+'&clientId=5');
 assert.equal(caseFilters(url('me'),{id:7,role:'operator'}).coordinator_id,'eq.7');
 assert.equal(caseFilters(url('unassigned'),{id:7,role:'director'}).coordinator_id,'is.null');
 assert.throws(()=>caseFilters(url('7'),{id:7,role:'operator'}));
 const client=caseFilters(url('me'),{id:9,role:'client'});assert.equal(client.client_id,'eq.9');assert.equal(client.coordinator_id,undefined);
 const partner=caseFilters(url('unassigned'),{id:10,role:'partner',partner_id:3});assert.equal(partner.coordinator_id,undefined);assert.equal(partner['services.partner_id'],'eq.3');
});
test('password revision invalidates a session even if its database row remains',async()=>{
 const env={SESSION_SECRET:'test-secret'};const value='c'.repeat(64);
 const cookie=`zar_session=${value}.${sessionSignature(value,7,'old-hash',env)}`;
 const req={headers:{cookie}};
 const db=async(name)=>name==='sessions'?[{user_id:7}]:[{id:7,role:'client',password_hash:'new-hash'}];
 assert.equal(await currentUser(req,db,env),null);
});
