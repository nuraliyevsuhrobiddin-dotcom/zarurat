import { publicConfig } from './supabase-api.js';
let authContext=0;
export function resetApiContext(){authContext++;}
export async function api(path, body, method) {
  const context=authContext;
  const verb = method || (body === undefined ? 'GET' : 'POST');
  if (path === '/config') return publicConfig;
  let response;
  try { response = await fetch('/api' + path, {
    method: verb, credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
    headers: body == null ? {} : { 'Content-Type': 'application/json' },
    ...(body == null ? {} : { body: JSON.stringify(body) })
  }); } catch {
    throw new Error(navigator.onLine === false ? 'Internet aloqasini tekshiring. Ma’lumotlaringiz saqlanib turibdi, qayta yuborishingiz mumkin.' : 'Xizmatga ulanish cho‘zildi. Birozdan keyin qayta urinib ko‘ring.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Xizmatga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.'); }
  if(context!==authContext)throw new Error('Hisob o‘zgardi. Amalni joriy hisobda qayta bajaring.');
  if (!response.ok) {
    if(response.status===401&&verb==='GET'&&path!=='/auth/me'&&typeof window!=='undefined')window.dispatchEvent(new Event('zar-auth-expired'));
    const error=new Error(result.error || 'So‘rov bajarilmadi.');
    error.status=response.status;
    throw error;
  }
  return result;
}
