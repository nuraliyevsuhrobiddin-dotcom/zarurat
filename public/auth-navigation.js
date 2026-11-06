import { packageTiers } from './package-tiers.js';

// Only a known checkout route may be resumed after authentication.
export function checkoutReturn(hash) {
  const target = new URLSearchParams(String(hash).split('?').slice(1).join('?')).get('return');
  const match = /^checkout\?package=(STANDARD|COMFORT|PREMIUM)$/.exec(target || '');
  return match && packageTiers.some(tier => tier.name === match[1]) ? target : '';
}

export function authDestination(hash, role) {
  return role === 'client' && checkoutReturn(hash) || 'cabinet/overview';
}

export function checkoutAuthLink(mode, tier) {
  if (!['login', 'register'].includes(mode) || !packageTiers.some(item => item.name === tier)) return '#login';
  return `#${mode}?${new URLSearchParams({ return: `checkout?package=${tier}` })}`;
}
