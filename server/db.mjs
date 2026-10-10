export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createDatabase(env = process.env) {
  return async function database(resource, { method = 'GET', body, query = '', count = false } = {}) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new HttpError(503, 'Murojaat xizmati vaqtincha mavjud emas. Birozdan keyin qayta urinib ko‘ring.');
    }
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${resource}${query ? '?' + query : ''}`, {
      method, signal: AbortSignal.timeout(15000),
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: `return=representation${count ? ',count=exact' : ''}`
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (data?.code === '23505') throw new HttpError(409, 'Bu yozuv allaqachon mavjud.');
      if (data?.code === 'P0001') throw new HttpError(400, data.message);
      // Never disclose SQL, credentials, table structure or raw database errors to visitors.
      throw new HttpError(503, 'Ma’lumotni saqlash yoki olish imkoni bo‘lmadi. Qayta urinib ko‘ring.');
    }
    return data;
  };
}

export const query = values => new URLSearchParams(values).toString();
