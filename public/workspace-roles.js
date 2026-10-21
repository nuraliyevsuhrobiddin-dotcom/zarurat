// Request contact details belong to the customer, never to the signed-in staff.
export function requestContact(user) {
  return user?.role === 'client'
    ? { name: user.name || '', phone: user.phone || '+998' }
    : { name: '', phone: '+998' };
}

export function resetWorkspace(state) {
 Object.assign(state,{
  cases:[],caseOffset:0,casesHasMore:false,partners:[],clients:[],team:[],teamUsers:[],
  lastSubmission:null,lastTrack:null,trackingPrefill:null,packages:[],paymentData:null,stats:null,notifications:[],authOptions:null,accountDetails:null,caseTabRoute:null,
  filters:{search:'',status:'',category:'',overdue:false,tab:'all'}
 });
}

export const teamGroups = [
  { role: 'director', lat: 'Rahbarlar', cyr: 'Раҳбарлар' },
  { role: 'operator', lat: 'Koordinatorlar', cyr: 'Координаторлар' },
  { role: 'partner', lat: 'Hamkor hisoblari', cyr: 'Ҳамкор ҳисоблари' }
];
