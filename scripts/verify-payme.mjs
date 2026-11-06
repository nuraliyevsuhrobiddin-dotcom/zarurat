// Read-only production check: never creates orders, settles or cancels payments.
import assert from 'node:assert/strict';

const base=process.env.PAYME_VERIFY_ORIGIN||'https://www.zaruriyat.uz';
const origin=new URL(base);
assert.equal(origin.protocol,'https:','Payme jonli tekshiruvi HTTPS manzil talab qiladi.');
assert.equal(origin.origin,base,'Manzil oxirida / yoki yo‘l bo‘lmasin.');
assert.ok(process.env.PAYME_KEY,'PAYME_KEY sozlanmagan.');
const optionsResponse=await fetch(`${base}/api/payments/options`,{signal:AbortSignal.timeout(20000)});
assert.equal(optionsResponse.status,200);
const options=await optionsResponse.json();
assert.equal(options.enabled,true,'Payme yoki baza migratsiyasi tayyor emas.');
assert.equal(options.mode,'live','Jonli sayt live rejimida emas.');
async function check(key){
 const response=await fetch(`${base}/api/payme`,{
  method:'POST',signal:AbortSignal.timeout(20000),
  headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(`Paycom:${key}`).toString('base64')},
  body:JSON.stringify({jsonrpc:'2.0',id:'readiness',method:'CheckPerformTransaction',params:{amount:9900000,account:{[process.env.PAYME_ACCOUNT_FIELD||'order_id']:'00000000-0000-4000-8000-000000000000'}}})
 });
 assert.equal(response.status,200,'Merchant API HTTP 200 qaytarishi kerak.');
 return response.json();
}
const live=await check(process.env.PAYME_KEY);
assert.equal(live.error?.code,-31050,'Ishchi kalit yoki buyurtma tekshiruvi ishlamayapti.');
assert.equal(live.error?.data,process.env.PAYME_ACCOUNT_FIELD||'order_id');
assert.equal((await check('invalid-readiness-key')).error?.code,-32504);
if(process.env.PAYME_TEST_KEY){
 assert.notEqual(process.env.PAYME_TEST_KEY,process.env.PAYME_KEY,'Test va ishchi kalitlar alohida bo‘lsin.');
 assert.equal((await check(process.env.PAYME_TEST_KEY)).error?.code,-32504,'Jonli endpoint test kalitini qabul qilmoqda.');
}
console.log(`PASS: ${base} — Payme live, baza tekshiruvi, ishchi kalit va test kalitini rad etish.`);
console.log('Haqiqiy karta to‘lovi bajarilmadi.');
