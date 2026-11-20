import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

test('canonical redirects preserve legacy Payme callback URLs while redirecting public pages',()=>{
 for(const host of ['zarurat-inky.vercel.app','zaruriyat.uz']){
  const rule=config.redirects.find(rule=>rule.has?.some(item=>item.type==='host'&&item.value===host));
  assert.ok(rule,`${host} needs a canonical redirect`);
  assert.ok(rule.source.startsWith('/:path(')&&rule.source.endsWith(')'));
  const matcher=new RegExp('^/'+rule.source.slice('/:path('.length,-1)+'$');
  assert.equal(matcher.test('/api/payme'),false,'Payme callback must reach the authenticated handler directly');
  assert.equal(matcher.test('/api/payme/'),false);
  for(const path of ['/','/xizmatlar/','/images/logo.png','/api/auth/me'])assert.equal(matcher.test(path),true);
  assert.equal(rule.destination,'https://www.zaruriyat.uz/:path');
 }
});
