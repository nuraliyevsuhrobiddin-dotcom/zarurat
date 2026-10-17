export function normalizePhone(value) {
  const compact=String(value||'').trim().replace(/[\s()-]/g,'');
  if (/^\d{9}$/.test(compact)) return '+998'+compact;
  if (/^998\d{9}$/.test(compact)) return '+'+compact;
  return compact;
}
export function normalizeLogin(value) {
  const login=String(value||'').trim().toLowerCase();
  // Formatting characters are meaningful in staff usernames, only strip them from phones.
  return /^[+\d\s()-]+$/.test(login) ? normalizePhone(login) : login;
}
