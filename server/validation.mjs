import { HttpError } from './db.mjs';
import { publicConfig } from '../public/supabase-api.js';
export const fail = message => { throw new HttpError(400, message); };
export function text(value, label, min = 1, max = 200) {
  if (typeof value !== 'string') fail(`${label}ni kiriting.`);
  const result = value.trim();
  if (result.length < min || result.length > max) fail(`${label}: ${min}–${max} belgi kiriting.`);
  return result;
}
export function phone(value) {
  const result = String(value || '').replace(/[\s()-]/g, '');
  if (!/^\+998\d{9}$/.test(result)) fail('Telefonni +998 va 9 ta raqam shaklida kiriting.');
  return result;
}
export function password(value, min = 10) {
  if (typeof value !== 'string' || value.length < min || Buffer.byteLength(value) > 72) {
    fail(`Parol kamida ${min} belgi va ko‘pi bilan 72 bayt bo‘lishi kerak.`);
  }
  return value;
}
export function integer(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (!['number','string'].includes(typeof value) || (typeof value === 'string' && value.trim() === '')) fail(`${label} noto‘g‘ri.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail(`${label} noto‘g‘ri.`);
  return n;
}
export function choice(value, allowed, label) {
  if (!allowed.includes(value)) fail(`${label} noto‘g‘ri.`);
  return value;
}
export function timestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail('Sana noto‘g‘ri.');
  return new Date(value).toISOString();
}
export const allowedTypes = ['image/jpeg','image/png','image/webp','application/pdf','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'];
export function attachments(value = []) {
  if (!Array.isArray(value) || value.length > 3) fail('Jami 3 tagacha fayl biriktiring.');
  let total = 0;
  return value.map(file => {
    const name = text(file.name, 'Fayl nomi', 1, 200);
    const type = choice(file.type, allowedTypes, 'Fayl turi');
    if (typeof file.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) fail('Fayl mazmuni noto‘g‘ri.');
    const bytes = Buffer.from(file.data, 'base64');
    const size = integer(file.size, 'Fayl hajmi', 1, 2936012);
    if (bytes.length !== size) fail('Fayl hajmi mazmuniga mos emas.');
    const head = bytes.subarray(0, 16);
    const matches = {
      'image/jpeg': head[0] === 255 && head[1] === 216 && head[2] === 255,
      'image/png': head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      'image/webp': head.toString('ascii',0,4) === 'RIFF' && head.toString('ascii',8,12) === 'WEBP',
      'application/pdf': head.toString('ascii',0,5) === '%PDF-',
      'audio/webm': head.subarray(0,4).equals(Buffer.from([26,69,223,163])),
      'audio/ogg': head.toString('ascii',0,4) === 'OggS',
      'audio/mp4': head.toString('ascii',4,8) === 'ftyp',
      'audio/mpeg': head.toString('ascii',0,3) === 'ID3' || (head[0] === 255 && (head[1] & 224) === 224),
      'audio/wav': head.toString('ascii',0,4) === 'RIFF' && head.toString('ascii',8,12) === 'WAVE'
    };
    if (!matches[type]) fail('Fayl mazmuni ko‘rsatilgan turga mos emas.');
    total += size;
    if (total > 2936012) fail('Fayllarning jami hajmi 2.8 MB dan oshmasligi kerak.');
    return { name, type, size, data: file.data };
  });
}
export function requestInput(body) {
  if (body.consent !== true) fail('Shaxsiy ma’lumotlarni qayta ishlashga rozilik kerak.');
  return {
    name: text(body.name, 'Ism', 2, 100), phone: phone(body.phone),
    region: choice(body.region, publicConfig.regions, 'Hudud'),
    category: choice(body.category, publicConfig.categories.map(c => c.id), 'Yo‘nalish'),
    description: text(body.description, 'Murojaat', 10, 5000),
    preferred_time: body.preferredTime ? text(body.preferredTime, 'Qulay vaqt', 1, 150) : 'Istalgan vaqt',
    attachments: attachments(body.attachments)
  };
}
