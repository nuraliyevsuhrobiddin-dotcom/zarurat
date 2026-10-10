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
test('password revision invalidates a session even if its database row remains',async()=>{
 const env={SESSION_SECRET:'test-secret'};const value='c'.repeat(64);
 const cookie=`zar_session=${value}.${sessionSignature(value,7,'old-hash',env)}`;
 const req={headers:{cookie}};
 const db=async(name)=>name==='sessions'?[{user_id:7}]:[{id:7,role:'client',password_hash:'new-hash'}];
 assert.equal(await currentUser(req,db,env),null);
});
