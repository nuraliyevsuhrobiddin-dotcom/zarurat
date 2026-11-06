import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {buildSearchPages,enhanceSearchHome,searchOrigin,serviceSlugs} from '../scripts/build-search-pages.mjs';
import {publicConfig} from '../public/supabase-api.js';
import {createLocalServer} from '../server/local.mjs';

test('search pages have real canonical URLs and service-specific enquiry links without private data',async()=>{
 const cache=resolve('.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'seo-tests-'));
 try{
  await writeFile(join(dir,'index.html'),await readFile('public/index.html','utf8'));
  const result=await buildSearchPages(dir);assert.equal(result.pages,18);
  const sitemap=await readFile(join(dir,'sitemap.xml'),'utf8');
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(urls).size,18);
  assert.ok(urls.every(u=>u.startsWith(searchOrigin+'/')&&!/[#?]/.test(u)));
  const titles=new Set();
  for(const url of urls){
   const pathname=new URL(url).pathname;const html=await readFile(join(dir,pathname,'index.html'),'utf8');
   assert.ok(html.includes(`rel="canonical" href="${url}"`));
   assert.equal((html.match(/<h1[\s>]/g)||[]).length,1);
   const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title));titles.add(title);
   for(const match of html.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/g))assert.doesNotThrow(()=>JSON.parse(match[1]));
   assert.doesNotMatch(html,/noindex|password_hash|trackingToken|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  }
  for(const c of publicConfig.categories){const html=await readFile(join(dir,'xizmatlar',serviceSlugs[c.id],'index.html'),'utf8');assert.ok(html.includes(`/#request?category=${c.id}`));assert.ok(html.includes('"@type":"Service"'));}
  const contact=await readFile(join(dir,'aloqa/index.html'),'utf8');assert.ok(contact.includes('Yoshlar texnoparki'));assert.ok(contact.includes('24/7'));
  const robots=await readFile(join(dir,'robots.txt'),'utf8');assert.match(robots,/Allow: \/\n/);assert.ok(robots.includes('Sitemap: '+searchOrigin+'/sitemap.xml'));assert.doesNotMatch(robots,/Disallow: \/\s*$/m);
 }finally{assert.ok(dir.startsWith(cache+'\\')||dir.startsWith(cache+'/'));await rm(dir,{recursive:true,force:true});}
});

test('home search enhancement is repeatable and preserves application and ownership verification',async()=>{
 const original=await readFile('public/index.html','utf8');const input=original.replace('</head>','<meta name="google-site-verification" content="QA-public-token">\n</head>');
 const once=enhanceSearchHome(input),twice=enhanceSearchHome(once);
 assert.equal(twice,once);assert.ok(twice.includes('content="QA-public-token"'));
 assert.equal((twice.match(/rel="canonical"/g)||[]).length,1);
 assert.ok(twice.includes('id="app"'));assert.ok(twice.includes('src="/app.js?v='));assert.ok(twice.includes('id="modal"'));assert.ok(twice.includes('id="toast"'));
 const startup=twice.match(/<div id="app">([\s\S]*?)<\/div>\s*<dialog/)[1];
 assert.doesNotMatch(startup,/<h1|<ul|Qarshida|Yoshlar/);
 assert.match(startup,/aria-busy="true"/);
 assert.match(twice,/<noscript>[\s\S]*?Barcha xizmatlar[\s\S]*?<\/noscript>/);
});

test('local HTTP serves search documents with correct MIME and real unknown pages return 404',async()=>{
 const server=createLocalServer(()=>{throw Error('Static check must not call API');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const [path,type] of [['/sitemap.xml','application/xml'],['/robots.txt','text/plain'],['/xizmatlar/huquqiy-yordam/','text/html']]){const r=await fetch(base+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(type));assert.ok((await r.text()).length>0);}
  assert.equal((await fetch(base+'/xizmatlar/nonexistent/')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
