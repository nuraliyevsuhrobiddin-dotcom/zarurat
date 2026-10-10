import {timingSafeEqual} from 'node:crypto';
import {HttpError} from './db.mjs';
export function requireJob(req,env){
 const secret=env.CRON_SECRET;
 const supplied=String(req.headers.authorization||'');
 const expected=`Bearer ${secret||''}`;
 const a=Buffer.from(supplied),b=Buffer.from(expected);
 if(!secret||a.length!==b.length||!timingSafeEqual(a,b))throw new HttpError(401,'Ruxsat yo‘q.');
}
