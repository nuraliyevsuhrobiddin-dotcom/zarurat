export function clientPageRecords(clients,{search='',status='',limit=50}={}){
 const q=search.trim().toLowerCase(),digits=q.replace(/\D/g,'');
 const matches=clients.filter(c=>(!status||(c.subscription?.state||'unavailable')===status)&&(!q||String(c.name).toLowerCase().includes(q)||String(c.phone).toLowerCase().includes(q)||digits.length>=3&&/^[+\d\s()-]+$/.test(q)&&String(c.phone).replace(/\D/g,'').includes(digits)))
  .sort((a,b)=>Number(b.subscription?.state==='active')-Number(a.subscription?.state==='active')||String(a.name).localeCompare(String(b.name)));
 return {records:matches.slice(0,limit),total:matches.length,hasMore:matches.length>limit};
}
