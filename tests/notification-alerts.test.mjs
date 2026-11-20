import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationChanges} from '../public/notification-alerts.js';

test('first notification read is a silent baseline and later records are detected once',()=>{
 const initial=[{id:'history-3'},{id:12}];
 const baseline=notificationChanges(initial,null);
 assert.deepEqual(baseline.incoming,[]);
 const update=notificationChanges([{id:'request-4',source:'incoming'},{id:12},{id:'request-4',source:'incoming'}],baseline.knownIds);
 assert.deepEqual(update.incoming,[{id:'request-4',source:'incoming'}]);
 const replay=notificationChanges([{id:'request-4',source:'incoming'},{id:12}],update.knownIds);
 assert.deepEqual(replay.incoming,[]);
});

test('delivery and staff activity stay silent while requests and subscriptions alert',()=>{
 const rows=[{id:'r',source:'incoming'},{id:'s',source:'internal',event:'subscription.activated'},{id:'d',source:'delivery',event:'request.created'},{id:'h',source:'internal',event:'case.assignment_changed'}];
 assert.deepEqual(notificationChanges(rows,new Set()).incoming.map(r=>r.id),['r','s']);
});

test('notification tracker ignores malformed rows without identifiers',()=>{
 const result=notificationChanges([{event:'unknown'},{id:7}],null);
 assert.deepEqual(result.incoming,[]);
 assert.deepEqual([...result.knownIds],['7']);
});
