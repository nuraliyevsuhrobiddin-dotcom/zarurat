import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authDestination, checkoutReturn, checkoutAuthLink, requestReturn, requestAuthLink } from '../public/auth-navigation.js';

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

test('a guest who opens the request form registers first and then returns to the same form', () => {
  const link = requestAuthLink('register', 'request?category=legal&package=COMFORT&special=1');
  assert.ok(link.startsWith('#register?'));
  assert.equal(authDestination(link, 'client'), 'request?category=legal&package=COMFORT&special=1');
  const switched = `#login?${new URLSearchParams({ return: requestReturn(link) })}`;
  assert.equal(authDestination(switched, 'client'), 'request?category=legal&package=COMFORT&special=1');
  assert.equal(authDestination(requestAuthLink('login'), 'client'), 'request');
  assert.equal(authDestination(link, 'operator'), 'cabinet/overview');
  // Unknown parameters and foreign targets are dropped.
  assert.equal(requestReturn(`#register?${new URLSearchParams({ return: 'request?category=LEGAL&package=GOLD&next=//evil' })}`), 'request');
  assert.equal(requestReturn(`#register?${new URLSearchParams({ return: 'requests/../cabinet/team' })}`), '');
  assert.equal(requestAuthLink('register', 'https://evil.example'), '#register?return=request');
});
