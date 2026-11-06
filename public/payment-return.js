export function returnedPayment(data, hash) {
  if (String(hash).split('?')[0] !== '#cabinet/packages') return null;
  const id = new URLSearchParams(String(hash).split('?').slice(1).join('?')).get('order');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id || '')) return null;
  return data?.payments?.find(order => order.id === id) || null;
}

export function paymentPending(order) {
  return !!order && ['pending', 'reserved'].includes(order.status) &&
    Date.parse(order.created_at) > Date.now() - 43200000;
}
