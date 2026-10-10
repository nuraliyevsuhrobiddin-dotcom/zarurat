import { createDatabase, query } from '../server/db.mjs';
import { text, phone, password } from '../server/validation.mjs';

// Explicit operator action only. Never runs at startup or during public registration.
const db=createDatabase();
const mobile=phone(process.env.ADMIN_PHONE);
const name=text(process.env.ADMIN_NAME||'Rahbar','Ism',2,100);
const secret=password(process.env.ADMIN_PASSWORD);
const existing=await db('users',{query:query({select:'id,role',phone:`eq.${mobile}`,limit:1})});
if(existing.length)throw new Error('Bu telefon uchun hisob mavjud. Mavjud hisob rolini faqat SQL Editor orqali ongli ravishda o‘zgartiring.');
const u=await db('rpc/zar_create_user',{method:'POST',body:{p_name:name,p_phone:mobile,p_login:mobile,p_password:secret,p_role:'client',p_partner_id:null}});
await db('users',{method:'PATCH',query:query({id:`eq.${u.id}`}),body:{role:'director'}});
console.log('Rahbar hisobi yaratildi. Telefon bilan kirishingiz mumkin.');
