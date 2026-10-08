import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { openDatabase } from '../lib/database.mjs';
import { passwordHash, phone, str, choice, assert } from '../lib/domain.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=resolve(process.env.DATA_DIR || resolve(root,'data'));
let db;
try {
  db=openDatabase(resolve(dataDir,'zaruriyat.sqlite'),process.env.DEMO_MODE!=='false');
  const command=process.argv[2];
  if(command==='add-user') {
    const login=str(process.env.NEW_USER_LOGIN,'NEW_USER_LOGIN',3,100).toLowerCase();
    assert(/^[a-z0-9._-]+$/.test(login),'Login faqat lotin harflari, raqamlar, nuqta, chiziq yoki pastki chiziqdan iborat bo‘lsin.');
    const name=str(process.env.NEW_USER_NAME,'NEW_USER_NAME',2,100),mobile=phone(process.env.NEW_USER_PHONE);
    const password=str(process.env.NEW_USER_PASSWORD,'NEW_USER_PASSWORD',14,128);
    const role=choice(process.env.NEW_USER_ROLE,['operator','director','partner'],'NEW_USER_ROLE');
    const partnerId=role==='partner' ? Number(process.env.NEW_USER_PARTNER_ID) : null;
    if(role==='partner') assert(Number.isSafeInteger(partnerId) && db.prepare('SELECT id FROM partners WHERE id=?').get(partnerId),'Hamkor uchun mavjud NEW_USER_PARTNER_ID kerak.');
    assert(!db.prepare('SELECT id FROM users WHERE login=? OR phone=?').get(login,mobile),'Login yoki telefon allaqachon mavjud.');
    db.prepare('INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES (?,?,?,?,?,?)').run(login,name,mobile,passwordHash(password),role,partnerId);
    console.log(`Foydalanuvchi yaratildi: ${login} (${role}).`);
  } else if(command==='backup') {
    const backupDir=resolve(dataDir,'backups');mkdirSync(backupDir,{recursive:true});
    const destination=resolve(backupDir,`zaruriyat-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
    db.prepare('VACUUM INTO ?').run(destination);
    console.log(`Zaxira nusxa: ${destination}`);
  } else throw new Error('Amallar: npm run user:add yoki npm run backup. README.md ga qarang.');
} catch(error) {console.error(error.message);process.exitCode=1;} finally {db?.close();}
