import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnedPayment,paymentPending} from '../public/payment-return.js';
import {handlePaymentRoute} from '../server/payme.mjs';
import {paymentPanel} from '../public/payments.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const id='12345678-1234-4321-8765-123456789abc';
const fresh={id,tier:'STANDARD',amount:9900000,client_id:7,status:'pending',mode:'live',created_at:new Date().toISOString()};
const env={FEATURE_PAYME:'true',PAYME_MODE:'live',PAYME_KEY:'live-test-secret',PAYME_MERCHANT_ID:'merchant',PUBLIC_ORIGIN:'https://site.example'};

test('return parameters cannot declare a payment paid or reveal an unknown order',()=>{
 const data={payments:[fresh]};
 assert.equal(returnedPayment(data,`#cabinet/packages?order=${id}&status=paid`).status,'pending');
 assert.equal(returnedPayment(data,'#cabinet/packages?order=unknown'),null);
 assert.equal(returnedPayment(data,`#home?order=${id}`),null);
 assert.equal(returnedPayment({payments:[]},`#cabinet/packages?order=${id}`),null);
 assert.equal(paymentPending(fresh),true);
 assert.equal(paymentPending({...fresh,status:'reserved'}),true);
 for(const status of ['paid','cancelled','expired'])assert.equal(paymentPending({...fresh,status}),false);
 assert.equal(paymentPending({...fresh,created_at:new Date(Date.now()-43200001).toISOString()}),false);
});

test('only a client receives checkout links for fresh pending orders in the active payment mode',async()=>{
 const list=async(role)=>{
  const orders=[{...fresh},{...fresh,id:'expired',created_at:new Date(Date.now()-43200001).toISOString()},{...fresh,id:'paid',status:'paid'},{...fresh,id:'reserved',status:'reserved'},{...fresh,id:'test',mode:'test'}];
  return handlePaymentRoute({path:'/payments',method:'GET',user:{id:7,role},env,db:async(resource,options)=>{
   if(resource==='rpc/zar_payment_ready')return true;
   if(resource==='payment_orders'){
    const filters=new URLSearchParams(options.query);
    if(role==='client')assert.equal(filters.get('client_id'),'eq.7');
    return orders;
   }
   return [];
  }});
 };
 const client=await list('client');
 assert.equal(new URL(client.payments[0].checkoutUrl).origin,'https://checkout.paycom.uz');
 assert.ok(client.payments.slice(1).every(o=>!o.checkoutUrl));
 assert.ok((await list('director')).payments.every(o=>!o.checkoutUrl));
 const html=paymentPanel(client);
 assert.match(html,/To‘lovni davom ettirish/);
 assert.ok(!html.includes('live-test-secret'));
 const hostile=paymentPanel({payments:[{...fresh,checkoutUrl:'javascript:alert(1)'}]});
 assert.ok(!hostile.includes('javascript:'));
});

const appSource=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const watcher=appSource.slice(appSource.indexOf('function watchPaymentReturn('),appSource.indexOf('\nlet subscriptionEligibility'));
function pollingContext(api){
 const queue=[],main={innerHTML:''};
 const context={routeVersion:1,paymentReturnTimer:null,state:{user:{role:'client'},paymentData:{payments:[{...fresh}]}},
  location:{hash:`#cabinet/packages?order=${id}`},returnedPayment,paymentPending,modal:{open:false},
  setTimeout(fn,delay){assert.equal(delay,3000);queue.push(fn);return queue.length;},
  api,$:()=>main,packagesPage:()=> 'updated payment status'};
 runInNewContext(watcher+';watchPaymentReturn(1);',context);
 return {context,queue,main};
}

test('callback polling waits for server settlement and stops after success or navigation',async()=>{
 const {context,queue,main}=pollingContext(async()=>({payments:[{...fresh,status:'paid'}]}));
 assert.equal(main.innerHTML,'');
 await queue.shift()();
 assert.equal(context.state.paymentData.payments[0].status,'paid');
 assert.equal(main.innerHTML,'updated payment status');
 assert.equal(queue.length,0);
 const changed=pollingContext(async()=>assert.fail('Polling continued after navigation'));
 changed.context.routeVersion++;
 await changed.queue.shift()();
 assert.equal(changed.queue.length,0);
});

test('unavailable payment status cannot cause endless polling',async()=>{
 let requests=0;
 const {queue}=pollingContext(async()=>{requests++;throw new Error('network unavailable');});
 while(queue.length)await queue.shift()();
 assert.equal(requests,20);
});
