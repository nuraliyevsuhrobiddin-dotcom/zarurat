import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationCopy} from '../public/notification-copy.js';

test('historical notifications describe their own event, not the current case state',()=>{
 const completed=notificationCopy({event:'case.status_changed',message:'ZAR-000001: completed'});
 assert.equal(completed.title,'Ish bajarildi');assert.match(completed.body,/Yakunlangan murojaatlar/);
 const created=notificationCopy({event:'request.created',message:'Murojaat qabul qilindi: ZAR-000001',caseStatus:'completed'});
 assert.equal(created.title,'Yangi murojaat keldi');
 const service=notificationCopy({event:'service.assigned'});
 assert.equal(service.title,'Murojaatga xizmat qo‘shildi');
 const unknown=notificationCopy({event:'future.event',message:'Existing note'});
 assert.equal(unknown.body,'Existing note');
 assert.equal(notificationCopy({event:'completed'},'cyr').title,'Иш бажарилди');
});
