const normalize=value=>String(value??'').toLowerCase().trim();
const matches=(query,values)=>{
 const q=normalize(query);if(!q)return true;
 if(values.some(v=>normalize(v).includes(q)))return true;
 return /^[+\d\s()-]+$/.test(q)&&q.replace(/\D/g,'').length>=3&&values.some(v=>String(v??'').replace(/\D/g,'').includes(q.replace(/\D/g,'')));
};
export function filterTeam(users,{search='',status=''}={}){
 return users.filter(u=>(!status||(status==='blocked'?u.blocked:!u.blocked))&&matches(search,[u.name,u.login,u.phone]));
}
export function filterPartners(partners,{search='',category='',status=''}={}){
 return partners.filter(p=>(!category||p.category===category)&&(!status||p.contractStatus===status)&&matches(search,[p.name,p.phone,p.region]));
}
export function notificationCategory(row){
 if(row.source==='incoming')return 'incoming';
 if(row.event==='subscription.activated')return 'subscriptions';
 return row.source==='delivery'?'delivery':'activity';
}
export function notificationPage(rows,{search='',kind='',category='',limit=20}={}){
 const all=rows.filter(n=>(!category||notificationCategory(n)===category)&&(!kind||(kind==='subscriptions'?n.event==='subscription.activated':kind==='internal'?n.source==='internal':kind==='sent'?n.source==='delivery'&&n.status==='sent':n.source==='delivery'&&['failed','queued','pending','sending'].includes(n.status)))&&matches(search,[n.caseNumber,n.clientName,n.recipientPhone,n.tier]));
 return {rows:all.slice(0,limit),total:all.length,hasMore:all.length>limit};
}
export function passwordTarget(user){return user&&['operator','partner'].includes(user.role)?user:null;}
