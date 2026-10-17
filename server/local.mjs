import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHandler } from './api.mjs';
import { pathToFileURL } from 'node:url';
import { paymeError } from './payme.mjs';

const root = resolve('public');
const securityHeaders = JSON.parse(await readFile('vercel.json','utf8')).headers[0].headers;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
export function createLocalServer(handler = createHandler()) {
return createServer(async(req,res)=>{
  for(const {key,value} of securityHeaders)res.setHeader(key,value);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.url.startsWith('/api/')){
    try{
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>4200000){res.statusCode=413;res.end(JSON.stringify({error:'So‘rov hajmi katta.'}));return;}chunks.push(chunk);}
      const raw=Buffer.concat(chunks).toString('utf8');
      req.body=raw?JSON.parse(raw):undefined;
      await handler(req,res);
    }catch{const payme=new URL(req.url,'http://localhost').pathname==='/api/payme';res.statusCode=payme?200:400;res.end(JSON.stringify(payme?{jsonrpc:'2.0',id:null,...paymeError(-32700,'JSON noto‘g‘ri.')}:{error:'So‘rov noto‘g‘ri.'}));}
    return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.statusCode=403;res.end();return;}
    const bytes=await readFile(file);
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(bytes);
  }catch{res.statusCode=404;res.end('Topilmadi.');}
});
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createLocalServer().listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`ZARURIYAT: http://localhost:${process.env.PORT||3000}`));
}
