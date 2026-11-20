import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetApiContext, cancelApiReads } from '../public/api.js';

test('leaving a page releases queued reads while allowing a payment mutation to finish',async()=>{
 const originalFetch=globalThis.fetch,pending=[];
 globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>{
  pending.push({url,options,resolve});
  options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
 });
 try{
  const reads=['/cases','/partners','/users','/payments'].map(path=>api(path));
  const rejected=reads.map(request=>assert.rejects(request,{name:'AbortError'}));
  const payment=api('/payments/orders',{tier:'STANDARD',members:['QA'],consent:true});
  cancelApiReads();
  assert.ok(pending.slice(0,4).every(({options})=>options.signal.aborted));
  assert.equal(pending[4].options.signal.aborted,false,'Navigation must not cancel an order being saved');
  pending[4].resolve({ok:true,json:async()=>({order:{id:'saved'}})});
  await Promise.all(rejected);
  assert.equal((await payment).order.id,'saved');
  const next=api('/account');
  assert.equal(pending[5].options.signal.aborted,false);
  pending[5].resolve({ok:true,json:async()=>({name:'Current account'})});
  assert.equal((await next).name,'Current account');
 }finally{globalThis.fetch=originalFetch;cancelApiReads();}
});

test('page navigation aborts a stalled response body without reporting a timeout',async()=>{
 const originalFetch=globalThis.fetch;let bodyStarted;
 const started=new Promise(resolve=>{bodyStarted=resolve;});
 globalThis.fetch=async(url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(signal.reason),{once:true});bodyStarted();
 })});
 try{
  const request=api('/cases');const rejected=assert.rejects(request,{name:'AbortError'});
  await started;cancelApiReads();await rejected;
 }finally{globalThis.fetch=originalFetch;cancelApiReads();}
});

test('API works on mobile browsers without AbortSignal.timeout',async()=>{
 const originalFetch=globalThis.fetch,originalTimeout=AbortSignal.timeout;
 AbortSignal.timeout=undefined;
 globalThis.fetch=async(path,options)=>{
  assert.equal(path,'/api/payments/options');
  assert.ok(options.signal instanceof AbortSignal);
  return {ok:true,json:async()=>({enabled:true,mode:'live'})};
 };
 try{assert.deepEqual(await api('/payments/options'),{enabled:true,mode:'live'});}
 finally{globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
});

test('API timeout also covers a stalled response body and releases its timer',async()=>{
 const originalFetch=globalThis.fetch,originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
 let expire,cleared=false;
 globalThis.setTimeout=(callback,delay)=>{assert.equal(delay,20000);expire=callback;return 123;};
 globalThis.clearTimeout=id=>{assert.equal(id,123);cleared=true;};
 globalThis.fetch=async(path,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(new Error('body aborted')),{once:true});
  queueMicrotask(expire);
 })});
 try{await assert.rejects(api('/payments/options'),/cho‘zildi/);assert.equal(cleared,true);}
 finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;}
});

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

test('request account-change conflicts retain their structured code',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({error:'Hisob o‘zgardi',code:'account_changed'})});
 try{await assert.rejects(api('/requests',{requestOwner:'user:1'}),error=>error.status===409&&error.code==='account_changed');}
 finally{globalThis.fetch=original;}
});
