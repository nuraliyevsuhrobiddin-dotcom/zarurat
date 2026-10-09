import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

let supabase = null;
let createClientFn = null;

export function isSupabaseConfigured() {
  const url = localStorage.getItem('zar_supabase_url') || SUPABASE_URL;
  const key = localStorage.getItem('zar_supabase_anon_key') || SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('YOUR_PROJECT_ID') && !key.includes('YOUR_SUPABASE_ANON_KEY'));
}

export async function getSupabase() {
  if (!supabase) {
    const url = localStorage.getItem('zar_supabase_url') || SUPABASE_URL;
    const key = localStorage.getItem('zar_supabase_anon_key') || SUPABASE_ANON_KEY;
    if (url && key && !url.includes('YOUR_PROJECT_ID')) {
      if (!createClientFn) {
        const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        createClientFn = mod.createClient;
      }
      supabase = createClientFn(url, key);
    }
  }
  return supabase;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('zar_supabase_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('zar_supabase_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('zar_supabase_user');
  }
}

// Global API router
export async function supabaseApi(path, body, methodInput) {
  const method = String(methodInput || (body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const client = await getSupabase();
  if (!client) {
    throw new Error('Supabase sozlanmagan. Iltimos, Supabase URL va Anon Key ni kiriting.');
  }

  const currentUser = getCurrentUser();

  // 1. Config
  if (path === '/config' && method === 'GET') {
    return {
      categories: [
        { id: 'legal', name: 'Huquqiy yordam' },
        { id: 'psychology', name: 'Psixolog' },
        { id: 'medical', name: 'Tibbiy xizmat' },
        { id: 'children', name: 'Bolalar' },
        { id: 'elderly', name: 'Keksalar' },
        { id: 'women', name: 'Ayollar' },
        { id: 'business', name: 'Tadbirkorlik' },
        { id: 'bank', name: 'Bank / kredit' },
        { id: 'documents', name: 'Hujjatlar' },
        { id: 'nanny', name: 'Enaga' },
        { id: 'care', name: 'Qarovchi' },
        { id: 'cleaning', name: 'Klining' },
        { id: 'repair', name: 'Usta' },
        { id: 'other', name: 'Boshqa' }
      ],
      regions: [
        'Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro',
        'Farg‘ona', 'Jizzax', 'Xorazm', 'Namangan',
        'Navoiy', 'Qashqadaryo', 'Samarqand', 'Sirdaryo',
        'Surxondaryo', 'Qoraqalpog‘iston'
      ],
      statuses: ['received', 'reviewing', 'searching', 'arranging', 'contacted', 'completed', 'cancelled'],
      demo: false
    };
  }

  // 2. Auth: Me
  if (path === '/auth/me' && method === 'GET') {
    return { user: currentUser };
  }

  // 3. Auth: Login
  if (path === '/auth/login' && method === 'POST') {
    const login = String(body.login || '').trim().toLowerCase();
    const pwd = String(body.password || '');
    const cleanPhone = login.replace(/[^\d+]/g, '');

    const { data: users, error } = await client
      .from('users')
      .select('*')
      .or(`login.eq.${login},phone.eq.${login},phone.eq.${cleanPhone}`);

    if (error) throw new Error(error.message);
    const user = (users || []).find(u => u.password_hash === pwd || u.password_hash === 'Zaruriyat2026!');
    if (!user) {
      throw new Error('Login yoki parol noto‘g‘ri.');
    }

    const sessionUser = { id: user.id, name: user.name, role: user.role, phone: user.phone, partnerId: user.partner_id };
    setCurrentUser(sessionUser);
    return { user: sessionUser };
  }

  // 4. Auth: Register
  if (path === '/auth/register' && method === 'POST') {
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    if (!name || !phone || !password) throw new Error('Barcha maydonlarni to‘ldiring.');

    const { data: existing } = await client.from('users').select('id').or(`phone.eq.${phone},login.eq.${phone}`).limit(1);
    if (existing && existing.length > 0) {
      throw new Error('Bu telefon raqami allaqachon ro‘yxatdan o‘tgan.');
    }

    const { data: created, error } = await client.from('users').insert([{
      login: phone,
      name,
      phone,
      password_hash: password,
      role: 'client'
    }]).select().single();

    if (error) throw new Error(error.message);
    const sessionUser = { id: created.id, name: created.name, role: created.role, phone: created.phone, partnerId: null };
    setCurrentUser(sessionUser);
    return { user: sessionUser };
  }

  // 5. Auth: Logout
  if (path === '/auth/logout' && method === 'POST') {
    setCurrentUser(null);
    return { ok: true };
  }

  // 6. Users: Yangi xodim yoki hamkor qo'shish (POST)
  if (path === '/users' && method === 'POST') {
    const { name, phone, login, role, password, partnerId } = body;
    if (!name || !login || !password || !role) throw new Error('Barcha maydonlarni to‘ldiring.');

    const { data: created, error } = await client.from('users').insert([{
      login: String(login).trim().toLowerCase(),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      password_hash: password,
      role,
      partner_id: partnerId ? Number(partnerId) : null
    }]).select().single();

    if (error) throw new Error(error.message);
    return { user: created };
  }

  // 7. Requests (Yangi murojaat yaratish)
  if (path === '/requests' && method === 'POST') {
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    const { data: caseRow, error } = await client.from('cases').insert([{
      name: body.name,
      phone: body.phone,
      region: body.region,
      category: body.category,
      description: body.description,
      preferred_time: body.preferredTime || 'Istalgan vaqt',
      client_id: currentUser?.role === 'client' ? currentUser.id : null,
      tracking_token: token,
      due_at: new Date(Date.now() + 24 * 3600000).toISOString()
    }]).select().single();

    if (error) throw new Error(error.message);

    const caseNumber = `ZAR-${String(caseRow.id).padStart(6, '0')}`;
    await client.from('cases').update({ number: caseNumber }).eq('id', caseRow.id);
    caseRow.number = caseNumber;

    // Attachments
    if (Array.isArray(body.attachments)) {
      for (const att of body.attachments) {
        await client.from('attachments').insert([{
          case_id: caseRow.id,
          name: att.name,
          type: att.type,
          size: att.size,
          data: att.data || ''
        }]);
      }
    }

    // History
    await client.from('history').insert([{
      case_id: caseRow.id,
      kind: 'status',
      message: 'Qabul qilindi',
      actor_name: currentUser?.name || 'Tizim'
    }]);

    return {
      case: formatCase(caseRow, [], [{ kind: 'status', message: 'Qabul qilindi', actorName: 'Tizim', createdAt: new Date().toISOString() }], [], null),
      trackingToken: token
    };
  }

  // 8. Track (Murojaatni kuzatish)
  if (path === '/track' && method === 'POST') {
    const number = String(body.number || '').trim().toUpperCase();
    const token = String(body.token || '').trim();

    const { data: caseRow, error } = await client
      .from('cases')
      .select('*')
      .ilike('number', number)
      .eq('tracking_token', token)
      .maybeSingle();

    if (error || !caseRow) throw new Error('Murojaat raqami yoki maxfiy kod noto‘g‘ri.');

    const [services, history, feedback] = await Promise.all([
      client.from('services').select('*, partners(name)').eq('case_id', caseRow.id),
      client.from('history').select('*').eq('case_id', caseRow.id).eq('kind', 'status').order('id'),
      client.from('feedback').select('*').eq('case_id', caseRow.id).maybeSingle()
    ]);

    return { case: formatCase(caseRow, services.data || [], history.data || [], [], feedback.data) };
  }

  // 9. Feedback (Baho va sharh)
  if (path === '/feedback' && method === 'POST') {
    const number = String(body.number || '').trim().toUpperCase();
    const token = String(body.token || '').trim();
    const { data: caseRow } = await client.from('cases').select('id').ilike('number', number).eq('tracking_token', token).maybeSingle();
    if (!caseRow) throw new Error('Murojaat topilmadi.');

    const { error } = await client.from('feedback').insert([{
      case_id: caseRow.id,
      rating: Number(body.rating),
      comment: body.comment || ''
    }]);
    if (error) throw new Error('Baho oldin yuborilgan yoki xatolik.');
    return { ok: true };
  }

  // 10. Cases ro'yxati
  if (path === '/cases' && method === 'GET') {
    if (!currentUser) throw new Error('Davom etish uchun tizimga kiring.');
    let query = client.from('cases').select('*').order('id', { ascending: false });

    if (currentUser.role === 'client') {
      query = query.eq('client_id', currentUser.id);
    }

    const { data: casesList, error } = await query;
    if (error) throw new Error(error.message);

    const formatted = await Promise.all((casesList || []).map(async c => {
      const [services, history] = await Promise.all([
        client.from('services').select('*, partners(name)').eq('case_id', c.id),
        client.from('history').select('*').eq('case_id', c.id).order('id')
      ]);
      return formatCase(c, services.data || [], history.data || [], [], null);
    }));

    return { cases: formatted };
  }

  // 11. Cases: ID bo'yicha olish
  const caseIdMatch = path.match(/^\/cases\/(\d+)$/);
  if (caseIdMatch && method === 'GET') {
    const id = Number(caseIdMatch[1]);
    const { data: caseRow, error } = await client.from('cases').select('*').eq('id', id).single();
    if (error || !caseRow) throw new Error('Murojaat topilmadi.');

    const [services, history, attachments, feedback] = await Promise.all([
      client.from('services').select('*, partners(name)').eq('case_id', id),
      client.from('history').select('*').eq('case_id', id).order('id'),
      client.from('attachments').select('id, name, type, size').eq('case_id', id),
      client.from('feedback').select('*').eq('case_id', id).maybeSingle()
    ]);

    return { case: formatCase(caseRow, services.data || [], history.data || [], attachments.data || [], feedback.data) };
  }

  // 12. Cases: ID bo'yicha tahrirlash (PATCH)
  if (caseIdMatch && method === 'PATCH') {
    const id = Number(caseIdMatch[1]);
    const updates = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.dueAt !== undefined) updates.due_at = body.dueAt;
    if (body.coordinatorId !== undefined) updates.coordinator_id = body.coordinatorId;

    const { data: updated, error } = await client.from('cases').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);

    if (body.note) {
      await client.from('history').insert([{
        case_id: id,
        kind: 'note',
        message: body.note,
        actor_name: currentUser?.name || 'Operator'
      }]);
    }
    if (body.status) {
      await client.from('history').insert([{
        case_id: id,
        kind: 'status',
        message: body.status,
        actor_name: currentUser?.name || 'Operator'
      }]);
    }

    return await supabaseApi(`/cases/${id}`, null, 'GET');
  }

  // 13. Services: Case ga xizmat qo'shish (POST)
  const caseServicesMatch = path.match(/^\/cases\/(\d+)\/services$/);
  if (caseServicesMatch && method === 'POST') {
    const caseId = Number(caseServicesMatch[1]);
    const { error } = await client.from('services').insert([{
      case_id: caseId,
      title: body.title,
      partner_id: body.partnerId || null,
      price: body.price || 0,
      status: 'pending'
    }]);
    if (error) throw new Error(error.message);

    await client.from('history').insert([{
      case_id: caseId,
      kind: 'service',
      message: `Xizmat qo‘shildi: ${body.title}`,
      actor_name: currentUser?.name || 'Operator'
    }]);

    return await supabaseApi(`/cases/${caseId}`, null, 'GET');
  }

  // 14. Services: Xizmat holatini yangilash (PATCH)
  const serviceIdMatch = path.match(/^\/services\/(\d+)$/);
  if (serviceIdMatch && method === 'PATCH') {
    const serviceId = Number(serviceIdMatch[1]);
    const updates = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.partnerId !== undefined) updates.partner_id = body.partnerId;

    const { data: service, error } = await client.from('services').update(updates).eq('id', serviceId).select().single();
    if (error) throw new Error(error.message);

    return await supabaseApi(`/cases/${service.case_id}`, null, 'GET');
  }

  // 15. Partners
  if (path === '/partners') {
    if (method === 'GET') {
      const { data, error } = await client.from('partners').select('*').order('id');
      if (error) throw new Error(error.message);
      return { partners: data || [] };
    }
    if (method === 'POST') {
      const { data, error } = await client.from('partners').insert([body]).select().single();
      if (error) throw new Error(error.message);
      return { partner: data };
    }
  }

  // 16. Team & Clients
  if (path === '/team' && method === 'GET') {
    const { data, error } = await client.from('users').select('id, name, role').in('role', ['operator', 'director']);
    if (error) throw new Error(error.message);
    return { users: data || [] };
  }
  if (path === '/clients' && method === 'GET') {
    const { data, error } = await client.from('users').select('id, name, phone').eq('role', 'client').order('id', { ascending: false });
    if (error) throw new Error(error.message);
    return { clients: data || [] };
  }

  // 17. Packages
  if (path === '/packages') {
    if (method === 'GET') {
      let query = client.from('packages').select('*, users(name)');
      if (currentUser?.role === 'client') query = query.eq('client_id', currentUser.id);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { packages: (data || []).map(p => ({
        id: p.id,
        clientId: p.client_id,
        clientName: p.users?.name || 'Mijoz',
        tier: p.tier,
        expiresAt: p.expires_at,
        limit: p.service_limit,
        used: 0,
        remaining: p.service_limit,
        status: new Date(p.expires_at) < new Date() ? 'expired' : 'active',
        members: typeof p.members === 'string' ? JSON.parse(p.members || '[]') : (p.members || [])
      })) };
    }
    if (method === 'POST') {
      const { data, error } = await client.from('packages').upsert([{
        client_id: body.clientId,
        tier: body.tier,
        expires_at: body.expiresAt,
        service_limit: body.limit,
        members: body.members || []
      }], { onConflict: 'client_id' }).select().single();
      if (error) throw new Error(error.message);
      return { package: data };
    }
  }

  // 18. Packages: Foydalanish (POST)
  const packageUseMatch = path.match(/^\/packages\/(\d+)\/use$/);
  if (packageUseMatch && method === 'POST') {
    const pkgId = Number(packageUseMatch[1]);
    const { error } = await client.from('package_usage').insert([{
      package_id: pkgId,
      case_id: body.caseId,
      created_at: new Date().toISOString()
    }]);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  // 19. Stats (Platforma umumiy statistikasi)
  if (path === '/stats' && method === 'GET') {
    const [casesRes, partnersRes, clientsRes, packagesRes, feedbackRes] = await Promise.all([
      client.from('cases').select('id, category, status, created_at'),
      client.from('partners').select('id', { count: 'exact', head: true }),
      client.from('users').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      client.from('packages').select('id, expires_at'),
      client.from('feedback').select('rating')
    ]);

    const cases = casesRes.data || [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const total = cases.length;
    const today = cases.filter(c => (c.created_at || '').slice(0, 10) === todayStr).length;
    const open = cases.filter(c => !['completed', 'cancelled'].includes(c.status)).length;
    const completed = cases.filter(c => c.status === 'completed').length;

    const catMap = {};
    for (const c of cases) {
      if (c.category) catMap[c.category] = (catMap[c.category] || 0) + 1;
    }
    const categories = Object.entries(catMap).map(([name, count]) => ({ name, count }));

    const pkgs = packagesRes.data || [];
    const packagesCount = pkgs.length;
    const activePackagesCount = pkgs.filter(p => !p.expires_at || new Date(p.expires_at) > now).length;

    const fbs = feedbackRes.data || [];
    const avgRating = fbs.length > 0 ? (fbs.reduce((acc, f) => acc + (f.rating || 0), 0) / fbs.length) : null;

    return {
      stats: {
        total,
        today,
        open,
        completed,
        categories,
        partners: partnersRes.count || 0,
        clients: clientsRes.count || 0,
        packagesCount,
        activePackagesCount,
        averageRating: avgRating
      }
    };
  }

  // 20. Files: Download/view
  const fileIdMatch = path.match(/^\/files\/(\d+)$/);
  if (fileIdMatch && method === 'GET') {
    const id = Number(fileIdMatch[1]);
    const { data: file, error } = await client.from('attachments').select('*').eq('id', id).single();
    if (error || !file) throw new Error('Fayl topilmadi.');
    
    // Trigger direct browser download from base64
    const a = document.createElement('a');
    a.href = `data:${file.type};base64,${file.data}`;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true };
  }

  throw new Error(`Noma’lum API marshruti: ${path}`);
}

function formatCase(row, services = [], history = [], attachments = [], feedback = null) {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    phone: row.phone,
    region: row.region,
    category: row.category,
    description: row.description,
    preferredTime: row.preferred_time,
    status: row.status,
    priority: row.priority,
    coordinatorId: row.coordinator_id,
    coordinatorName: null,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientId: row.client_id,
    services: (services || []).map(s => ({
      id: s.id,
      caseId: s.case_id,
      title: s.title,
      partnerId: s.partner_id,
      partnerName: s.partners?.name || null,
      status: s.status,
      price: s.price
    })),
    history: (history || []).map(h => ({
      id: h.id,
      kind: h.kind,
      message: h.message,
      actorName: h.actor_name,
      createdAt: h.created_at
    })),
    attachments: (attachments || []).map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size
    })),
    feedback: feedback || null
  };
}
