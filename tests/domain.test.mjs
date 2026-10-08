import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, verifyPassword } from '../lib/domain.mjs';

test('password verification rejects malformed and plaintext hashes without throwing', () => {
  const hash = passwordHash('LongPassword123!');
  assert.equal(verifyPassword('LongPassword123!', hash), true);
  assert.equal(verifyPassword('IncorrectPassword!', hash), false);
  for (const broken of [null, undefined, '', 'Zaruriyat2026!', 'salt:key', `${'a'.repeat(32)}:ff`]) {
    assert.equal(verifyPassword('LongPassword123!', broken), false);
  }
});
