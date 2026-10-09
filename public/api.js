import { supabaseApi, isSupabaseConfigured } from './supabase-api.js';

export async function api(path, body, method) {
  if (isSupabaseConfigured()) {
    return await supabaseApi(path, body, method);
  }

  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    method: String(method || (body !== undefined ? 'POST' : 'GET')).toUpperCase(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  let result;
  try { result = await response.json(); }
  catch { throw new Error('Server javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.'); }
  if (!response.ok) throw new Error(result?.error || 'So‘rov bajarilmadi. Qayta urinib ko‘ring.');
  return result;
}
