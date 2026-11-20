export function notificationChanges(rows, knownIds) {
  const firstRead = knownIds === null;
  const nextIds = new Set(knownIds || []);
  const incoming = [];
  for (const row of rows || []) {
    if (row?.id == null) continue;
    const id = String(row.id);
    if (!firstRead && !nextIds.has(id) && (row.source === 'incoming' || row.event === 'subscription.activated')) incoming.push(row);
    nextIds.add(id);
  }
  return { incoming, knownIds: nextIds };
}
