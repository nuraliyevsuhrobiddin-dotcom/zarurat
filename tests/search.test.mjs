import {test} from 'node:test';
import assert from 'node:assert/strict';
import {caseFilters} from '../server/search.mjs';
import {sessionSignature,currentUser} from '../server/security.mjs';

test('server search preserves client boundaries with all filters',()=>{
 const f=caseFilters(new URL('https://example.test/?search=ZAR-000001&status=reviewing&category=legal&overdue=true&offset=50'),{id:9,role:'client'});
 assert.equal(f.client_id,'eq.9');assert.equal(f.offset,50);assert.equal(f.limit,51);
 assert.equal(f.status,'eq.reviewing');assert.equal(f.category,'eq.legal');assert.ok(f.or.includes('ZAR-000001'));
 assert.ok(f.and.includes('status.not.in'));assert.ok(f.due_at.startsWith('lt.'));
});
test('search cannot inject a filter or accept unsupported status',()=>{
 const f=caseFilters(new URL('https://example.test/?search='+encodeURIComponent('x),role.eq.director,(name.eq.y')),{role:'client',id:2});
 assert.ok(!f.or.includes('role.eq.director'));assert.equal(f.client_id,'eq.2');
 assert.throws(()=>caseFilters(new URL('https://example.test/?status=invalid'),{role:'client'}));
});

test('old partner service filters are ignored for every role',()=>{
 const url=new URL('https://example.test/?serviceStatus=completed');
 for(const user of [{role:'operator'},{role:'client',id:2}]){const f=caseFilters(url,user);assert.equal(f['services.status'],undefined);assert.equal(f['services.partner_id'],undefined);assert.ok(!f.select.includes('services!inner'));}
});
test('staff responsibility filters use the authenticated ID and retain role boundaries',()=>{
 const url=value=>new URL('https://example.test/?assignee='+value+'&clientId=5');
 assert.equal(caseFilters(url('me'),{id:7,role:'operator'}).coordinator_id,'eq.7');
 assert.equal(caseFilters(url('unassigned'),{id:7,role:'director'}).coordinator_id,'is.null');
 assert.throws(()=>caseFilters(url('7'),{id:7,role:'operator'}));
 const client=caseFilters(url('me'),{id:9,role:'client'});assert.equal(client.client_id,'eq.9');assert.equal(client.coordinator_id,undefined);
});
test('password revision invalidates a session even if its database row remains',async()=>{
 const env={SESSION_SECRET:'test-secret'};const value='c'.repeat(64);
 const cookie=`zar_session=${value}.${sessionSignature(value,7,'old-hash',env)}`;
 const req={headers:{cookie}};
 const db=async(name)=>name==='sessions'?[{user_id:7}]:[{id:7,role:'client',password_hash:'new-hash'}];
 assert.equal(await currentUser(req,db,env),null);
});
test('closed partner accounts cannot keep using an old valid session',async()=>{
 const env={SESSION_SECRET:'test-secret'};const value='d'.repeat(64);
 const req={headers:{cookie:`zar_session=${value}.${sessionSignature(value,8,'same-hash',env)}`}};
 const as=role=>async name=>name==='sessions'?[{user_id:8}]:[{id:8,role,password_hash:'same-hash'}];
 assert.equal(await currentUser(req,as('partner'),env),null);
 assert.equal((await currentUser(req,as('operator'),env)).role,'operator');
});
