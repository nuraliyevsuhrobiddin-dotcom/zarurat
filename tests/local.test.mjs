import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createLocalServer } from '../server/local.mjs';

test('local HTTP preserves UTF-8 across chunks, rejects malformed JSON and restricts static methods',async()=>{
 const server=createLocalServer(async(req,res)=>{res.statusCode=200;res.end(JSON.stringify(req.body));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const payload=Buffer.from(JSON.stringify({name:'Қаршидаги оила'}));
  const result=await new Promise((resolve,reject)=>{
   const req=request(base+'/api/echo',{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.on('data',chunk=>raw+=chunk);res.on('end',()=>resolve(JSON.parse(raw)));});
   req.on('error',reject);req.write(payload.subarray(0,11));setTimeout(()=>req.end(payload.subarray(11)),5);
  });
  assert.equal(result.name,'Қаршидаги оила');
  assert.equal((await fetch(base+'/api/echo',{method:'POST',body:'{'})).status,400);
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.ok(page.headers.get('Content-Security-Policy'));
  const head=await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/index.html',{method:'POST'})).status,405);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
