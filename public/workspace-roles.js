// Request contact details belong to the customer, never to the signed-in staff.
export function requestContact(user) {
  return user?.role === 'client'
    ? { name: user.name || '', phone: user.phone || '+998' }
    : { name: '', phone: '+998' };
}

export function coordinatorChoices(team, current) {
 const active=team.filter(user=>['director','operator'].includes(user.role)&&!user.blocked);
 if(current.coordinatorRole&&!['director','operator'].includes(current.coordinatorRole))return active;
 if(current.coordinatorId==null||active.some(user=>user.id===current.coordinatorId))return active;
 return [...active,{id:current.coordinatorId,name:current.coordinatorName||'',role:current.coordinatorRole,previous:true}];
}

export function workspaceViewAllowed(role,view){
 const shared=['overview','cases','menu','settings'];
 if(shared.includes(view))return ['client','partner','operator','director'].includes(role);
 if(view==='packages')return ['client','operator','director'].includes(role);
 if(['partners','clients','notifications'].includes(view))return ['operator','director'].includes(role);
 return view==='team'&&role==='director';
}

export function partnerServiceCounts(cases){
 const services=cases.flatMap(c=>c.services||[]);
 return {total:services.length,open:cases.reduce((n,c)=>n+(['completed','cancelled'].includes(c.status)?0:(c.services||[]).filter(s=>!['completed','cancelled'].includes(s.status)).length),0),completed:services.filter(s=>s.status==='completed').length,cancelled:services.filter(s=>s.status==='cancelled').length};
}

export function serviceUpdatePayload(user,data){
 const body={status:data.status};
 if(['operator','director'].includes(user?.role)&&data.partnerId!==undefined)body.partnerId=data.partnerId?Number(data.partnerId):null;
 return body;
}

export function resetWorkspace(state) {
 Object.assign(state,{
  cases:[],caseOffset:0,casesHasMore:false,partners:[],clients:[],team:[],teamUsers:[],
  lastSubmission:null,lastTrack:null,trackingPrefill:null,packages:[],paymentData:null,stats:null,notifications:[],notificationKnownIds:null,notificationUnread:0,authOptions:null,accountDetails:null,caseTabRoute:null,
  filters:{search:'',status:'',category:'',overdue:false,tab:'all',assignee:''}
 });
}

export const teamGroups = [
  { role: 'director', lat: 'Rahbarlar', cyr: 'Раҳбарлар' },
  { role: 'operator', lat: 'Koordinatorlar', cyr: 'Координаторлар' },
  { role: 'partner', lat: 'Hamkor hisoblari', cyr: 'Ҳамкор ҳисоблари' }
];
