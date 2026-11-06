// Request contact details belong to the customer, never to the signed-in staff.
export function requestContact(user) {
  return user?.role === 'client'
    ? { name: user.name || '', phone: user.phone || '+998' }
    : { name: '', phone: '+998' };
}

export function coordinatorChoices(team, current) {
 const active=team.filter(user=>!user.blocked);
 if(current.coordinatorId==null||active.some(user=>user.id===current.coordinatorId))return active;
 return [...active,{id:current.coordinatorId,name:current.coordinatorName||'',role:current.coordinatorRole,previous:true}];
}

export function resetWorkspace(state) {
 Object.assign(state,{
  cases:[],caseOffset:0,casesHasMore:false,partners:[],clients:[],team:[],teamUsers:[],
  lastSubmission:null,lastTrack:null,trackingPrefill:null,packages:[],paymentData:null,stats:null,notifications:[],notificationKnownIds:null,notificationUnread:0,authOptions:null,accountDetails:null,caseTabRoute:null,
  filters:{search:'',status:'',category:'',overdue:false,tab:'all'}
 });
}

export const teamGroups = [
  { role: 'director', lat: 'Rahbarlar', cyr: 'Раҳбарлар' },
  { role: 'operator', lat: 'Koordinatorlar', cyr: 'Координаторлар' },
  { role: 'partner', lat: 'Hamkor hisoblari', cyr: 'Ҳамкор ҳисоблари' }
];
