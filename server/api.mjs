import { createDatabase, HttpError, query } from './db.mjs';
import { digest, sessionCookie, currentUser, createSession, hashPassword, requireRole, validateOrigin, rateLimit } from './security.mjs';
import { compare } from 'bcryptjs';
import { caseFilters } from './search.mjs';
import {runBackup} from './backup.mjs';
import {requireJob} from './jobs.mjs';
import {handleAccount} from './account.mjs';
import {stage2,smsReady,telegramReady} from './providers.mjs';
import {handleTelegramWebhook,drainNotifications} from './telegram.mjs';
import { text, phone, password as validatePassword, integer, choice, timestamp, requestInput, fail } from './validation.mjs';
import { publicConfig } from '../public/supabase-api.js';

const staff = ['director', 'operator'];
const terminal = status => ['completed', 'cancelled'].includes(status);
const profile = u => ({ id: u.id, name: u.name, phone: u.phone, login: u.login, role: u.role, partnerId: u.partner_id, blocked: Boolean(u.blocked_at), phoneVerified: Boolean(u.phone_verified_at), telegramConnected: Boolean(u.telegram_chat_id) });
const selectUsers = 'id,name,phone,login,role,partner_id';
const caseSelect = '*,coordinator:users!cases_coordinator_id_fkey(name),services(*,partners(name)),history(*),attachments(id,name,type,size),feedback(*)';

export function formatCase(c, user) {
  const isStaff = staff.includes(user?.role);
  const isPartner = user?.role === 'partner';
  return {
    id: c.id, number: c.number, name: c.name, phone: c.phone, region: c.region,
    category: c.category, description: c.description, preferredTime: c.preferred_time,
    status: c.status, priority: c.priority, coordinatorId: c.coordinator_id,
    coordinatorName: c.coordinator?.name || null, dueAt: c.due_at,
    createdAt: c.created_at, updatedAt: c.updated_at, clientId: c.client_id,
    ...(user?.role === 'client' && user.id === c.client_id ? { trackingToken: c.tracking_token } : {}),
    services: (c.services || []).filter(s => !isPartner || s.partner_id === user.partner_id).map(s => ({
      id: s.id, caseId: s.case_id, title: s.title, partnerId: s.partner_id,
      partnerName: s.partners?.name, status: s.status, price: s.price
    })),
    history: (c.history || []).filter(h => isStaff || (!isPartner && h.kind === 'status')).sort((a,b) => a.id-b.id).map(h => ({
      id: h.id, kind: h.kind, message: h.message, actorName: h.actor_name, createdAt: h.created_at
    })),
    attachments: isPartner ? [] : c.attachments || [],
    feedback: isPartner ? null : (Array.isArray(c.feedback) ? c.feedback[0] : c.feedback) || null
  };
}

async function getCase(db, id, user, tracking) {
  const filters = { select: caseSelect, id: `eq.${id}`, limit: 1 };
  if (!tracking && user?.role === 'client') filters.client_id = `eq.${user.id}`;
  const rows = await db('cases', { query: query(filters) });
  const c = rows?.[0];
  if (!c || (user?.role === 'partner' && !(c.services || []).some(s => s.partner_id === user.partner_id))) {
    throw new HttpError(404, 'Murojaat topilmadi.');
  }
  return c;
}

async function trackingCase(db, body) {
  const number = text(body.number, 'Murojaat raqami', 10, 30).toUpperCase();
  if (!/^ZAR-\d{6,}$/.test(number)) fail('Murojaat raqami noto‘g‘ri.');
  const trackingToken = text(body.token, 'Maxfiy kod', 8, 128);
  const rows = await db('cases', { query: query({ select: 'id', number: `eq.${number}`, tracking_token: `eq.${trackingToken}`, limit: 1 }) });
  if (!rows?.length) throw new HttpError(404, 'Murojaat raqami yoki maxfiy kod noto‘g‘ri.');
  return getCase(db, rows[0].id, null, true);
}

