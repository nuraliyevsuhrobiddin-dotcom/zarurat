import{test}from'node:test';
import assert from'node:assert/strict';
import{clientPageRecords}from'../public/client-filter.js';
test('client search sees all records while the DOM page stays small',()=>{
 const clients=Array.from({length:1200},(_,id)=>({id,name:'Client '+id,phone:'+99890'+String(id).padStart(7,'0'),subscription:{state:id===1199?'active':'none'}}));
 const first=clientPageRecords(clients);assert.equal(first.records.length,50);assert.equal(first.total,1200);assert.equal(first.hasMore,true);assert.equal(first.records[0].id,1199);
 const search=clientPageRecords(clients,{search:'Client 1198'});assert.equal(search.records.length,1);assert.equal(search.records[0].id,1198);
 assert.equal(clientPageRecords(clients,{status:'active'}).total,1);
 assert.equal(clientPageRecords(clients,{search:'not-present'}).total,0);
 assert.equal(clientPageRecords(clients,{limit:100}).records.length,100);
});
test('formatted phone searches find the same customer',()=>{
 const clients=[{id:1,name:'Family',phone:'+998901234567'}];
 assert.equal(clientPageRecords(clients,{search:'90 123 45'}).total,1);
 assert.equal(clientPageRecords(clients,{status:'unavailable'}).total,1);
});
