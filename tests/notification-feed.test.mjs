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
