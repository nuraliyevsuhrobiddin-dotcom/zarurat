// Isolated browser QA. Never loads .env or connects to the production database.
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createLocalServer } from '../server/local.mjs';
import { createHandler } from '../server/api.mjs';
import { testDatabase } from '../tests/helpers/database.mjs';

const port=Number(process.env.QA_PORT||3101);
const env={PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,SESSION_SECRET:'isolated-browser-qa-secret',FEATURE_STAGE2:'true',SUPABASE_URL:'qa',SUPABASE_SERVICE_ROLE_KEY:'qa'};
if(process.env.QA_PAYME==='true')Object.assign(env,{FEATURE_PAYME:'true',PAYME_MODE:'test',PAYME_MERCHANT_ID:'qa-only-merchant',PAYME_TEST_KEY:'qa-only-test-key'});
const pg=new PGlite({extensions:{pgcrypto}});
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
await pg.exec(await readFile('supabase-schema.sql','utf8'));
await pg.exec(await readFile('migrations/002_accounts_notifications.sql','utf8'));
await pg.exec(await readFile('migrations/006_telegram_recovery.sql','utf8'));
await pg.exec(await readFile('migrations/007_telegram_registration.sql','utf8'));
await pg.exec(await readFile('migrations/008_telegram_contact_recovery.sql','utf8'));
await pg.exec(await readFile('migrations/009_telegram_recovery_retries.sql','utf8'));
await pg.exec(await readFile('migrations/010_telegram_cases.sql','utf8'));
await pg.exec(`
 INSERT INTO partners(name,phone,address,category,hours,region,price,contract_status)
 VALUES('QA hamkor','+998901111115','QA Qarshi','legal','09:00-18:00','Qashqadaryo',0,'active');
 INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES
 ('qa-director','QA Rahbar','+998901111111',extensions.crypt('qa-password-2026',extensions.gen_salt('bf',4)),'director',NULL),
 ('qa-operator','QA Koordinator','+998901111112',extensions.crypt('qa-password-2026',extensions.gen_salt('bf',4)),'operator',NULL),
 ('qa-client','QA Mijoz','+998901111113',extensions.crypt('qa-password-2026',extensions.gen_salt('bf',4)),'client',NULL),
 ('qa-partner','QA Hamkor','+998901111114',extensions.crypt('qa-password-2026',extensions.gen_salt('bf',4)),'partner',1);
 SELECT zar_create_request('{"name":"QA Mijoz","phone":"+998901111113","region":"Qashqadaryo","category":"legal","description":"QA oilaviy huquqiy yordam","preferred_time":"Istalgan vaqt","attachments":[]}',3);
 SELECT zar_save_package(3,'Komfort',now()+interval '1 year',5,'["QA Mijoz"]');
`);
const server=createLocalServer(createHandler({db:testDatabase(pg),env}));
server.listen(port,'127.0.0.1',()=>console.log(`Isolated QA: ${env.PUBLIC_ORIGIN} (qa-director / qa-password-2026; other roles qa-operator, qa-client, qa-partner)`));
async function close(){server.close();await pg.close();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
