import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { passwordHash, phone, now, secret, statusNames, statuses } from './domain.mjs';

export function openDatabase(filename, demo = true) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS partners (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, category TEXT NOT NULL, hours TEXT NOT NULL, region TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, contract_status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('client','operator','director','partner')), partner_id INTEGER REFERENCES partners(id));
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE, client_id INTEGER REFERENCES users(id), name TEXT NOT NULL, phone TEXT NOT NULL, region TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, preferred_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', priority TEXT NOT NULL DEFAULT 'normal', coordinator_id INTEGER REFERENCES users(id), due_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, tracking_token TEXT NOT NULL, consent_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), title TEXT NOT NULL, partner_id INTEGER REFERENCES partners(id), status TEXT NOT NULL DEFAULT 'pending', price INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), kind TEXT NOT NULL, message TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS feedback (case_id INTEGER PRIMARY KEY REFERENCES cases(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS packages (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES users(id), tier TEXT NOT NULL, expires_at TEXT NOT NULL, service_limit INTEGER NOT NULL CHECK(service_limit > 0), members TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS package_usage (id INTEGER PRIMARY KEY, package_id INTEGER NOT NULL REFERENCES packages(id), case_id INTEGER NOT NULL UNIQUE REFERENCES cases(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), event TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'telegram', status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, recipient_phone TEXT, message TEXT);
    CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
    CREATE INDEX IF NOT EXISTS idx_cases_status_due ON cases(status,due_at);
    CREATE INDEX IF NOT EXISTS idx_services_partner ON services(partner_id,case_id);
    CREATE INDEX IF NOT EXISTS idx_history_case ON history(case_id,id);
  `);
  const notificationColumns = new Set(db.prepare('PRAGMA table_info(notifications)').all().map(column => column.name));
  for (const column of ['recipient_phone', 'message']) {
    if (!notificationColumns.has(column)) db.exec(`ALTER TABLE notifications ADD COLUMN ${column} TEXT`);
  }
  const previousMode = db.prepare('SELECT value FROM meta WHERE key=?').get('mode')?.value;
  if (previousMode === 'demo' && !demo) throw new Error('Demo database cannot run in production. Choose a new DATA_DIR.');
  if (previousMode === 'production' && demo) throw new Error('Production database requires DEMO_MODE=false.');
  if (!previousMode) {
    if (!demo && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 14)) throw new Error('Set ADMIN_PASSWORD with at least 14 characters for non-demo initialization.');
    if (demo) {
      seed(db);
      db.prepare('INSERT INTO meta VALUES (?,?)').run('mode', 'demo');
    } else {
      const pwd = process.env.ADMIN_PASSWORD;
      if (!pwd || pwd.length < 14) throw new Error('Set ADMIN_PASSWORD with at least 14 characters for non-demo initialization.');
      const adminPhone = phone(process.env.ADMIN_PHONE);
      transaction(db, () => {
        db.prepare('INSERT INTO users(login,name,phone,password_hash,role) VALUES (?,?,?,?,?)').run('director', 'Rahbar', adminPhone, passwordHash(pwd), 'director');
        db.prepare('INSERT INTO meta VALUES (?,?)').run('mode', 'production');
      });
    }
  }
  return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function transaction(db, callback) { db.exec('BEGIN IMMEDIATE'); try { const result = callback(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
export function addHistory(db, id, kind, message, actor = 'Tizim') { db.prepare('INSERT INTO history(case_id,kind,message,actor_name,created_at) VALUES (?,?,?,?,?)').run(id, kind, message, actor, now()); }
export function enqueue(db, id, event, customMessage = null) {
  let message = customMessage;
  let phone = null;
  try {
    const c = db.prepare('SELECT number, phone, status FROM cases WHERE id=?').get(id);
    if (c) {
      phone = c.phone;
      if (!message) {
        if (event === 'request.created') {
          message = `«Мурожаатингиз қабул қилинди. Рақамингиз: ${c.number || ('ZAR-' + String(id).padStart(6, '0'))}.» ZARURIYAT мувофиқлаштириш тизими.`;
        } else if (event === 'case.status_changed') {
          const sName = statusNames[statuses.indexOf(c.status)] || c.status;
          message = `«${c.number} рақамли мурожаатингиз ҳолати янгиланди: ${sName}.»`;
        } else if (event === 'service.assigned') {
          message = `«${c.number} рақамли мурожаатингиз бўйича масъул ҳамкор мутахассис бириктирилди.»`;
        } else if (event === 'service.status_changed') {
          message = `«${c.number} рақамли мурожаатингиз хизмати ҳолати янгиланди.»`;
        } else {
          message = `«${c.number || id} бўйича янги билдиришнома: ${event}»`;
        }
      }
    }
  } catch {}
  db.prepare('INSERT INTO notifications(case_id,event,channel,status,created_at,recipient_phone,message) VALUES (?,?,?,?,?,?,?)').run(id, event, 'telegram', 'queued', now(), phone, message);
}

function seed(db) {
  transaction(db, () => {
    const partners = [
      ['Mehr parvarish · namuna', '+998900000101', 'Toshkent, Chilonzor', 'care', '09:00–18:00', 'Toshkent shahri', 150000, 'active'],
      ['Huquqiy ko‘mak · namuna', '+998900000102', 'Toshkent, Yunusobod', 'legal', '09:00–18:00', 'Toshkent shahri', 200000, 'active'],
      ['Ozoda uy · namuna', '+998900000103', 'Samarqand shahri', 'cleaning', '08:00–20:00', 'Samarqand', 250000, 'pending'],
    ];
    for (const p of partners) db.prepare('INSERT INTO partners(name,phone,address,category,hours,region,price,contract_status) VALUES (?,?,?,?,?,?,?,?)').run(...p);
    const hash = passwordHash('Zaruriyat2026!');
    for (const [login, name, phone, role, partnerId] of [
      ['operator', 'Madina Karimova', '+998900000011', 'operator', null],
      ['director', 'Aziz Rahimov', '+998900000012', 'director', null],
      ['partner', 'Mehr parvarish', '+998900000013', 'partner', 1],
      ['client', 'Dilnoza Akmalova', '+998900000014', 'client', null],
    ]) db.prepare('INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES (?,?,?,?,?,?)').run(login, name, phone, hash, role, partnerId);
    const cases = [
      ['Dilnoza Akmalova', 'care', 'Onam uchun uyda kundalik parvarish va shifokor ko‘rigini tashkil qilish kerak.', 'arranging', 'urgent'],
      ['Dilnoza Akmalova', 'legal', 'Ijara shartnomasini ko‘rib chiqish bo‘yicha mutaxassis kerak.', 'reviewing', 'normal'],
      ['Dilnoza Akmalova', 'cleaning', 'Uyimizni ko‘chib kirishdan oldin tozalash kerak.', 'completed', 'normal'],
      ['Sardor Aliyev', 'repair', 'Oshxonadagi suv quvurini ta’mirlash uchun usta kerak.', 'received', 'normal'],
    ];
    cases.forEach(([name, category, description, status, priority], index) => {
      const time = new Date(Date.now() - index * 86400000).toISOString();
      const due = new Date(Date.now() + (index === 1 ? -6 : 24) * 3600000).toISOString();
      const result = db.prepare('INSERT INTO cases(number,client_id,name,phone,region,category,description,preferred_time,status,priority,coordinator_id,due_at,created_at,updated_at,tracking_token,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(`ZAR-${String(index+1).padStart(6,'0')}`, index < 3 ? 4 : null, name, index < 3 ? '+998900000014' : '+998900000015', 'Toshkent shahri', category, description, 'Ish kunlari, 10:00–14:00', status, priority, index === 3 ? null : 1, due, time, time, secret(), time);
      const id = Number(result.lastInsertRowid);
      addHistory(db, id, 'status', 'Qabul qilindi (namuna ma’lumot).');
      if (status !== 'received') addHistory(db, id, 'status', statusNames[statuses.indexOf(status)], 'Madina Karimova');
      enqueue(db, id, 'request.created');
    });
    db.prepare('INSERT INTO services(case_id,title,partner_id,status,price) VALUES (?,?,?,?,?)').run(1, 'Uyda parvarish', 1, 'accepted', 150000);
    db.prepare('INSERT INTO services(case_id,title,partner_id,status,price) VALUES (?,?,?,?,?)').run(1, 'Shifokor ko‘rigi', null, 'pending', 0);
    db.prepare('INSERT INTO services(case_id,title,partner_id,status,price) VALUES (?,?,?,?,?)').run(3, 'Uy tozalash', 3, 'completed', 250000);
    db.prepare('INSERT INTO feedback VALUES (?,?,?,?)').run(3, 5, 'Namunaviy baho.', now());
    db.prepare('INSERT INTO packages(client_id,tier,expires_at,service_limit,members) VALUES (?,?,?,?,?)').run(4, 'Komfort', new Date(Date.now() + 90 * 86400000).toISOString(), 12, JSON.stringify(['Dilnoza Akmalova', 'Oila a’zosi']));
    db.prepare('INSERT INTO package_usage(package_id,case_id,created_at) VALUES (?,?,?)').run(1, 3, now());
  });
}
