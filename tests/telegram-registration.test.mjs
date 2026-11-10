import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHandler} from '../server/api.mjs';
import {testDatabase} from './helpers/database.mjs';

let pg,handler;
const env={PUBLIC_ORIGIN:'https://registration.example',FEATURE_TELEGRAM_REGISTRATION:'true',SESSION_SECRET:'qa-session',SUPABASE_SERVICE_ROLE_KEY:'qa'};
const input={name:'New client',phone:'+998901234567',password:'client-password-2026',consent:true};
async function call(path,body){
 const req={url:'/api'+path,method:body===undefined?'GET':'POST',body,headers:{origin:env.PUBLIC_ORIGIN,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.data=JSON.parse(s)}};
 await handler(req,res);return res;
}
before(async()=>{
 pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 for(const file of ['supabase-schema.sql','migrations/002_accounts_notifications.sql'])await pg.exec(await readFile(file,'utf8'));
 const database=testDatabase(pg);
 handler=createHandler({db:database,env});
});
after(async()=>{await pg?.close()});

test('legacy Telegram registration flag is ignored and a client can register without bot confirmation',async()=>{
 assert.equal((await call('/auth/options')).data.registrationTelegramRequired,false);
 const created=await call('/auth/register',{...input,role:'director'});
 assert.equal(created.statusCode,200);
 assert.equal(created.data.user.role,'client');
 assert.equal(created.data.user.phone,input.phone);
 const user=(await pg.query('SELECT phone_verified_at,telegram_chat_id FROM users WHERE phone=$1',[input.phone])).rows[0];
 assert.equal(user.phone_verified_at,null);
 assert.equal(user.telegram_chat_id,null);
 assert.match(created.headers['Set-Cookie'],/HttpOnly/);
});

test('legacy Telegram registration endpoints stay disabled',async()=>{
 assert.equal((await call('/auth/register/telegram/start',{phone:input.phone,consent:true})).statusCode,503);
 assert.equal((await call('/auth/register/telegram/status',{challenge:'a'.repeat(48),phone:input.phone})).statusCode,503);
 assert.equal((await pg.query('SELECT count(*) AS n FROM users')).rows[0].n,1);
});
