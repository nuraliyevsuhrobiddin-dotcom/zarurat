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

test('outgoing acceptance confirmations cannot look like new incoming requests',()=>{
 for(const event of ['request.created','created','request_created','case_created']){
  const outgoing=notificationCopy({source:'delivery',event,status:'failed'});
  assert.equal(outgoing.title,'Mijozga qabul tasdig‘i');
  assert.match(outgoing.body,/Mijozga murojaati qabul qilingani/);
  assert.doesNotMatch(outgoing.body,/Yangi murojaatlar|Mas’ul xodim/);
 }
 assert.equal(notificationCopy({source:'delivery',event:'request.created'},'cyr').title,'Мижозга қабул тасдиғи');
 assert.equal(notificationCopy({source:'incoming',event:'request.created'}).title,'Murojaat qabul qilindi');
 assert.equal(notificationCopy({event:'request.created'}).title,'Yangi murojaat keldi');
});
