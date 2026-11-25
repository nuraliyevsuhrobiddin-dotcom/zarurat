import { packageTiers } from './package-tiers.js';

const returnTarget = hash => new URLSearchParams(String(hash).split('?').slice(1).join('?')).get('return') || '';

// Only a known checkout route may be resumed after authentication.
export function checkoutReturn(hash) {
  const target = returnTarget(hash);
  const match = /^checkout\?package=(STANDARD|COMFORT|PREMIUM)$/.exec(target);
  return match && packageTiers.some(tier => tier.name === match[1]) ? target : '';
}

// A request needs an account: after sign-up the same request form opens again.
// Only the known form parameters are carried over.
export function requestReturn(hash) {
  const target = returnTarget(hash);
  if (!/^request(\?|$)/.test(target)) return '';
  const source = new URLSearchParams(target.split('?').slice(1).join('?')), safe = new URLSearchParams();
  const category = source.get('category');
  if (/^[a-z]{2,20}$/.test(category || '')) safe.set('category', category);
  const tier = source.get('package');
  if (packageTiers.some(item => item.name === tier)) safe.set('package', tier);
  if (source.get('special') === '1') safe.set('special', '1');
  return 'request' + (safe.size ? '?' + safe : '');
}

export function authDestination(hash, role) {
  return role === 'client' && (checkoutReturn(hash) || requestReturn(hash)) || 'cabinet/overview';
}

export function checkoutAuthLink(mode, tier) {
  if (!['login', 'register'].includes(mode) || !packageTiers.some(item => item.name === tier)) return '#login';
  return `#${mode}?${new URLSearchParams({ return: `checkout?package=${tier}` })}`;
}

export function requestAuthLink(mode, target = 'request') {
  const back = requestReturn(`#x?${new URLSearchParams({ return: target })}`) || 'request';
  return `#${mode === 'login' ? 'login' : 'register'}?${new URLSearchParams({ return: back })}`;
}
