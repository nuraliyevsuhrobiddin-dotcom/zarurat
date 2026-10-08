import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler from '../api/proxy.mjs';

test('Vercel proxy preserves login body, origin, cookies and upstream errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.API_ORIGIN;
  process.env.API_ORIGIN = 'https://api.example.test';
  const request = Readable.from([Buffer.from('{"login":"director"}')]);
  Object.assign(request, { method: 'POST', url: '/api/auth/login', query: {path:'auth/login'}, headers: {'content-type':'application/json',origin:'https://site.example.test',cookie:'zar_session=test'} });
  const response = { headers: {}, status(code){this.statusCode=code;return this;}, json(value){this.result=value;}, setHeader(name,value){this.headers[name]=value;}, end(value){this.result=value;} };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.href, 'https://api.example.test/api/auth/login');
      assert.equal(options.body.toString(), '{"login":"director"}');
      assert.equal(options.headers.origin, 'https://site.example.test');
      assert.equal(options.headers.cookie, 'zar_session=test');
      return new Response('{"error":"Invalid login"}', {status:401,headers:{'content-type':'application/json','set-cookie':'zar_session=new; HttpOnly; Secure; Path=/'}});
    };
    await handler(request, response);
    assert.equal(response.statusCode,401);
    assert.deepEqual(response.headers['Set-Cookie'],['zar_session=new; HttpOnly; Secure; Path=/']);
    assert.equal(response.headers['Cache-Control'],'no-store');
    assert.equal(response.result.toString(),'{"error":"Invalid login"}');
  } finally {
    globalThis.fetch=originalFetch;
    if(originalOrigin===undefined)delete process.env.API_ORIGIN;else process.env.API_ORIGIN=originalOrigin;
  }
});
