import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../public/api.js';
import { supabaseApi, isSupabaseConfigured } from '../public/supabase-api.js';

test('browser API uses the server session and never retries failed mutations', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return Response.json({ error: 'Ruxsat yo‘q.' }, { status: 403 });
    };
    await assert.rejects(api('/cases/12', { status: 'completed' }, 'PATCH'), /Ruxsat/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/cases/12');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.equal(calls[0].options.method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[0].options.body), { status: 'completed' });
    assert.equal(isSupabaseConfigured(), false);
    assert.equal(supabaseApi, api);
  } finally { globalThis.fetch = originalFetch; }
});

test('browser API reports HTML routing errors instead of accepting a false success', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<!doctype html><html></html>');
    await assert.rejects(api('/auth/me'), /Server javobini/);
    globalThis.fetch = async () => Response.json({ user: { role: 'client' } });
    assert.deepEqual(await api('/auth/me'), { user: { role: 'client' } });
  } finally { globalThis.fetch = originalFetch; }
});
