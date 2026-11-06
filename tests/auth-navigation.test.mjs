import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authDestination, checkoutReturn, checkoutAuthLink } from '../public/auth-navigation.js';

test('login and registration resume the selected checkout, including after switching tabs', () => {
  for (const tier of ['STANDARD', 'COMFORT', 'PREMIUM']) {
    for (const mode of ['login', 'register']) {
      const link = checkoutAuthLink(mode, tier);
      assert.equal(authDestination(link, 'client'), `checkout?package=${tier}`);
      const switched = `#${mode === 'login' ? 'register' : 'login'}?${new URLSearchParams({ return: checkoutReturn(link) })}`;
      assert.equal(authDestination(switched, 'client'), `checkout?package=${tier}`);
      for (const role of ['director', 'operator', 'partner']) assert.equal(authDestination(link, role), 'cabinet/overview');
    }
  }
});

test('authentication never redirects to external URLs or arbitrary private routes', () => {
  for (const target of ['https://evil.example', '//evil.example', 'cabinet/team', 'checkout?package=INVALID', 'checkout?package=COMFORT&other=1']) {
    assert.equal(authDestination(`#login?${new URLSearchParams({ return: target })}`, 'client'), 'cabinet/overview');
  }
  assert.equal(authDestination('#register', 'client'), 'cabinet/overview');
});
