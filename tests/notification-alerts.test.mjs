import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationChanges} from '../public/notification-alerts.js';

test('first notification read is a silent baseline and later records are detected once',()=>{
 const initial=[{id:'history-3'},{id:12}];
 const baseline=notificationChanges(initial,null);
 assert.deepEqual(baseline.incoming,[]);
 const update=notificationChanges([{id:'history-4'},{id:12},{id:'history-4'}],baseline.knownIds);
 assert.deepEqual(update.incoming,[{id:'history-4'}]);
 const replay=notificationChanges([{id:'history-4'},{id:12}],update.knownIds);
 assert.deepEqual(replay.incoming,[]);
});

test('notification tracker ignores malformed rows without identifiers',()=>{
 const result=notificationChanges([{event:'unknown'},{id:7}],null);
 assert.deepEqual(result.incoming,[]);
 assert.deepEqual([...result.knownIds],['7']);
});
