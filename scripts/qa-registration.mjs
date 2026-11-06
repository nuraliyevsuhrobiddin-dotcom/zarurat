// Local-only Telegram registration QA; never reads .env or calls a real bot.
import{readFile,readdir}from'node:fs/promises';import{resolve}from'node:path';
import{PGlite}from'@electric-sql/pglite';import{pgcrypto}from'@electric-sql/pglite/contrib/pgcrypto';
import{createHandler}from'../server/api.mjs';import{testDatabase}from'../tests/helpers/database.mjs';
const workspace=process.cwd(),port=Number(process.env.QA_PORT||3107),env={PUBLIC_ORIGIN:'http://127.0.0.1:'+port,SESSION_SECRET:'qa-registration-session',FEATURE_TELEGRAM:'true',FEATURE_TELEGRAM_REGISTRATION:'true',TELEGRAM_BOT_TOKEN:'qa-registration',TELEGRAM_WEBHOOK_SECRET:'qa-registration-secret',SUPABASE_URL:'qa',SUPABASE_SERVICE_ROLE_KEY:'qa'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>String(url).startsWith('https://api.telegram.org/botqa-registration/')?{ok:true,status:200,json:async()=>({ok:true,result:String(url).endsWith('/getMe')?{username:'qa_registration_bot',is_bot:true}:{message_id:1}})}:originalFetch(url,options);
const pg=new PGlite({extensions:{pgcrypto}});await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');await pg.exec(await readFile('supabase-schema.sql','utf8'));
for(const f of(await readdir('migrations')).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await pg.exec(await readFile('migrations/'+f,'utf8'));
const staticRoot=resolve(process.argv[2]||'.');if(staticRoot!==workspace&&!staticRoot.startsWith(workspace+'\\')&&!staticRoot.startsWith(workspace+'/'))throw Error('QA root must stay in workspace');process.chdir(staticRoot);
const{createLocalServer}=await import('../server/local.mjs');const server=createLocalServer(createHandler({db:testDatabase(pg),env}));server.listen(port,'127.0.0.1',()=>console.log('Isolated registration QA: '+env.PUBLIC_ORIGIN));
async function close(){server.close();await pg.close();process.exit(0)}process.on('SIGINT',close);process.on('SIGTERM',close);
