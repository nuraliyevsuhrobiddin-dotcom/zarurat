import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../lib/database.mjs';

test('production initialization is recoverable and cannot reopen as demo', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zaruriyat-production-'));
  const filename = join(directory, 'production.sqlite');
  const password = process.env.ADMIN_PASSWORD;
  const mobile = process.env.ADMIN_PHONE;
  try {
    process.env.ADMIN_PASSWORD = 'TemporaryTestPassword2026!';
    process.env.ADMIN_PHONE = 'invalid';
    assert.throws(() => openDatabase(filename, false));
    process.env.ADMIN_PHONE = '+998901234567';
    const db = openDatabase(filename, false);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM cases').get().n, 0);
    db.close();
    delete process.env.ADMIN_PASSWORD;
    const reopened = openDatabase(filename, false);
    assert.equal(reopened.prepare('SELECT role FROM users').get().role, 'director');
    reopened.close();
    assert.throws(() => openDatabase(filename, true), /DEMO_MODE=false/);
  } finally {
    if (password === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = password;
    if (mobile === undefined) delete process.env.ADMIN_PHONE; else process.env.ADMIN_PHONE = mobile;
    rmSync(directory, { recursive: true, force: true });
  }
});