export function createHandler({ db = createDatabase(), env = process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(req.url, 'http://localhost');
      const rewritten = req.query?.route || url.searchParams.get('route');
      const path = rewritten ? '/' + (Array.isArray(rewritten) ? rewritten.join('/') : rewritten) : url.pathname.replace(/^\/api/, '');
      const method = req.method;
      if (!['GET','POST','PATCH','HEAD'].includes(method)||(method==='HEAD'&&path!=='/health')) throw new HttpError(405, 'Bu usul qo‘llab-quvvatlanmaydi.');
      if(path!=='/telegram/webhook')validateOrigin(req, env);
      const body = req.body || {};
      if (typeof body !== 'object' || Array.isArray(body)) fail('So‘rov noto‘g‘ri.');
      if (Buffer.byteLength(JSON.stringify(body)) > 4200000) throw new HttpError(413, 'So‘rov hajmi juda katta.');
      const user = await currentUser(req, db,env);
      const secure = Boolean(env.PUBLIC_ORIGIN?.startsWith('https://') || env.VERCEL_URL);
      const rpc = (name, args) => db(`rpc/${name}`, { method: 'POST', body: args });
      let result;
      const accountResult=await handleAccount({path,method,user,body,req,db,env});

      if(accountResult!==undefined)result=accountResult;
      else if(path==='/telegram/webhook'&&method==='POST')result=await handleTelegramWebhook(req,body,db,env);
      else if(path==='/jobs/notifications'&&method==='GET'){
        requireJob(req,env);result=await drainNotifications(db,env);
      } else if(path==='/jobs/backup'&&method==='GET'){
        requireJob(req,env);
        result=await runBackup(env);
      } else if(path==='/health'&&['GET','HEAD'].includes(method)){
        await rpc('zar_stats',{});
        res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=30');
        result={status:'ok',checkedAt:new Date().toISOString()};
      } else if (path === '/auth/me' && method === 'GET') result = { user: user ? profile(user) : null, configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) };
      else if (path === '/auth/login' && method === 'POST') {
        let login = text(body.login, 'Login', 3, 100).toLowerCase().replace(/[\s()-]/g, '');
        if (/^\d{9}$/.test(login)) login = '+998' + login;
        else if (/^998\d{9}$/.test(login)) login = '+' + login;
        const password = validatePassword(body.password,1);
        await rateLimit(req, db, 'login', login);
        const found = await rpc('zar_login', { p_login: login, p_password: password });
        if (!found) throw new HttpError(401, 'Login yoki parol noto‘g‘ri.');
        const value=await createSession(found,password,db,env);
        res.setHeader('Set-Cookie',sessionCookie(value,secure));
        result={user:profile(found)};
      } else if(path==='/auth/options'&&method==='GET') {
        result={stage2Enabled:stage2(env),smsEnabled:smsReady(env),telegramEnabled:telegramReady(env),paymentsEnabled:false};
      } else if(path==='/auth/password'&&method==='POST') {
        requireRole(user);
        await rateLimit(req,db,'password',String(user.id));
        const oldPassword=validatePassword(body.currentPassword,1);
        const newPassword=validatePassword(body.password);
        if(!await compare(oldPassword,user.passwordHash))throw new HttpError(401,'Joriy parol noto‘g‘ri.');
        if(await compare(newPassword,user.passwordHash))fail('Yangi parol joriy paroldan farqli bo‘lsin.');
        const updated=await db('users',{method:'PATCH',query:query({id:`eq.${user.id}`,password_hash:`eq.${user.passwordHash}`}),body:{password_hash:await hashPassword(newPassword)}});
        if(!updated.length)throw new HttpError(409,'Parol boshqa so‘rovda o‘zgardi. Qayta kiring.');
        // Signatures bound to the old hash are already invalid, even if cleanup fails.
        await db('sessions',{method:'DELETE',query:query({user_id:`eq.${user.id}`})});
        res.setHeader('Set-Cookie',sessionCookie('',secure,true));
        result={ok:true};
      } else if (path === '/auth/register' && method === 'POST') {
        if (body.consent !== true) fail('Ro‘yxatdan o‘tish uchun rozilik kerak.');
        const name = text(body.name, 'Ism', 2, 100), mobile = phone(body.phone);
        const password = validatePassword(body.password);
        await rateLimit(req, db, 'register', mobile);
        const created = await rpc('zar_create_user', { p_name: name, p_phone: mobile, p_login: mobile, p_password: password, p_role: 'client', p_partner_id: null });
        const value=await createSession(created,password,db,env);
        res.setHeader('Set-Cookie', sessionCookie(value, secure));
        result = { user: profile(created) };
      } else if (path === '/auth/logout' && method === 'POST') {
        const cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)zar_session=([a-f0-9]{64})(?:\.[a-f0-9]{64})?(?:;|$)/);
        if (cookie) await db('sessions', { method: 'DELETE', query: query({ token_hash: `eq.${digest(cookie[1])}` }) });
        res.setHeader('Set-Cookie', sessionCookie('', secure, true));
        result = { ok: true };
      } else if (path === '/requests' && method === 'POST') {
        await rateLimit(req, db, 'request');
        const input = requestInput(body);
        result = await rpc('zar_create_request', { p_input: input, p_user_id: user?.role === 'client' ? user.id : null });
      } else if (path === '/track' && method === 'POST') {
        await rateLimit(req, db, 'track');
        result = { case: formatCase(await trackingCase(db, body), null) };
      } else if (path === '/feedback' && method === 'POST') {
        await rateLimit(req, db, 'feedback');
        const c = user?.role === 'client' && !body.token
          ? (await db('cases', { query: query({ select: 'id,status', number: `eq.${text(body.number,'Raqam',10,30)}`, client_id: `eq.${user.id}`, limit: 1 }) }))?.[0]
          : await trackingCase(db, body);
        if (!c || c.status !== 'completed') fail('Faqat yakunlangan murojaatni baholash mumkin.');
        await db('feedback', { method: 'POST', body: { case_id: c.id, rating: integer(body.rating,'Baho',1,5), comment: body.comment ? text(body.comment,'Izoh',0,2000) : '' } });
        result = { ok: true };
      } else if (/^\/files\/\d+$/.test(path) && method === 'POST') {
        await rateLimit(req, db, 'track');
        const c = await trackingCase(db,body);
        const id = integer(path.split('/').pop(),'Fayl');
        if (!(c.attachments || []).some(f => f.id === id)) throw new HttpError(404,'Fayl topilmadi.');
        const files = await db('attachments',{query:query({select:'name,type,size,data',id:`eq.${id}`,case_id:`eq.${c.id}`,limit:1})});
        result = {file:files[0]};
      } else {
        requireRole(user);
        const caseMatch = path.match(/^\/cases\/(\d+)$/);
        const addService = path.match(/^\/cases\/(\d+)\/services$/);
        const serviceMatch = path.match(/^\/services\/(\d+)$/);
        const fileMatch = path.match(/^\/files\/(\d+)$/);
        const packageUse = path.match(/^\/packages\/(\d+)\/use$/);

        if (path === '/cases' && method === 'GET') {
          const filters=caseFilters(url,user);
          const rows = await db('cases', { query: query(filters) });
          result = { cases: rows.slice(0,50).map(c => formatCase(c,user)), pageSize: 50, hasMore: rows.length > 50 };
        } else if (caseMatch && method === 'GET') {
          result = { case: formatCase(await getCase(db,integer(caseMatch[1],'ID'),user),user) };
        } else if (caseMatch && method === 'PATCH') {
          requireRole(user,staff);
          const changes = {};
          if (body.status !== undefined) changes.status = choice(body.status,publicConfig.statuses,'Holat');
          if (body.priority !== undefined) changes.priority = choice(body.priority,['normal','urgent'],'Muhimlik');
          if (body.dueAt !== undefined) changes.due_at = timestamp(body.dueAt);
          if (body.coordinatorId !== undefined) changes.coordinator_id = body.coordinatorId === null ? null : integer(body.coordinatorId,'Koordinator');
          if (body.note) changes.note = text(body.note,'Izoh',1,2000);
          await rpc('zar_update_case', { p_id: integer(caseMatch[1],'ID'), p_changes: changes, p_actor_id: user.id });
          result = { case: formatCase(await getCase(db,Number(caseMatch[1]),user),user) };
        } else if (addService && method === 'POST') {
          requireRole(user,staff);
          await rpc('zar_add_service', { p_case_id: integer(addService[1],'ID'), p_title: text(body.title,'Xizmat',2,200), p_partner_id: body.partnerId ? integer(body.partnerId,'Hamkor') : null, p_price: integer(body.price || 0,'Narx',0,1000000000), p_actor_id: user.id });
          result = { case: formatCase(await getCase(db,Number(addService[1]),user),user) };
        } else if (serviceMatch && method === 'PATCH') {
          requireRole(user,[...staff,'partner']);
          const id = await rpc('zar_update_service', { p_id: integer(serviceMatch[1],'ID'), p_status: choice(body.status,['pending','accepted','contacted','delivered','completed','cancelled'],'Holat'), p_partner_id: body.partnerId == null ? null : integer(body.partnerId,'Hamkor'), p_change_partner: body.partnerId !== undefined, p_actor_id: user.id });
          result = { case: formatCase(await getCase(db,id,user),user) };
        } else if (path === '/partners') {
          requireRole(user,staff);
          if (method === 'GET') result = { partners: (await db('partners', { query: query({ order: 'id.desc' }) })).map(p => ({ ...p, contractStatus: p.contract_status })) };
          else if (method === 'POST') {
            const row = { name: text(body.name,'Nomi',2,150), phone: phone(body.phone), address: text(body.address,'Manzil',2,250), category: choice(body.category,publicConfig.categories.map(c=>c.id),'Yo‘nalish'), hours: text(body.hours,'Ish vaqti',2,100), region: choice(body.region,publicConfig.regions,'Hudud'), price: integer(body.price,'Narx',0,1000000000), contract_status: choice(body.contractStatus,['active','pending','expired'],'Shartnoma') };
            result = { partner: (await db('partners',{method:'POST',body:row}))[0] };
          }
        } else if (['/team','/clients','/users'].includes(path) && method === 'GET') {
          requireRole(user,path === '/users' ? ['director'] : staff);
          const role = path === '/team' ? 'in.(operator,director)' : path === '/clients' ? 'eq.client' : 'in.(operator,director,partner)';
          result = { [path === '/clients' ? 'clients' : 'users']: (await db('users',{query:query({select:selectUsers+(stage2(env)?',blocked_at,phone_verified_at,telegram_chat_id':''),role,order:'id.desc'})})).map(profile) };
        } else if (path === '/users' && method === 'POST') {
          requireRole(user,['director']);
          const password = validatePassword(body.password);
          const role = choice(body.role,['operator','partner'],'Rol');
          result = { user: profile(await rpc('zar_create_user',{p_name:text(body.name,'Ism',2,100),p_phone:phone(body.phone),p_login:text(body.login,'Login',3,100).toLowerCase(),p_password:password,p_role:role,p_partner_id:role==='partner'?integer(body.partnerId,'Hamkor'):null})) };
        } else if (/^\/users\/\d+\/password$/.test(path)&&method==='POST') {
          requireRole(user,['director']);
          await rateLimit(req,db,'admin-password',String(user.id));
          if(!await compare(validatePassword(body.currentPassword,1),user.passwordHash))throw new HttpError(401,'Joriy parol noto‘g‘ri.');
          const id=integer(path.split('/')[2],'Xodim');
          const targets=await db('users',{query:query({select:'id,role',id:`eq.${id}`,role:'in.(operator,partner)',limit:1})});
          if(!targets.length)throw new HttpError(404,'Xodim topilmadi.');
          await db('users',{method:'PATCH',query:query({id:`eq.${id}`,role:'in.(operator,partner)'}),body:{password_hash:await hashPassword(validatePassword(body.password))}});
          await db('sessions',{method:'DELETE',query:query({user_id:`eq.${id}`})});
          result={ok:true};
        } else if (path === '/packages' && method === 'GET') {
          requireRole(user,[...staff,'client']);
          const filters={select:'*,users(name),package_usage(id)'};
          if(user.role==='client')filters.client_id=`eq.${user.id}`;
          result={packages:(await db('packages',{query:query(filters)})).map(p=>({id:p.id,clientId:p.client_id,clientName:p.users?.name,tier:p.tier,expiresAt:p.expires_at,limit:p.service_limit,used:p.package_usage.length,remaining:Math.max(0,p.service_limit-p.package_usage.length),status:new Date(p.expires_at)<new Date()?'expired':p.package_usage.length>=p.service_limit?'exhausted':'active',members:p.members}))};
        } else if (path === '/packages' && method === 'POST') {
          requireRole(user,staff);
          if(!Array.isArray(body.members)||body.members.length>30)fail('Oila a’zolari ro‘yxati noto‘g‘ri.');
          result={package:await rpc('zar_save_package',{p_client_id:integer(body.clientId,'Mijoz'),p_tier:choice(body.tier,['Start','Komfort','Premium'],'Paket'),p_expires_at:timestamp(body.expiresAt),p_limit:integer(body.limit,'Limit',1,1000),p_members:body.members.map(m=>text(m,'A’zo',2,100))})};
        } else if (packageUse && method === 'POST') {
          requireRole(user,staff);
          await rpc('zar_use_package',{p_id:integer(packageUse[1],'Paket'),p_case_id:integer(body.caseId,'Murojaat'),p_actor_id:user.id});
          result={ok:true};
        } else if (path === '/notifications' && method === 'GET') {
          requireRole(user,staff);
          result={notifications:(await db('notifications',{query:query({select:'*,cases(number)',order:'id.desc',limit:100})})).map(n=>({...n,caseNumber:n.cases?.number,recipientPhone:n.recipient_phone,createdAt:n.created_at}))};
        } else if (path === '/stats' && method === 'GET') {
          requireRole(user,staff);
          result={stats:await rpc('zar_stats',{})};
        } else if (fileMatch && method === 'GET') {
          if(user.role==='partner')throw new HttpError(403,'Faylga ruxsat yo‘q.');
          const files=await db('attachments',{query:query({select:'*',id:`eq.${integer(fileMatch[1],'Fayl')}`,limit:1})});
          const file=files?.[0];
          if(!file)throw new HttpError(404,'Fayl topilmadi.');
          await getCase(db,file.case_id,user);
          result={file:{name:file.name,type:file.type,size:file.size,data:file.data}};
        }
      }
      if(result===undefined)throw new HttpError(404,'Bu bo‘lim topilmadi.');
      if(method!=='GET'&&telegramReady(env)&&(/^\/cases\//.test(path)||/^\/services\//.test(path)||path==='/requests')){
        await drainNotifications(db,env).catch(error=>console.error(JSON.stringify({event:'notification_queue_failure',category:error.name})));
      }
      res.statusCode=200;res.end(method==='HEAD'?'':JSON.stringify(result));
    } catch(error) {
      res.statusCode=error instanceof HttpError?error.status:500;
      if(res.statusCode>=500)console.error(JSON.stringify({event:'api_failure',status:res.statusCode,category:error.name||'Error'}));
      res.end(JSON.stringify({error:error instanceof HttpError?error.message:'Kutilmagan xatolik. Qayta urinib ko‘ring.'}));
    }
  };
}
