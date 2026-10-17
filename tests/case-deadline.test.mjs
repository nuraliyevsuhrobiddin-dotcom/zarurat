import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deadlineChanges,deadlineClearUnavailable} from '../public/case-deadline.js';

test('unsupported deadline removal is rejected instead of silently reporting success',()=>{
 assert.throws(()=>deadlineChanges('','2027-01-01T12:00:00Z',false),{message:deadlineClearUnavailable});
 assert.deepEqual(deadlineChanges('',null,false),{});
 assert.deepEqual(deadlineChanges('','2027-01-01T12:00:00Z',true),{dueAt:null});
 assert.deepEqual(deadlineChanges('2027-01-02T12:00:00Z','2027-01-01T12:00:00Z',false),{dueAt:'2027-01-02T12:00:00.000Z'});
});
