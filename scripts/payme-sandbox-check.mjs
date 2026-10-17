import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';import {randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
import {createDatabase,query} from '../server/db.mjs';
const env=parseEnv(readFileSync('.env','utf8'));const db=createDatabase(env);const base='https://zarurat-inky.vercel.app';
const options=await (await fetch(base+'/api/payments/options')).json();assert.equal(options.enabled,true);assert.equal(options.mode,'test');
const login='payme-sandbox-20261017';let [user]=await db('users',{query:query({select:'id',login:'eq.'+login,limit:1})});
if(!user)user=await db('rpc/zar_create_user',{method:'POST',body:{p_name:'Payme SANDBOX test account',p_phone:'SANDBOX-PAYME-20261017',p_login:login,p_password:randomBytes(24).toString('hex'),p_role:'client',p_partner_id:null}});
const order=label=>db('rpc/zar_create_payment_order',{method:'POST',body:{p_client_id:user.id,p_tier:'STANDARD',p_members:[label],p_mode:'test'}});
const checks=[];
async function rpc(method,params){const r=await fetch(base+'/api/payme',{method:'POST',headers:{'Content-Type':'application/json',authorization:'Basic '+Buffer.from('Paycom:'+env.PAYME_TEST_KEY).toString('base64')},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const v=await r.json();if(v.error)throw new Error(method+': '+v.error.code);checks.push(method);return v.result;}
for(const settled of [false,true]){
 const o=await order('SANDBOX HTTP '+(settled?'settled':'unsettled')+' '+Date.now());const p={id:randomBytes(12).toString('hex'),time:Date.now(),amount:o.amount,account:{order_id:o.id}};
 assert.equal((await rpc('CheckPerformTransaction',{amount:o.amount,account:p.account})).allow,true);
 const created=await rpc('CreateTransaction',p);assert.equal(created.state,1);assert.deepEqual(await rpc('CreateTransaction',p),created);
 if(settled){const result=await rpc('PerformTransaction',{id:p.id});assert.equal(result.state,2);assert.deepEqual(await rpc('PerformTransaction',{id:p.id}),result);}
 const cancelled=await rpc('CancelTransaction',{id:p.id,reason:5});assert.equal(cancelled.state,settled?-2:-1);assert.deepEqual(await rpc('CancelTransaction',{id:p.id,reason:5}),cancelled);assert.equal((await rpc('CheckTransaction',{id:p.id})).state,cancelled.state);
 console.log('HTTP scenario '+(settled?'create-perform-cancel':'create-cancel')+': PASS');
}
const datasets=[];for(const i of [1,2]){const o=await order('Payme review dataset '+i);await rpc('CheckPerformTransaction',{amount:o.amount,account:{order_id:o.id}});datasets.push({account:{order_id:o.id},amount:o.amount,mode:'test'});}
const report={merchant_id:env.PAYME_MERCHANT_ID,endpoint:base+'/api/payme',account_field:'order_id',checked_at:new Date().toISOString(),checks,datasets,note:'Direct HTTP tests passed. Payme sandbox UI tests have not been run. Pending orders expire after 12 hours.'};
writeFileSync('artifacts/payme-test-report.json',JSON.stringify(report,null,2));
const body=`Assalomu alaykum.\nKassa ID: ${report.merchant_id}\nEndpoint: ${report.endpoint}\nAccount maydoni: order_id (matn)\nRejim: test\n\n`+datasets.map((v,i)=>`${i+1}-test: account=${JSON.stringify(v.account)}, amount=${v.amount} tiyin (99 000 so'm)`).join('\n')+`\n\nServerga bevosita HTTP orqali ikkita tranzaksiya ssenariysi muvaffaqiyatli tekshirildi. Sandbox interfeysidagi testlar hali bajarilmadi. Test buyurtmalari yaratilganidan 12 soat davomida amal qiladi.\n`;
writeFileSync('artifacts/payme-review-message.txt',body);console.log(body);
