import{test}from'node:test';import assert from'node:assert/strict';import{validRegistrationProof}from'../public/registration-flow.js';
test('registration resume keeps only a short-lived phone-bound proof and never credentials',()=>{
 const now=Date.now(),proof={challenge:'a'.repeat(48),phone:'+998901234567',url:'https://t.me/qa_bot?start=r_'+'a'.repeat(48),expiresAt:now+900000,name:'must not persist',password:'must not persist',verified:true};
 const saved=validRegistrationProof(proof,now);assert.deepEqual(Object.keys(saved).sort(),['challenge','expiresAt','phone','url']);
 assert.equal(validRegistrationProof({...proof,expiresAt:now},now),null);
 assert.equal(validRegistrationProof({...proof,expiresAt:now+10000000},now),null);
 for(const url of['javascript:alert(1)','https://evil.example/?start=r_'+'a'.repeat(48),'https://t.me/qa_bot?start=r_'+'b'.repeat(48)])assert.equal(validRegistrationProof({...proof,url},now),null);
 assert.equal(validRegistrationProof({...proof,phone:'+123'},now),null);
});
