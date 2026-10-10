import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { compare,hash } from 'bcryptjs';
import { HttpError, query } from './db.mjs';
import {stage2} from './providers.mjs';
export const token = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
// pgcrypto uses the interoperable $2a$ bcrypt prefix.
export const hashPassword=async value=>(await hash(value,12)).replace(/^\$2b\$/,'$2a$');
export function sessionCookie(value, secure = true, clear = false) {
  return `zar_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 43200}${secure ? '; Secure' : ''}`;
}
export function sessionSignature(value, userId, passwordHash, env=process.env) {
  const secret=env.SESSION_SECRET||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)throw new HttpError(503,'Kirish xizmati vaqtincha mavjud emas.');
  return createHmac('sha256',secret).update(`${value}:${userId}:${passwordHash}`).digest('hex');
}
export async function createSession(user, password, db, env) {
  // Verify against a fresh hash and bind the session to this exact revision.
  // A concurrent password change invalidates the signature automatically.
  const rows=await db('users',{query:query({select:'id,password_hash',id:`eq.${user.id}`,limit:1})});
  const hash=rows?.[0]?.password_hash;
  if(!hash||!await compare(password,hash))throw new HttpError(401,'Login yoki parol noto‘g‘ri.');
  const value=token();
  const signature=sessionSignature(value,user.id,hash,env);
  await db('sessions',{method:'POST',body:{token_hash:digest(value),user_id:user.id,expires_at:new Date(Date.now()+43200000).toISOString()}});
  return `${value}.${signature}`;
}
export async function currentUser(req, db, env=process.env) {
  const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('zar_session='));
  const supplied = cookie?.slice('zar_session='.length);
  if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(supplied || '')) return null;
  const [value,signature]=supplied.split('.');
  const sessions = await db('sessions', { query: query({ select: 'user_id', token_hash: `eq.${digest(value)}`, expires_at: `gt.${new Date().toISOString()}`, limit: 1 }) });
  if (!sessions?.length) return null;
  const fields='id,name,phone,login,role,partner_id,password_hash'+(stage2(env)?',blocked_at,phone_verified_at,telegram_chat_id':'');
  const users = await db('users', { query: query({ select: fields, id: `eq.${sessions[0].user_id}`, limit: 1 }) });
  const user=users?.[0];
  if(!user||user.blocked_at)return null;
  const expected=sessionSignature(value,user.id,user.password_hash,env);
  if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))return null;
  const {password_hash,...safeUser}=user;
  return {...safeUser,passwordHash:password_hash};
}
export function requireRole(user, roles) {
  if (!user) throw new HttpError(401, 'Davom etish uchun tizimga kiring.');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'Bu amal uchun ruxsat yo‘q.');
}
export function validateOrigin(req, env) {
  if (['GET', 'HEAD'].includes(req.method)) return;
  const expected = env.PUBLIC_ORIGIN || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null);
  if (!expected) throw new HttpError(503, 'Serverning sayt manzili sozlanmagan.');
  const origin = req.headers.origin;
  if (!origin || origin !== new URL(expected).origin) throw new HttpError(403, 'So‘rov manbasi tasdiqlanmadi.');
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'JSON shaklida so‘rov yuboring.');
}
export async function rateLimit(req, db, kind, identifier = '',limits={}) {
  // The database counter survives cold starts and is atomic across instances.
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const keys = [digest(`${kind}:ip:${ip}`)];
  if (identifier) keys.push(digest(`${kind}:account:${identifier}`));
  for (let i=0;i<keys.length;i++) {
    const key=keys[i],limit=(i===0?limits.ip:limits.account)||(kind==='request'?10:20);
    const allowed = await db('rpc/zar_rate_limit', { method: 'POST', body: { p_key: key, p_limit: limit, p_seconds: 900 } });
    if (!allowed) throw new HttpError(429, 'Urinishlar ko‘paydi. 15 daqiqadan keyin qayta urinib ko‘ring.');
  }
}
