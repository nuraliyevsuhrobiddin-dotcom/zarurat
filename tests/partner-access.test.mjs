import {test} from 'node:test';
import assert from 'node:assert/strict';
import {partnerAccess} from '../server/partner-access.mjs';

test('partner readiness distinguishes linked active, blocked and missing accounts without leaking account data',async()=>{
 const partners=[{id:1,name:'One',contractStatus:'pending'},{id:2,name:'Two',contractStatus:'active'},{id:3,name:'Three',contractStatus:'active'}];
 const accounts=[{id:10,partner_id:1,blocked_at:'2026-11-01',login:'private'},{id:11,partner_id:'1',blocked_at:null,phone:'private'},{id:12,partner_id:2,blocked_at:'2026-11-02'},{id:13,partner_id:null,blocked_at:null}];
 const result=await partnerAccess(partners,async(table,{query})=>{
  assert.equal(table,'users');const q=new URLSearchParams(query);
  assert.equal(q.get('role'),'eq.partner');assert.equal(q.get('select'),'id,partner_id,blocked_at');return accounts;
 });
 assert.deepEqual(result.map(p=>p.accountStatus),['active','blocked','missing']);
 assert.ok(!JSON.stringify(result).includes('private'));assert.equal(result[0].contractStatus,'pending');
 assert.equal(partners[0].accountStatus,undefined);
});

test('a failed account lookup is unknown rather than declaring no account',async()=>{
 const partners=[{id:1}];
 assert.equal((await partnerAccess(partners,async()=>{throw Error('offline');}))[0].accountStatus,'unknown');
 assert.deepEqual(await partnerAccess([],()=>{throw Error('must not read');}),[]);
});

test('partner readiness reads beyond the first account page',async()=>{
 let calls=0;
 const result=await partnerAccess([{id:999}],async(table,{query})=>{
  calls++;const offset=Number(new URLSearchParams(query).get('offset'));
  return offset===0?Array.from({length:500},(_,i)=>({id:i,partner_id:i+1,blocked_at:null})):[{id:501,partner_id:999,blocked_at:null}];
 });
 assert.equal(calls,2);assert.equal(result[0].accountStatus,'active');
});
