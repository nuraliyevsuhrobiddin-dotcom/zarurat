// Compatibility for cached clients: all operations use the server session.
export { api as supabaseApi } from './api.js';
export function isSupabaseConfigured() { return false; }
