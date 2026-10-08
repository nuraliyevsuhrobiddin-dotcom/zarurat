import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const categories = [
  ['legal', 'Huquqiy yordam'], ['psychology', 'Psixolog'], ['medical', 'Tibbiy xizmat'],
  ['children', 'Bolalar'], ['elderly', 'Keksalar'], ['women', 'Ayollar'],
  ['business', 'Tadbirkorlik'], ['bank', 'Bank / kredit'], ['documents', 'Hujjatlar'],
  ['nanny', 'Enaga'], ['care', 'Qarovchi'], ['cleaning', 'Klining'], ['repair', 'Usta'], ['other', 'Boshqa'],
].map(([id, name]) => ({ id, name }));
export const regions = ['Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', 'Farg‘ona', 'Jizzax', 'Xorazm', 'Namangan', 'Navoiy', 'Qashqadaryo', 'Samarqand', 'Sirdaryo', 'Surxondaryo', 'Qoraqalpog‘iston'];
export const statuses = ['received', 'reviewing', 'searching', 'arranging', 'contacted', 'completed', 'cancelled'];
export const statusNames = ['Qabul qilindi', 'Koordinator ko‘rib chiqmoqda', 'Mutaxassis qidirilmoqda', 'Xizmat tashkil qilinmoqda', 'Mijoz bilan bog‘lanildi', 'Yakunlandi', 'Bekor qilindi'];
export const serviceStatuses = ['pending', 'accepted', 'contacted', 'delivered', 'completed', 'cancelled'];
export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function assert(condition, message, status = 400) { if (!condition) throw new AppError(status, message); }
export function str(value, name, min = 1, max = 200) {
  assert(typeof value === 'string', `${name} kiritilishi kerak.`);
  const result = value.trim();
  assert(result.length >= min && result.length <= max, `${name}: ${min}–${max} ta belgi kiriting.`);
  return result;
}
export function phone(value) {
  const result = str(value, 'Telefon', 9, 25).replace(/[\s()\-]/g, '');
  const normalized = /^\d{9}$/.test(result) ? `+998${result}` : result.startsWith('998') ? `+${result}` : result;
  assert(/^\+998\d{9}$/.test(normalized), 'Telefonni +998 90 123 45 67 ko‘rinishida kiriting.');
  return normalized;
}
export function choice(value, allowed, name) { assert(allowed.includes(value), `${name} noto‘g‘ri tanlangan.`); return value; }
export function integer(value, name, min = 0, max = 1_000_000_000) { assert(Number.isSafeInteger(value) && value >= min && value <= max, `${name}: ${min}–${max} oralig‘ida butun son kiriting.`); return value; }
export function date(value, name) { const result = str(value, name, 10, 40); assert(!Number.isNaN(Date.parse(result)), `${name} noto‘g‘ri.`); return new Date(result).toISOString(); }
export function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password, hash) {
  if (typeof hash !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) return false;
  const [salt, key] = hash.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
}
export const secret = () => randomBytes(24).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export const isTerminal = status => ['completed', 'cancelled'].includes(status);

export function parseAttachments(items = []) {
  assert(Array.isArray(items) && items.length <= 3, 'Ko‘pi bilan 3 ta fayl biriktiring.');
  const types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
  return items.map(item => {
    assert(item && typeof item === 'object', 'Fayl noto‘g‘ri.');
    const name = str(item.name, 'Fayl nomi', 1, 150).replace(/[\x00-\x1f\\/]/g, '_');
    const type = choice(String(item.type).split(';')[0], types, 'Fayl turi');
    assert(typeof item.data === 'string' && item.data.length <= 7_000_000 && /^[A-Za-z0-9+/]*={0,2}$/.test(item.data), 'Fayl ma’lumoti noto‘g‘ri.');
    const data = Buffer.from(item.data, 'base64');
    assert(data.length > 0 && data.length <= 5 * 1024 * 1024, 'Har bir fayl 5 MB dan oshmasligi kerak.');
    const hex = data.subarray(0, 12).toString('hex');
    const ascii = data.subarray(0, 16).toString('latin1');
    const valid = type === 'image/png' ? hex.startsWith('89504e470d0a1a0a') : type === 'image/jpeg' ? hex.startsWith('ffd8ff') : type === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8,12) === 'WEBP' : type === 'application/pdf' ? ascii.startsWith('%PDF-') : type === 'audio/webm' ? hex.startsWith('1a45dfa3') : type === 'audio/ogg' ? ascii.startsWith('OggS') : type === 'audio/wav' ? ascii.startsWith('RIFF') && ascii.slice(8,12) === 'WAVE' : type === 'audio/mp4' ? ascii.slice(4,8) === 'ftyp' : ascii.startsWith('ID3') || (data[0] === 255 && (data[1] & 224) === 224);
    assert(valid, 'Fayl tarkibi ko‘rsatilgan turiga mos emas.');
    return { name, type, data, size: data.length };
  });
}
