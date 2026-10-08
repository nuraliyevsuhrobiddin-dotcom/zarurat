export default async function handler(req, res) {
  const origin = process.env.API_ORIGIN;
  if (!origin) return res.status(503).json({ error: 'API_ORIGIN sozlanmagan.' });
  let base;
  try {
    base = new URL(origin);
    if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Invalid origin');
  } catch {
    return res.status(503).json({ error: 'API_ORIGIN HTTPS server manzili bo‘lishi kerak.' });
  }
  const incoming = new URL(req.url, 'https://site.invalid');
  const path = req.query?.path;
  const route = (Array.isArray(path) ? path.join('/') : path) || incoming.searchParams.get('path');
  const pathname = route ? `/api/${route}` : incoming.pathname;
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/.test(pathname)) return res.status(404).end();
  if (!pathname.startsWith('/api/') || pathname === '/api/proxy') return res.status(404).end();
  const target = new URL(base);
  target.pathname = pathname;
  for (const [key, value] of incoming.searchParams) if (key !== 'path') target.searchParams.append(key, value);
  const headers = {};
  for (const name of ['content-type', 'cookie', 'origin', 'sec-fetch-site']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    const chunks = [];
    let length = 0;
    try {
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 4 * 1024 * 1024) return res.status(413).json({ error: 'So‘rov 4 MB dan oshmasligi kerak.' });
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
    } catch {
      return res.status(400).json({ error: 'So‘rovni o‘qib bo‘lmadi.' });
    }
  }
  try {
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(25000) });
    res.statusCode = upstream.status;
    for (const name of ['content-type', 'cache-control', 'content-disposition', 'x-content-type-options']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.setHeader('Cache-Control', 'no-store');
    const payload = Buffer.from(await upstream.arrayBuffer());
    if (payload.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'Fayl 4 MB dan katta. Kichikroq fayl kerak.' });
    res.end(payload);
  } catch {
    res.status(502).json({ error: 'API server bilan bog‘lanib bo‘lmadi.' });
  }
}

export const config = { api: { bodyParser: false } };
