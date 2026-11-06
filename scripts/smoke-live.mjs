const base='https://www.zaruriyat.uz';
const me=await fetch(base+'/api/auth/me');
const auth=await me.json();
console.log('Session endpoint:',me.status,'Configured:',auth.configured);
if(!me.ok||auth.configured!==true)throw new Error('Deployment not configured yet');
const adminLogin=process.env.ADMIN_LOGIN||process.env.ADMIN_PHONE;
if(!adminLogin||!process.env.ADMIN_PASSWORD)throw new Error('Set ADMIN_LOGIN (or ADMIN_PHONE) and ADMIN_PASSWORD.');
const login=await fetch(base+'/api/auth/login',{
 method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
 body:JSON.stringify({login:adminLogin,password:process.env.ADMIN_PASSWORD})
});
console.log('Stored admin login HTTP:',login.status);
if(!login.ok)throw new Error('Account login failed. Verify the configured login and password.');
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
