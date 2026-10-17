import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetApiContext } from '../public/api.js';

test('a late API response from the previous account is discarded after switching identities',async()=>{
 const original=globalThis.fetch;let resolve;
 globalThis.fetch=()=>new Promise(done=>{resolve=done;});
 try{
  const request=api('/cases/1');
  const rejected=assert.rejects(request,/Hisob/);
  resetApiContext();
  resolve({ok:true,json:async()=>({case:{description:'private previous-account data'}})});
  await rejected;
 }finally{globalThis.fetch=original;}
});
