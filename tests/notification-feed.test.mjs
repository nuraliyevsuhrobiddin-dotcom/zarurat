import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationFeed} from '../server/notification-feed.mjs';
import {notificationCopy} from '../public/notification-copy.js';

test('staff activities are clearly internal, private notes never enter the notification feed',()=>{
 const histories=['assignment','deadline','clarification','package','note'].map((kind,i)=>({id:i+1,case_id:8,kind,message:'private text',actor_name:'Staff',created_at:`2026-10-11T10:00:0${i}Z`,cases:{number:'ZAR-000008',phone:'+998901111111'}}));
 const rows=notificationFeed([{id:1,event:'request.created',created_at:'2026-10-11T09:00:00Z',cases:{number:'ZAR-000008'}}],histories);
 assert.equal(rows.length,5);
 assert.equal(rows.filter(r=>r.source==='internal').length,4);
 assert.ok(rows.filter(r=>r.source==='internal').every(r=>r.status==='recorded'&&r.message===''));
 assert.ok(!JSON.stringify(rows).includes('private text'));
 assert.ok(rows.filter(r=>r.source==='internal').every(r=>notificationCopy(r).title!=='Murojaat bo‘yicha xabar'));
 assert.equal(rows[0].event,'package.used');
});
test('a paid subscription has a stable internal notification and customer details',()=>{
 const s={id:5,client_id:3,tier:'STANDARD',starts_at:'2026-11-13',expires_at:'2026-12-13',users:{name:'Family',phone:'+998901234567'}};
 const first=notificationFeed([],[],[s]),again=notificationFeed([],[],[s]);assert.equal(first[0].id,again[0].id);assert.equal(first[0].source,'internal');
 assert.equal(first[0].clientId,3);assert.equal(first[0].recipientPhone,s.users.phone);assert.match(notificationCopy(first[0]).body,/Family.*STANDARD.*13.12.2026/);
});

test('incoming requests are independent of acknowledgements and survive busy delivery traffic',()=>{
 const request={id:8,number:'ZAR-000008',name:'Mijoz',phone:'+998901234567',created_at:'2026-11-01T10:00:00Z',status:'reviewing',description:'private request text',tracking_token:'secret'};
 const deliveries=Array.from({length:100},(_,i)=>({id:i+1,case_id:8,event:'request.created',created_at:'2026-11-19T10:00:00Z',status:'failed'}));
 const rows=notificationFeed(deliveries,[],[],[request]);
 const incoming=rows.filter(n=>n.source==='incoming');
 assert.equal(rows.length,101);assert.equal(incoming.length,1);
 assert.equal(incoming[0].id,'request-8');assert.equal(incoming[0].status,'reviewing');
 assert.equal(incoming[0].case_id,8);assert.equal(incoming[0].clientName,'Mijoz');
 assert.equal(incoming[0].recipientPhone,request.phone);
 assert.ok(!JSON.stringify(incoming).includes('secret'));assert.ok(!JSON.stringify(incoming).includes('private request text'));
 assert.deepEqual(notificationFeed([],[],[],[request]),incoming);
});
