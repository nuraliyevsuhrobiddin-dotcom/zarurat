import { integer,choice,text } from './validation.mjs';
import { publicConfig } from '../public/supabase-api.js';

export function caseFilters(url,user,now=new Date()) {
  const params=url.searchParams;
  const filters={select:'*,coordinator:users!cases_coordinator_id_fkey(name),services(*,partners(name))',order:'id.desc',limit:51,offset:integer(params.get('offset')||0,'Sahifa',0)};
  if(user.role==='client')filters.client_id=`eq.${user.id}`;
  if(user.role==='partner'){
    // Filtering the inner relation restricts both the parent cases and services.
    filters.select=filters.select.replace('services(*','services!inner(*');
    filters['services.partner_id']=`eq.${user.partner_id||0}`;
  }
  const status=params.get('status');
  const category=params.get('category');
  if(status)filters.status=`eq.${choice(status,publicConfig.statuses,'Holat')}`;
  if(category)filters.category=`eq.${choice(category,publicConfig.categories.map(c=>c.id),'Yo‘nalish')}`;
  const tab=choice(params.get('tab')||'all',['all','new','open','overdue','completed'],'Bo‘lim');
  const constraints=[];
  if(tab==='new')constraints.push('status.eq.received');
  if(tab==='completed')constraints.push('status.eq.completed');
  if(tab==='open'||tab==='overdue'||params.get('overdue')==='true')constraints.push('status.not.in.(completed,cancelled)');
  if(tab==='overdue'||params.get('overdue')==='true')filters.due_at=`lt.${now.toISOString()}`;
  if(constraints.length)filters.and=`(${constraints.join(',')})`;
  const search=params.get('search');
  if(search?.trim()){
    // Restrict grammar punctuation, so input cannot add a PostgREST condition.
    const value=text(search,'Qidiruv',1,100).replace(/[^\p{L}\p{N}\p{M}\s+\-'‘’]/gu,'').trim();
    if(value){
      const pattern=JSON.stringify(`*${value}*`);
      filters.or=`(${['number','name','phone','description'].map(c=>`${c}.ilike.${pattern}`).join(',')})`;
      const compact=value.replace(/\s+/g,'');
      if(compact!==value)filters.or=filters.or.slice(0,-1)+`,phone.ilike.${JSON.stringify(`*${compact}*`)})`;
    }else filters.id='eq.0';
  }
  return filters;
}
