import assert from 'node:assert/strict';
import { HttpError } from '../../server/db.mjs';
const tables=new Set(['sessions','users','cases','services','history','attachments','feedback','partners','packages','package_usage','notifications','payment_orders','payme_transactions','family_subscriptions','subscription_usage']);
function splitConditions(value){
 let depth=0,quoted=false,escaped=false,start=0;const parts=[];
 for(let i=0;i<value.length;i++){const c=value[i];if(escaped){escaped=false;continue;}if(c==='\\'&&quoted){escaped=true;continue;}if(c==='"'){quoted=!quoted;continue;}if(quoted)continue;if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){parts.push(value.slice(start,i));start=i+1;}}
 parts.push(value.slice(start));return parts;
}
export function testDatabase(pg) { return async function db(resource,{method='GET',body,query=''}={}){
 if(resource.startsWith('rpc/')){
  const fn=resource.slice(4);assert.match(fn,/^zar_[a-z_]+$/);
  const entries=Object.entries(body||{});
  const args=entries.map(([key],i)=>{assert.match(key,/^p_[a-z_]+$/);return `${key}=>$${i+1}`;}).join(',');
  const values=entries.map(([,v])=>typeof v==='object'&&v!==null?JSON.stringify(v):v);
  try{return (await pg.query(`SELECT ${fn}(${args}) AS value`,values)).rows[0].value;}
  catch(error){if(error.code==='P0001')throw new HttpError(400,error.message);throw error;}
 }
 assert.ok(tables.has(resource));
 const params=new URLSearchParams(query), values=[],clauses=[];
 const condition=(key,value)=>{
  assert.match(key,/^[a-z_]+$/);
  if(value.startsWith('not.in.(')||value.startsWith('in.(')){
   const negative=value.startsWith('not.');const items=value.slice(negative?8:4,-1).split(',');
   return `${key} ${negative?'NOT IN':'IN'} (${items.map(v=>{values.push(v);return '$'+values.length;}).join(',')})`;
  }
  const dot=value.indexOf('.'),op=value.slice(0,dot);assert.ok(['eq','gt','lt','ilike','is'].includes(op));let input=value.slice(dot+1);
  if(op==='is'){assert.equal(input,'null');return `${key} IS NULL`;}
  if(op==='ilike'){if(input.startsWith('"'))input=JSON.parse(input);input=input.replaceAll('*','%');}
  values.push(input);return `${key} ${{eq:'=',gt:'>',lt:'<',ilike:'ILIKE'}[op]} $${values.length}`;
 };
 for(const [key,value]of params){
  if(['select','order','limit','offset'].includes(key))continue;
  if(key==='and'||key==='or'){
   const parts=splitConditions(value.slice(1,-1)).map(item=>{const dot=item.indexOf('.');return condition(item.slice(0,dot),item.slice(dot+1));});
   clauses.push(`(${parts.join(key==='and'?' AND ':' OR ')})`);continue;
  }
  if(key==='services.partner_id'){values.push(value.slice(3));clauses.push(`EXISTS(SELECT 1 FROM services WHERE services.case_id=cases.id AND services.partner_id=$${values.length})`);continue;}
  assert.match(key,/^[a-z_]+$/);
  clauses.push(condition(key,value));
 }
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 if(method==='POST'){
  const keys=Object.keys(body);keys.forEach(k=>assert.match(k,/^[a-z_]+$/));
  return (await pg.query(`INSERT INTO ${resource}(${keys.join(',')}) VALUES(${keys.map((k,i)=>'$'+(i+1)).join(',')}) RETURNING *`,keys.map(k=>body[k]))).rows;
 }
 if(method==='DELETE')return(await pg.query(`DELETE FROM ${resource}${where} RETURNING *`,values)).rows;
 if(method==='PATCH'){
  const sets=Object.entries(body).map(([key,value])=>{assert.match(key,/^[a-z_]+$/);values.push(value);return `${key}=$${values.length}`;});
  return(await pg.query(`UPDATE ${resource} SET ${sets.join(',')}${where} RETURNING *`,values)).rows;
 }
 let suffix='';
 if(params.has('order')){const [col,dir]=params.get('order').split('.');assert.match(col,/^[a-z_]+$/);suffix+=` ORDER BY ${col} ${dir==='desc'?'DESC':'ASC'}`;}
 for(const key of ['limit','offset'])if(params.has(key))suffix+=` ${key.toUpperCase()} ${Number(params.get(key))}`;
 const rows=(await pg.query(`SELECT * FROM ${resource}${where}${suffix}`,values)).rows;
 if(resource==='cases')for(const c of rows){
  c.coordinator=(await pg.query('SELECT name,role FROM users WHERE id=$1',[c.coordinator_id])).rows[0];
  c.services=(await pg.query('SELECT * FROM services WHERE case_id=$1',[c.id])).rows;
  for(const s of c.services)s.partners=(await pg.query('SELECT name FROM partners WHERE id=$1',[s.partner_id])).rows[0];
  c.history=(await pg.query('SELECT * FROM history WHERE case_id=$1',[c.id])).rows;
  c.attachments=(await pg.query('SELECT id,name,type,size FROM attachments WHERE case_id=$1',[c.id])).rows;
  c.feedback=(await pg.query('SELECT * FROM feedback WHERE case_id=$1',[c.id])).rows[0]||null;
 }
 if(resource==='packages')for(const p of rows){
  p.users=(await pg.query('SELECT name FROM users WHERE id=$1',[p.client_id])).rows[0];
  p.package_usage=(await pg.query('SELECT id,case_id FROM package_usage WHERE package_id=$1',[p.id])).rows;
 }
 if(resource==='notifications')for(const n of rows){
  n.cases=(await pg.query('SELECT number FROM cases WHERE id=$1',[n.case_id])).rows[0];
 }
 if(resource==='history')for(const h of rows){
  h.cases=(await pg.query('SELECT number,phone FROM cases WHERE id=$1',[h.case_id])).rows[0];
 }
 return rows;
}
}
