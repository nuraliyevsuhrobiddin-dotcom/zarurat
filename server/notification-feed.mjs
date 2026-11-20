const events={assignment:'case.assignment_changed',deadline:'case.deadline_changed',clarification:'case.clarified',package:'package.used'};

// These staff activity records never enter the SMS/Telegram delivery queue.
export function notificationFeed(deliveries,history,subscriptions=[],requests=[]) {
 const incoming=requests.slice(0,100).map(c=>({
  id:`request-${c.id}`,case_id:c.id,event:'request.created',source:'incoming',
  caseNumber:c.number,clientName:c.name,recipientPhone:c.phone,
  createdAt:c.created_at,status:c.status,message:''
 }));
 const activated=subscriptions.map(s=>({id:`subscription-${s.id}`,event:'subscription.activated',clientId:s.client_id,clientName:s.users?.name,tier:s.tier,expiresAt:s.expires_at,recipientPhone:s.users?.phone,createdAt:s.starts_at,status:'recorded',source:'internal',message:''}));
 const internal=history.filter(h=>events[h.kind]).map(h=>({
  id:`history-${h.id}`,case_id:h.case_id,event:events[h.kind],
  caseNumber:h.cases?.number,recipientPhone:h.cases?.phone,
  createdAt:h.created_at,status:'recorded',source:'internal',message:''
 }));
 const outgoing=deliveries.map(n=>({...n,caseNumber:n.cases?.number,recipientPhone:n.recipient_phone,createdAt:n.created_at,source:'delivery'}));
 // Each category retains its own recent records. A busy delivery queue must not
 // push received requests or paid subscriptions out of the coordinator inbox.
 return [...incoming,...outgoing.slice(0,100),...internal.slice(0,100),...activated.slice(0,100)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)||String(b.id).localeCompare(String(a.id)));
}
