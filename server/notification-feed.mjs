const events={assignment:'case.assignment_changed',deadline:'case.deadline_changed',clarification:'case.clarified',package:'package.used'};

// These staff activity records never enter the SMS/Telegram delivery queue.
export function notificationFeed(deliveries,history) {
 const internal=history.filter(h=>events[h.kind]).map(h=>({
  id:`history-${h.id}`,case_id:h.case_id,event:events[h.kind],
  caseNumber:h.cases?.number,recipientPhone:h.cases?.phone,
  createdAt:h.created_at,status:'recorded',source:'internal',message:''
 }));
 const outgoing=deliveries.map(n=>({...n,caseNumber:n.cases?.number,recipientPhone:n.recipient_phone,createdAt:n.created_at,source:'delivery'}));
 return [...outgoing,...internal].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)||String(b.id).localeCompare(String(a.id))).slice(0,100);
}
