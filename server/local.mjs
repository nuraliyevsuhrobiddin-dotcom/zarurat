import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHandler } from './api.mjs';

const root = resolve('public');
const handler = createHandler();
const securityHeaders = JSON.parse(await readFile('vercel.json','utf8')).headers[0].headers;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  for(const {key,value} of securityHeaders)res.setHeader(key,value);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.url.startsWith('/api/')){
    try{
      let raw='';
      for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4200000){res.statusCode=413;res.end(JSON.stringify({error:'So‘rov hajmi katta.'}));return;}}
      req.body=raw?JSON.parse(raw):undefined;
      await handler(req,res);
    }catch{res.statusCode=400;res.end(JSON.stringify({error:'So‘rov noto‘g‘ri.'}));}
    return;
  }
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.statusCode=403;res.end();return;}
    const bytes=await readFile(file);
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(bytes);
  }catch{res.statusCode=404;res.end('Topilmadi.');}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`ZARURIYAT: http://localhost:${process.env.PORT||3000}`));
