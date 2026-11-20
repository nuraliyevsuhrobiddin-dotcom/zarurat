export function activeSubscription(s,now=Date.now()){
 return s?.mode==='live'&&s.status==='active'&&Date.parse(s.starts_at)<=now&&Date.parse(s.expires_at)>now;
}
export function displayDate(value){
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return '—';
 return [d.getDate(),d.getMonth()+1,d.getFullYear()].map((n,i)=>i<2?String(n).padStart(2,'0'):String(n)).join('.');
}
