import { publicConfig } from './supabase-api.js';
let authContext=0;
const pendingReads=new Set();
export function cancelApiReads(){
  for(const request of pendingReads){request.cancelled=true;request.controller.abort();}
  pendingReads.clear();
}
export function resetApiContext(){authContext++;}
export async function api(path, body, method) {
  const context=authContext;
  const verb = method || (body === undefined ? 'GET' : 'POST');
  if (path === '/config') return publicConfig;
  const controller = new AbortController();
  const request={controller,cancelled:false};
  if(verb==='GET')pendingReads.add(request);
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response, result;
  try { response = await fetch('/api' + path, {
    method: verb, credentials: 'same-origin',
    signal: controller.signal,
    headers: body == null ? {} : { 'Content-Type': 'application/json' },
    ...(body == null ? {} : { body: JSON.stringify(body) })
  });
    try { result = await response.json(); }
    catch { throw new Error('Xizmatga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.'); }
  } catch (error) {
    if(request.cancelled)throw Object.assign(new Error('Sahifa o‘zgardi.'),{name:'AbortError'});
    if (response && !controller.signal.aborted) throw error;
    throw new Error(globalThis.navigator?.onLine === false ? 'Internet aloqasini tekshiring. Ma’lumotlaringiz saqlanib turibdi, qayta yuborishingiz mumkin.' : 'Xizmatga ulanish cho‘zildi. Birozdan keyin qayta urinib ko‘ring.');
  } finally { clearTimeout(timeout); pendingReads.delete(request); }
  if(context!==authContext)throw new Error('Hisob o‘zgardi. Amalni joriy hisobda qayta bajaring.');
  if (!response.ok) {
    if(response.status===401&&verb==='GET'&&path!=='/auth/me'&&typeof window!=='undefined')window.dispatchEvent(new Event('zar-auth-expired'));
    const error=new Error(result.error || 'So‘rov bajarilmadi.');
    error.status=response.status;
    error.code=['subscription_required','account_changed'].includes(result.code)?result.code:undefined;
    throw error;
  }
  return result;
}
