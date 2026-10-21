// Read-only checks; credentials and customer records are never printed.
import { createDatabase } from '../server/db.mjs';
import { smsReady, telegramReady } from '../server/providers.mjs';
import {paymeReady,paymeMode} from '../server/payme.mjs';

const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok,detail});
const env=process.env;
let originValid=false;
try{const origin=new URL(env.PUBLIC_ORIGIN);originValid=['http:','https:'].includes(origin.protocol)&&origin.origin===env.PUBLIC_ORIGIN;}catch{}
add('PUBLIC_ORIGIN',originValid,'Exact site origin required.');
add('Server database credentials',Boolean(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY));
if(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY){
 const db=createDatabase(env);
 for(const [rpc,name] of [['zar_stats','Database connection'],['zar_capabilities','Migration 003: intake clarification'],['zar_client_counts','Migration 003: complete client counts']]){
  try{const result=await db(`rpc/${rpc}`,{method:'POST',body:{}});add(name,rpc==='zar_capabilities'?result?.clarification===true:result!==null);}
  catch{add(name,false,rpc==='zar_stats'?'Check server/database connection.':'Apply migrations/003_intake_clarification.sql in Supabase SQL Editor.');}
 }
 if(env.FEATURE_PAYME==='true'){
  add('Payme environment',paymeReady(env),'Set merchant ID, active-mode key, account field and exact PUBLIC_ORIGIN.');
  try{add('Migration 004: Payme',await db('rpc/zar_payment_ready',{method:'POST',body:{}})===true,'Apply migrations/004_payme.sql in Supabase SQL Editor.');}
  catch{add('Migration 004: Payme',false,'Apply migrations/004_payme.sql in Supabase SQL Editor.');}
 }
 if(env.FEATURE_STAGE2==='true'||telegramReady(env)){
  for(const [table,fields] of [['users','blocked_at,phone_verified_at,telegram_chat_id'],['telegram_links','token_hash'],['otp_challenges','id']]){
   try{await db(table,{query:`select=${fields}&limit=0`});add(`Migration 002: ${table}`,true);}
   catch{add(`Migration 002: ${table}`,false,'Apply migrations/002_accounts_notifications.sql.');}
  }
  if(telegramReady(env)){
   try{await db('telegram_recovery',{query:'select=id&limit=0'});add('Migration 006: Telegram recovery',true);}
   catch{add('Migration 006: Telegram recovery',false,'Apply migrations/006_telegram_recovery.sql.');}
  }
  if(env.FEATURE_TELEGRAM_REGISTRATION==='true'){
   try{await db('telegram_registrations',{query:'select=token_hash&limit=0'});add('Migration 007: Telegram registration',true);}
   catch{add('Migration 007: Telegram registration',false,'Apply migrations/007_telegram_registration.sql.');}
  }
 }
 if(env.SUPABASE_ANON_KEY){
  for(const table of ['users','cases','attachments']){
   try{const response=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}?select=id&limit=1`,{method:'HEAD',signal:AbortSignal.timeout(15000),headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${env.SUPABASE_ANON_KEY}`}});add(`Anonymous access blocked: ${table}`,[401,403].includes(response.status));}
   catch{add(`Anonymous access blocked: ${table}`,false,'Connection check failed.');}
  }
 }
}
for(const {name,ok,detail} of checks)console.log(`${ok?'PASS':'REQUIRED'}: ${name}${!ok&&detail?' — '+detail:''}`);
console.log(`Optional SMS: ${smsReady(env)?'configured':'disabled'}`);
console.log(`Optional Telegram: ${telegramReady(env)?'configured':'disabled'}`);
console.log(`Payme: ${paymeReady(env)?`configured (${paymeMode(env)})`:'disabled or configuration incomplete'}`);
console.log(`Backup configuration: ${env.BACKUP_ENCRYPTION_KEY&&env.CRON_SECRET?'present':'incomplete'}`);
process.exitCode=checks.some(check=>!check.ok)?1:0;
