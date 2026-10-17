// Public catalogue only. Permissions and credentials live on the server.
import { categoryTitles } from './interface-copy.js';
export const publicConfig = {
  categories: [
    ['legal', 'Huquqiy yordam'], ['psychology', 'Psixolog'], ['medical', 'Tibbiy xizmat'],
    ['children', 'Bolalar'], ['elderly', 'Keksalar'], ['women', 'Ayollar'],
    ['business', 'Tadbirkorlik'], ['bank', 'Bank / kredit'], ['documents', 'Hujjatlar'],
    ['nanny', 'Enaga'], ['care', 'Qarovchi'], ['cleaning', 'Klining'], ['repair', 'Usta'], ['other', 'Boshqa']
  ].map(([id, name]) => ({ id, name: categoryTitles[id]?.[0] || name })),
  regions: ['Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', 'Farg‘ona', 'Jizzax',
    'Xorazm', 'Namangan', 'Navoiy', 'Qashqadaryo', 'Samarqand', 'Sirdaryo', 'Surxondaryo', 'Qoraqalpog‘iston'],
  statuses: ['received', 'reviewing', 'searching', 'arranging', 'contacted', 'completed', 'cancelled'],
  demo: false
};
