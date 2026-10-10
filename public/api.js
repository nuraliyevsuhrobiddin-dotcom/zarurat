import { publicConfig } from './supabase-api.js';
export async function api(path, body, method) {
  const verb = method || (body === undefined ? 'GET' : 'POST');
  if (path === '/config') return publicConfig;
  const response = await fetch('/api' + path, {
    method: verb, credentials: 'same-origin',
    headers: body == null ? {} : { 'Content-Type': 'application/json' },
    ...(body == null ? {} : { body: JSON.stringify(body) })
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Xizmatga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.'); }
  if (!response.ok) throw new Error(result.error || 'So‘rov bajarilmadi.');
  return result;
}
