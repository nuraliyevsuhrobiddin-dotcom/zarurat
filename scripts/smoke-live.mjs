const base='https://zarurat-inky.vercel.app';
const me=await fetch(base+'/api/auth/me');
const auth=await me.json();
console.log('Session endpoint:',me.status,'Configured:',auth.configured);
if(!me.ok||auth.configured!==true)throw new Error('Deployment not configured yet');
if(!process.env.ADMIN_PHONE||!process.env.ADMIN_PASSWORD){console.log('Stored admin login not available');process.exit(0);}
const login=await fetch(base+'/api/auth/login',{
 method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
 body:JSON.stringify({login:process.env.ADMIN_PHONE,password:process.env.ADMIN_PASSWORD})
});
console.log('Stored admin login HTTP:',login.status);
if(!login.ok){console.log('Account login must be verified with the existing account password.');process.exit(0);}
const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
try{
 for(const path of ['/users','/notifications','/stats','/cases','/partners','/packages']){
  const response=await fetch(base+'/api'+path,{headers:{Cookie:cookie}});
  const data=await response.json();
  const values=Object.values(data);
  const count=values.find(Array.isArray)?.length;
  console.log(path,'HTTP:',response.status,...(count===undefined?[]:['Rows:',count]));
  if(!response.ok)throw new Error(`Authenticated endpoint failed: ${path}`);
 }
}finally{
 const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:'{}'});
 console.log('Logout HTTP:',logout.status);
}
