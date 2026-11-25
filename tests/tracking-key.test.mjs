import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newTrackingKey,normalizeTrackingKey,shortenTrackingKey} from '../server/tracking-key.mjs';

test('tracking keys are short, unambiguous and random',()=>{
 const keys=new Set(Array.from({length:500},newTrackingKey));
 assert.equal(keys.size,500);
 for(const key of keys)assert.match(key,/^[2-9A-HJKMNP-Z]{8}$/);
});

test('typed keys are normalised; older 64-character keys keep working',()=>{
 assert.equal(normalizeTrackingKey(' k7p4-x9qm '),'K7P4X9QM');
 const legacy='AB'.repeat(32);
 assert.equal(normalizeTrackingKey(legacy),legacy.toLowerCase());
});

test('a failed update keeps the original key',async()=>{
 const original=console.error;console.error=()=>{};
 try{
  assert.equal(await shortenTrackingKey(async()=>{throw new Error('down');},5,'long-key'),'long-key');
  assert.equal(await shortenTrackingKey(async()=>[],null,'long-key'),'long-key');
  assert.match(await shortenTrackingKey(async()=>[],5,'long-key'),/^[2-9A-HJKMNP-Z]{8}$/);
 }finally{console.error=original;}
});
