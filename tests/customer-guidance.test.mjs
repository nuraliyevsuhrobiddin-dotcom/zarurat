import{test}from'node:test';
import assert from'node:assert/strict';
import{tariffComparison,tariffConditions}from'../public/customer-guidance.js';
import{packageTiers}from'../public/package-tiers.js';

test('comparison and visible purchase conditions derive quotas from the same tier data',()=>{
 const tier={...packageTiers[0],monthlyPrice:123456,familyMembers:9,legalConsultations:7,psychologicalConsultations:6,businessConsultations:5};
 for(const script of ['lat','cyr']){
  const table=tariffComparison([tier],script),conditions=tariffConditions(tier,script);
  for(const value of ['123 456','9','7','6','5'])assert.ok(table.includes(`<td>${value}</td>`),`${script}: ${value}`);
  assert.ok(conditions.includes(script==='cyr'?'7 ҳуқуқий':'7 huquqiy'));
  assert.ok(conditions.includes(script==='cyr'?'6 психологик':'6 psixologik'));
  assert.ok(conditions.includes(script==='cyr'?'5 тадбиркорлик':'5 tadbirkorlik'));
  assert.doesNotMatch(conditions,/<details/,'cost and owner conditions must be visible before consent');
 }
 const zero=tariffComparison([packageTiers[0]]);
 assert.match(zero,/<td>—<\/td>/,'zero business allowance must not look unlimited');
});

test('tariff presentation escapes dynamic names and values rather than injecting markup',()=>{
 const tier={...packageTiers[0],name:'<img src=x onerror=alert(1)>',legalConsultations:'<script>1</script>'};
 for(const html of [tariffComparison([tier]),tariffConditions(tier)]){
  assert.doesNotMatch(html,/<img|<script>/);
  assert.ok(html.includes('&lt;script&gt;1&lt;/script&gt;'));
 }
});
