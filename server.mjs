import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openDatabase, transaction, addHistory, enqueue } from './lib/database.mjs';
import { AppError, assert, categories, regions, statuses, statusNames, serviceStatuses, str, phone, choice, integer, date, passwordHash, verifyPassword, secret, digest, now, isTerminal, parseAttachments } from './lib/domain.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(ROOT, 'public');
const staffRoles = ['operator', 'director'];
const SESSION_HOURS = 12;
const dummyHash = passwordHash(randomBytes(32).toString('hex'));

export function createApp({ database = resolve(process.env.DATA_DIR || resolve(ROOT, 'data'), 'zaruriyat.sqlite'), demo = process.env.DEMO_MODE !== 'false' } = {}) {
  const db = openDatabase(database, demo);
  const limits = new Map();
  const staff = user => user && staffRoles.includes(user.role);
  const userView = row => row ? { id: row.id, name: row.name, role: row.role, phone: row.phone, partnerId: row.partner_id } : null;
  const partnerView = row => ({ id: row.id, name: row.name, phone: row.phone, address: row.address, category: row.category, hours: row.hours, region: row.region, price: row.price, contractStatus: row.contract_status });
  const getUser = req => {
    const cookie = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('zar_session='))?.slice(12);
    if (!cookie || cookie.length > 100) return null;
    return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(cookie), now()) || null;
  };
  const requireUser = user => { assert(user, 'Davom etish uchun kabinetga kiring.', 401); };
  const requireStaff = user => { requireUser(user); assert(staff(user), 'Bu amal uchun ruxsat yo‘q.', 403); };
  function canAccess(row, user) {
    if (!row || !user) return false;
    return staff(user) || (user.role === 'client' && row.client_id === user.id) || (user.role === 'partner' && !!db.prepare('SELECT id FROM services WHERE case_id=? AND partner_id=?').get(row.id, user.partner_id));
  }
  function getCase(id, user) {
    requireUser(user);
    const row = db.prepare('SELECT * FROM cases WHERE id=?').get(id);
    assert(canAccess(row, user), 'Murojaat topilmadi.', 404);
    return row;
  }
  function caseView(row, user = null, publicTracking = false) {
    const partner = user?.role === 'partner';
    let services = db.prepare('SELECT s.*,p.name AS partner_name FROM services s LEFT JOIN partners p ON p.id=s.partner_id WHERE s.case_id=? ORDER BY s.id').all(row.id);
    if (partner) services = services.filter(s => s.partner_id === user.partner_id);
    let history = db.prepare('SELECT * FROM history WHERE case_id=? ORDER BY id').all(row.id);
    if (!staff(user)) history = history.filter(h => h.kind === 'status');
    const attachments = publicTracking || partner ? [] : db.prepare('SELECT id,name,type,size FROM attachments WHERE case_id=? ORDER BY id').all(row.id);
    const feedback = partner ? null : db.prepare('SELECT rating,comment FROM feedback WHERE case_id=?').get(row.id);
    return {
      id: row.id, number: row.number, name: row.name, phone: row.phone, region: row.region,
      category: row.category, description: partner ? 'Biriktirilgan xizmat tafsilotlarini koordinator bilan aniqlashtiring.' : row.description,
      preferredTime: row.preferred_time, status: row.status, priority: row.priority,
      coordinatorId: row.coordinator_id, coordinatorName: row.coordinator_id ? db.prepare('SELECT name FROM users WHERE id=?').get(row.coordinator_id)?.name : null,
      dueAt: row.due_at, createdAt: row.created_at, updatedAt: row.updated_at, clientId: partner ? null : row.client_id,
      services: services.map(s => ({ id:s.id, caseId:s.case_id, title:s.title, partnerId:s.partner_id, partnerName:s.partner_name, status:s.status, price:s.price })),
      history: history.map(h => ({id:h.id, kind:h.kind, message:h.message, actorName:h.actor_name, createdAt:h.created_at})),
      attachments, feedback: feedback || null,
      ...(!partner && !publicTracking ? { familyPackage: row.client_id ? clientPackage(row.client_id) : null } : {}),
      ...(user?.role === 'client' && row.client_id === user.id ? { trackingToken: row.tracking_token } : {}),
    };
  }
  function clientPackage(clientId) {
    const row = db.prepare('SELECT * FROM packages WHERE client_id=?').get(clientId);
    return row ? packageView(row) : null;
  }
  function packageView(row) {
    const used = db.prepare('SELECT count(*) AS n FROM package_usage WHERE package_id=?').get(row.id).n;
    const remaining = Math.max(0, row.service_limit - used);
    const status = row.expires_at <= now() ? 'expired' : remaining === 0 ? 'exhausted' : 'active';
    return {status, id:row.id, clientId:row.client_id, clientName:db.prepare('SELECT name FROM users WHERE id=?').get(row.client_id).name, tier:row.tier, expiresAt:row.expires_at, limit:row.service_limit, used, remaining, members:JSON.parse(row.members)};
  }
  function throttle(req, key, max, minutes) {
    const time = Date.now();
    if (limits.size > 10000) for (const [k,v] of limits) if (v.until < time) limits.delete(k);
    const id = `${req.socket.remoteAddress}:${key}`;
    const entry = limits.get(id);
    if (!entry || entry.until < time) limits.set(id, { count:1, until:time + minutes*60000 });
    else { assert(entry.count < max, 'Urinishlar ko‘payib ketdi. Birozdan so‘ng qayta urinib ko‘ring.', 429); entry.count++; }
  }
  function setSession(res, user) {
    const token = secret();
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),user.id,new Date(Date.now()+SESSION_HOURS*3600000).toISOString());
    res.setHeader('Set-Cookie', `zar_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS*3600}${process.env.SECURE_COOKIE === 'true' ? '; Secure' : ''}`);
  }
  function clearCurrentSession(req) {
    const cookie = String(req.headers.cookie || '').split(';').map(c=>c.trim()).find(c=>c.startsWith('zar_session='))?.slice(12);
    if (cookie) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(cookie));
  }
  function tracking(body) {
    const number = str(body.number,'Murojaat raqami', 10, 30).toUpperCase();
    const token = str(body.token,'Maxfiy kod', 10, 100);
    const row = db.prepare('SELECT * FROM cases WHERE number=?').get(number);
    assert(row && timingSafeEqual(Buffer.from(digest(row.tracking_token)),Buffer.from(digest(token))), 'Murojaat raqami yoki maxfiy kod noto‘g‘ri.', 404);
    return row;
  }
  function mutable(row) { assert(!isTerminal(row.status), 'Yakunlangan yoki bekor qilingan murojaatni o‘zgartirib bo‘lmaydi.', 409); }
  function partnerExists(id) {
    integer(id,'Hamkor',1);
    const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(id);
    assert(partner && partner.contract_status === 'active', 'Faol shartnomali hamkorni tanlang.');
    return partner;
  }

  async function handleApi(req, res, path, user, body) {
    const method = req.method;
    if (method === 'GET' && path === '/api/health') {
      db.prepare('SELECT 1').get();
      return { ok: true };
    }
    if (method === 'GET' && path === '/api/config') return { categories, regions, statuses, demo };
    if (method === 'GET' && path === '/api/auth/me') return {user:userView(user)};
    if (method === 'POST' && path === '/api/auth/login') {
      throttle(req,'login',20,15);
      const login = str(body.login,'Login',1,100);
      const pwd = str(body.password,'Parol',1,128);
      const normalizedLogin = /^[+\d\s()\-]+$/.test(login) ? phone(login) : login.toLowerCase();
      const found = db.prepare('SELECT * FROM users WHERE login=? OR phone=?').get(normalizedLogin,normalizedLogin);
      const valid = verifyPassword(pwd, found?.password_hash || dummyHash);
      assert(found && valid,'Login yoki parol noto‘g‘ri.',401);
      clearCurrentSession(req); setSession(res,found);
      return {user:userView(found)};
    }
    if (method === 'POST' && path === '/api/auth/register') {
      throttle(req,'register',10,60);
      const name = str(body.name,'Ism',2,100), mobile = phone(body.phone), pwd = str(body.password,'Parol',10,128);
      assert(body.consent === true,'Shaxsiy ma’lumotlarni qayta ishlashga rozilik kerak.');
      assert(!db.prepare('SELECT id FROM users WHERE phone=? OR login=?').get(mobile,mobile),'Bu telefon ro‘yxatdan o‘tgan.',409);
      const result = db.prepare('INSERT INTO users(login,name,phone,password_hash,role) VALUES (?,?,?,?,?)').run(mobile,name,mobile,passwordHash(pwd),'client');
      const created = db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid));
      clearCurrentSession(req); setSession(res,created); res.statusCode=201;
      return {user:userView(created)};
    }
    if (method === 'POST' && path === '/api/auth/logout') {
      clearCurrentSession(req); res.setHeader('Set-Cookie','zar_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return {ok:true};
    }
    if (method === 'POST' && path === '/api/requests') {
      throttle(req,'requests',20,60);
      const input = {
        name:str(body.name,'Ism',2,100), phone:phone(body.phone), region:choice(body.region,regions,'Hudud'),
        category:choice(body.category,categories.map(c=>c.id),'Yo‘nalish'), description:str(body.description,'Muammo tavsifi',10,5000),
        preferredTime:str(body.preferredTime || 'Istalgan qulay vaqt','Qulay vaqt',1,200),
      };
      assert(body.consent === true,'Shaxsiy ma’lumotlarni qayta ishlashga rozilik kerak.');
      const files = parseAttachments(body.attachments);
      const id = transaction(db, () => {
        const time = now();
        const result = db.prepare('INSERT INTO cases(client_id,name,phone,region,category,description,preferred_time,due_at,created_at,updated_at,tracking_token,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(user?.role === 'client' ? user.id : null,input.name,input.phone,input.region,input.category,input.description,input.preferredTime,new Date(Date.now()+24*3600000).toISOString(),time,time,secret(),time);
        const id=Number(result.lastInsertRowid);
        db.prepare('UPDATE cases SET number=? WHERE id=?').run(`ZAR-${String(id).padStart(6,'0')}`,id);
        for (const f of files) db.prepare('INSERT INTO attachments(case_id,name,type,size,data) VALUES (?,?,?,?,?)').run(id,f.name,f.type,f.size,f.data);
        addHistory(db,id,'status','Qabul qilindi'); enqueue(db,id,'request.created');
        return id;
      });
      res.statusCode=201;
      const row=db.prepare('SELECT * FROM cases WHERE id=?').get(id);
      return {case:caseView(row,user,true),trackingToken:row.tracking_token};
    }
    if (method === 'POST' && path === '/api/track') { throttle(req,'tracking',40,15); return {case:caseView(tracking(body),null,true)}; }
    if (method === 'POST' && path === '/api/feedback') {
      throttle(req,'feedback',30,15); const row=tracking(body);
      assert(row.status === 'completed','Faqat yakunlangan xizmatni baholash mumkin.',409);
      const rating=integer(body.rating,'Baho',1,5), comment=str(body.comment || '', 'Izoh',0,2000);
      assert(!db.prepare('SELECT case_id FROM feedback WHERE case_id=?').get(row.id),'Bu murojaat baholangan.',409);
      db.prepare('INSERT INTO feedback VALUES (?,?,?,?)').run(row.id,rating,comment,now()); return {ok:true};
    }
    if (method === 'GET' && path === '/api/cases') {
      requireUser(user);
      const rows=staff(user) ? db.prepare('SELECT * FROM cases ORDER BY id DESC').all() : user.role === 'client' ? db.prepare('SELECT * FROM cases WHERE client_id=? ORDER BY id DESC').all(user.id) : db.prepare('SELECT DISTINCT c.* FROM cases c JOIN services s ON s.case_id=c.id WHERE s.partner_id=? ORDER BY c.id DESC').all(user.partner_id);
      return {cases:rows.map(row=>caseView(row,user))};
    }
    let match=path.match(/^\/api\/cases\/(\d+)$/);
    if (match && method === 'GET') return {case:caseView(getCase(Number(match[1]),user),user)};
    if (match && method === 'PATCH') {
      requireStaff(user); const row=getCase(Number(match[1]),user); mutable(row);
      const status=body.status === undefined ? row.status : choice(body.status,statuses,'Holat');
      const priority=body.priority === undefined ? row.priority : choice(body.priority,['normal','urgent'],'Muhimlik');
      const dueAt=body.dueAt === undefined ? row.due_at : date(body.dueAt,'Muddat');
      const coordinatorId=body.coordinatorId === undefined ? row.coordinator_id : body.coordinatorId;
      if (coordinatorId !== null) {
        integer(coordinatorId,'Koordinator',1);
        assert(db.prepare("SELECT id FROM users WHERE id=? AND role IN ('operator','director')").get(coordinatorId),'Koordinator topilmadi.');
      }
      const note=body.note === undefined ? '' : str(body.note,'Izoh',0,2000);
      if (status === 'cancelled') assert(note.length >= 5,'Bekor qilish sababini ichki izohda yozing.');
      if (status === 'completed') {
        const services=db.prepare("SELECT status FROM services WHERE case_id=? AND status!='cancelled'").all(row.id);
        assert(services.length>0 && services.every(s=>s.status==='completed'),'Avval barcha faol xizmatlarni yakunlang.',409);
      }
      transaction(db,()=>{
        db.prepare('UPDATE cases SET status=?,priority=?,due_at=?,coordinator_id=?,updated_at=? WHERE id=?').run(status,priority,dueAt,coordinatorId,now(),row.id);
        if (status!==row.status) {addHistory(db,row.id,'status',statusNames[statuses.indexOf(status)],user.name); enqueue(db,row.id,'case.status_changed');}
        if (coordinatorId!==row.coordinator_id) addHistory(db,row.id,'assignment','Mas’ul koordinator o‘zgartirildi.',user.name);
        if (priority!==row.priority || dueAt!==row.due_at) addHistory(db,row.id,'update','Muhimlik yoki nazorat muddati o‘zgartirildi.',user.name);
        if (note) addHistory(db,row.id,'note',note,user.name);
        if (status==='cancelled') db.prepare("UPDATE services SET status='cancelled' WHERE case_id=? AND status!='completed'").run(row.id);
      });
      return {case:caseView(getCase(row.id,user),user)};
    }
    match=path.match(/^\/api\/cases\/(\d+)\/services$/);
    if (match && method==='POST') {
      requireStaff(user); const row=getCase(Number(match[1]),user); mutable(row);
      const title=str(body.title,'Xizmat nomi',2,200), price=integer(body.price ?? 0,'Narx');
      const partnerId=body.partnerId ?? null;
      if(partnerId!==null) partnerExists(partnerId);
      transaction(db,()=>{
        db.prepare('INSERT INTO services(case_id,title,partner_id,price) VALUES (?,?,?,?)').run(row.id,title,partnerId,price);
        db.prepare('UPDATE cases SET updated_at=? WHERE id=?').run(now(),row.id);
        addHistory(db,row.id,'service',`Xizmat qo‘shildi: ${title}`,user.name);
        if (partnerId) enqueue(db,row.id,'service.assigned');
      });
      res.statusCode=201; return {case:caseView(getCase(row.id,user),user)};
    }
    match=path.match(/^\/api\/services\/(\d+)$/);
    if(match && method==='PATCH') {
      requireUser(user);
      const service=db.prepare('SELECT * FROM services WHERE id=?').get(Number(match[1]));
      assert(service && (staff(user) || (user.role==='partner' && user.partner_id===service.partner_id)), 'Xizmat topilmadi.',404);
      const row=getCase(service.case_id,user); mutable(row);
      const status=body.status===undefined ? service.status : choice(body.status,serviceStatuses,'Xizmat holati');
      const partnerId=body.partnerId===undefined ? service.partner_id : body.partnerId;
      if(body.partnerId!==undefined) { requireStaff(user); if(partnerId!==service.partner_id) { if(partnerId!==null) partnerExists(partnerId); assert(service.status==='pending','Boshlangan xizmat hamkorini almashtirib bo‘lmaydi.',409); } }
      if(user.role==='partner' && status!==service.status) assert(serviceStatuses.indexOf(status)===serviceStatuses.indexOf(service.status)+1 && status!=='cancelled','Xizmat holatini tartib bilan yangilang.',409);
      if(isTerminal(service.status)) assert(status===service.status && partnerId===service.partner_id,'Yakunlangan xizmatni o‘zgartirib bo‘lmaydi.',409);
      if(status!=='pending' && status!=='cancelled') assert(partnerId!==null,'Avval hamkorni biriktiring.',409);
      transaction(db,()=>{
        db.prepare('UPDATE services SET partner_id=?,status=? WHERE id=?').run(partnerId,status,service.id);
        db.prepare('UPDATE cases SET updated_at=? WHERE id=?').run(now(),row.id);
        if(status!==service.status || partnerId!==service.partner_id) addHistory(db,row.id,'service',`${service.title}: ${status}`,user.name);
        if(partnerId!==service.partner_id) enqueue(db,row.id,'service.assigned');
        if(status!==service.status) enqueue(db,row.id,'service.status_changed');
      });
      // A staff member may unassign a service; user access can change only for partners, who cannot reassign.
      return {case:caseView(getCase(row.id,user),user)};
    }
    match=path.match(/^\/api\/files\/(\d+)$/);
    if(match && method==='GET') {
      requireUser(user);
      const file=db.prepare('SELECT * FROM attachments WHERE id=?').get(Number(match[1]));
      assert(file,'Fayl topilmadi.',404); getCase(file.case_id,user);
      assert(user.role!=='partner','Bu fayl uchun ruxsat yo‘q.',403);
      res.setHeader('Content-Type',file.type);
      res.setHeader('Content-Disposition',`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      res.end(Buffer.from(file.data)); return;
    }
    if(path==='/api/partners' && method==='GET') {requireStaff(user); return {partners:db.prepare('SELECT * FROM partners ORDER BY id').all().map(partnerView)};}
    if(path==='/api/partners' && method==='POST') {
      requireStaff(user);
      const values=[str(body.name,'Hamkor nomi',2,150),phone(body.phone),str(body.address,'Manzil',3,300),choice(body.category,categories.map(c=>c.id),'Yo‘nalish'),str(body.hours,'Ish vaqti',3,100),choice(body.region,regions,'Hudud'),integer(body.price ?? 0,'Narx'),choice(body.contractStatus,['active','pending','expired'],'Shartnoma holati')];
      const result=db.prepare('INSERT INTO partners(name,phone,address,category,hours,region,price,contract_status) VALUES (?,?,?,?,?,?,?,?)').run(...values);
      res.statusCode=201; return {partner:partnerView(db.prepare('SELECT * FROM partners WHERE id=?').get(Number(result.lastInsertRowid)))};
    }
    if(path==='/api/team' && method==='GET') {requireStaff(user); return {users:db.prepare("SELECT id,name,role FROM users WHERE role IN ('operator','director')").all()};}
    if(path==='/api/clients' && method==='GET') {requireStaff(user); return {clients:db.prepare("SELECT id,name,phone FROM users WHERE role='client' ORDER BY id DESC").all()};}
    if(path==='/api/packages' && method==='GET') {
      requireUser(user); assert(user.role!=='partner','Bu bo‘lim uchun ruxsat yo‘q.',403);
      const rows=staff(user) ? db.prepare('SELECT * FROM packages ORDER BY id DESC').all() : db.prepare('SELECT * FROM packages WHERE client_id=?').all(user.id);
      return {packages:rows.map(packageView)};
    }
    if(path==='/api/packages' && method==='POST') {
      requireStaff(user);
      const clientId=integer(body.clientId,'Mijoz',1),tier=choice(body.tier,['Start','Komfort','Premium'],'Paket'),expiresAt=date(body.expiresAt,'Amal qilish muddati'),limit=integer(body.limit,'Limit',1,1000);
      assert(db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(clientId),'Mijoz topilmadi.');
      assert(expiresAt>now(),'Amal qilish muddati kelajakdagi sana bo‘lishi kerak.');
      assert(Array.isArray(body.members) && body.members.length<=20,'20 tagacha oila a’zosi kiritish mumkin.');
      const members=body.members.map(m=>str(m,'Oila a’zosi',2,100));
      const existing=db.prepare('SELECT * FROM packages WHERE client_id=?').get(clientId);
      if(existing) assert(limit>=packageView(existing).used,'Limit ishlatilgan xizmatlar sonidan kam bo‘la olmaydi.');
      db.prepare('INSERT INTO packages(client_id,tier,expires_at,service_limit,members) VALUES (?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET tier=excluded.tier,expires_at=excluded.expires_at,service_limit=excluded.service_limit,members=excluded.members').run(clientId,tier,expiresAt,limit,JSON.stringify(members));
      res.statusCode=existing ? 200 : 201;
      return {package:packageView(db.prepare('SELECT * FROM packages WHERE client_id=?').get(clientId))};
    }
    match=path.match(/^\/api\/packages\/(\d+)\/use$/);
    if(match && method==='POST') {
      requireStaff(user);
      const pack=db.prepare('SELECT * FROM packages WHERE id=?').get(Number(match[1])); assert(pack,'Paket topilmadi.',404);
      const row=getCase(integer(body.caseId,'Murojaat',1),user);
      assert(row.client_id===pack.client_id,'Murojaat shu mijozga tegishli emas.');
      assert(row.status==='completed','Faqat yakunlangan murojaat hisobga olinadi.',409);
      transaction(db,()=>{
        const previous=db.prepare('SELECT * FROM package_usage WHERE case_id=?').get(row.id);
        if(previous) {assert(previous.package_id===pack.id,'Murojaat boshqa paketda hisoblangan.',409);return;}
        assert(pack.expires_at>now(),'Paket muddati tugagan.',409);
        assert(packageView(pack).remaining>0,'Paket limiti tugagan.',409);
        db.prepare('INSERT INTO package_usage(package_id,case_id,created_at) VALUES (?,?,?)').run(pack.id,row.id,now());
        addHistory(db,row.id,'package','Oila paketi limiti: 1 ta foydalanish qayd etildi.',user.name);
      });
      return {package:packageView(pack)};
    }
    if(path==='/api/stats' && method==='GET') {
      requireStaff(user);
      const rows=db.prepare('SELECT * FROM cases ORDER BY id DESC').all();
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
      const packagesCount=db.prepare('SELECT count(*) AS n FROM packages').get().n;
      const activePackagesCount=db.prepare('SELECT count(*) AS n FROM packages WHERE expires_at > ?').get(now()).n;
      return { total:rows.length, today:rows.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date(r.created_at))===today).length, open:rows.filter(r=>!isTerminal(r.status)).length, completed:rows.filter(r=>r.status==='completed').length, overdue:rows.filter(r=>!isTerminal(r.status)&&r.due_at<now()).length, partners:db.prepare('SELECT count(*) AS n FROM partners').get().n, clients:db.prepare("SELECT count(*) AS n FROM users WHERE role='client'").get().n, packagesCount, activePackagesCount, averageRating:db.prepare('SELECT round(avg(rating),1) AS n FROM feedback').get().n, categories:categories.map(c=>({name:c.name,count:rows.filter(r=>r.category===c.id).length})),recent:rows.slice(0,5).map(r=>caseView(r,user)) };
    }
    if(path==='/api/notifications' && method==='GET') {
      requireStaff(user); return {notifications:db.prepare('SELECT n.id,c.number AS caseNumber,n.event,n.channel,n.status,n.created_at AS createdAt,n.recipient_phone AS recipientPhone,n.message FROM notifications n JOIN cases c ON c.id=n.case_id ORDER BY n.id DESC LIMIT 200').all()};
    }
    match=path.match(/^\/api\/notifications\/(\d+)\/send$/);
    if(match && method==='POST') {
      requireStaff(user);
      const notifId=Number(match[1]);
      const notif=db.prepare('SELECT * FROM notifications WHERE id=?').get(notifId);
      assert(notif,'Xabarnoma topilmadi.',404);
      throw new AppError(503, 'Telegram yuborish adapteri ulanmagan. Xabarnoma yuborilmadi.');
    }
    if(path==='/api/notifications/dispatch-all' && method==='POST') {
      requireStaff(user);
      throw new AppError(503, 'Telegram yuborish adapteri ulanmagan. Xabarnomalar yuborilmadi.');
    }
    if(path==='/api/users' && method==='GET') {
      requireStaff(user);
      assert(user.role==='director','Faqat direktor xodimlarni ko‘ra oladi.',403);
      return {users:db.prepare("SELECT id,login,name,phone,role,partner_id AS partnerId FROM users ORDER BY id").all()};
    }
    if(path==='/api/users' && method==='POST') {
      requireStaff(user);
      assert(user.role==='director','Faqat direktor yangi hisob ochishi mumkin.',403);
      const uName=str(body.name,'Ism',2,100), uPhone=phone(body.phone), uRole=choice(body.role,['operator','director','partner'],'Rol'), uLogin=str(body.login,'Login',2,50).toLowerCase(), uPwd=str(body.password,'Parol',10,128);
      const partnerId=uRole==='partner' ? integer(body.partnerId,'Hamkor ID',1) : null;
      if(partnerId) partnerExists(partnerId);
      assert(!db.prepare('SELECT id FROM users WHERE login=? OR phone=?').get(uLogin,uPhone),'Bu login yoki telefon mavjud.',409);
      const result=db.prepare('INSERT INTO users(login,name,phone,password_hash,role,partner_id) VALUES (?,?,?,?,?,?)').run(uLogin,uName,uPhone,passwordHash(uPwd),uRole,partnerId);
      res.statusCode=201;
      return {user:userView(db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid)))};
    }
  }

  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), geolocation=(), microphone=(self)');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      if(demo) {
        const hostname=new URL(`http://${req.headers.host || ''}`).hostname;
        assert(['localhost','127.0.0.1','[::1]'].includes(hostname),'Mahalliy demo faqat localhost orqali ochiladi.',403);
      }
      const path=new URL(req.url,'http://localhost').pathname;
      if(path.startsWith('/api/')) {
        res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json; charset=utf-8');
        let body={};
        if(!['GET','HEAD'].includes(req.method)) {
          const origin=req.headers.origin;
          assert(req.headers['sec-fetch-site']!=='cross-site','Tashqi saytdan so‘rovga ruxsat yo‘q.',403);
          if(origin) {
            const parsed=new URL(origin);
            const allowedOrigin = process.env.PUBLIC_ORIGIN;
            assert((parsed.host===req.headers.host || (allowedOrigin && parsed.origin===allowedOrigin)) && ['http:','https:'].includes(parsed.protocol),'So‘rov manbasi noto‘g‘ri.',403);
          }
          assert(req.headers['content-type']?.split(';')[0]==='application/json','JSON formatidagi so‘rov kerak.',415);
          let bytes=0;const chunks=[];
          for await (const chunk of req) {bytes+=chunk.length; assert(bytes<=22*1024*1024,'So‘rov hajmi juda katta.',413); chunks.push(chunk);}
          try {body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');} catch {throw new AppError(400,'So‘rov formati noto‘g‘ri.');}
          assert(body && typeof body==='object' && !Array.isArray(body),'So‘rov obyekti kerak.');
        }
        const result=await handleApi(req,res,path,getUser(req),body);
        if(!res.writableEnded) res.end(JSON.stringify(result));
        return;
      }
      assert(['GET','HEAD'].includes(req.method),'Usul qo‘llab-quvvatlanmaydi.',405);
      const file=resolve(PUBLIC,`.${decodeURIComponent(path==='/'?'/index.html':path)}`);
      assert(file.startsWith(PUBLIC+sep),'Sahifa topilmadi.',404);
      let content;try {assert(statSync(file).isFile(),'Sahifa topilmadi.',404);content=readFileSync(file);}catch{throw new AppError(404,'Sahifa topilmadi.');}
      const mime={
        '.html':'text/html; charset=utf-8',
        '.css':'text/css; charset=utf-8',
        '.js':'text/javascript; charset=utf-8',
        '.json':'application/json; charset=utf-8',
        '.svg':'image/svg+xml',
        '.png':'image/png',
        '.jpg':'image/jpeg',
        '.jpeg':'image/jpeg',
        '.webp':'image/webp',
        '.ico':'image/x-icon',
        '.pdf':'application/pdf',
        '.txt':'text/plain; charset=utf-8'
      };
      res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream'); res.setHeader('Cache-Control','no-cache');
      res.end(req.method==='HEAD'?undefined:content);
    } catch(error) {
      if(res.writableEnded) return;
      res.statusCode=error instanceof AppError ? error.status : 500;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      if(res.statusCode===500) console.error('Request failed:',error.message);
      res.end(JSON.stringify({error:res.statusCode===500?'Serverda xatolik yuz berdi. Qayta urinib ko‘ring.':error.message}));
    }
  });
  server.requestTimeout=30000; server.headersTimeout=15000;
  server.on('close',()=>db.close());
  return {server,db};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3000),host=process.env.HOST || '127.0.0.1';
  if(process.env.DEMO_MODE!=='false' && !['127.0.0.1','localhost','::1'].includes(host)) throw new Error('Demo mode must bind to loopback. Use DEMO_MODE=false and a fresh DATA_DIR for other hosts.');
  const {server}=createApp();
  server.listen(port,host,()=>console.log(`ZARURIYAT: http://${host}:${port} (${process.env.DEMO_MODE==='false'?'private installation':'local demo'})`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
}
