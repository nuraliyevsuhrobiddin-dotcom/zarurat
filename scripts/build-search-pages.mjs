import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicConfig} from '../public/supabase-api.js';
import {serviceContent} from '../public/service-content.js';
import {siteContent} from '../public/site-content.js';

export const searchOrigin='https://www.zaruriyat.uz';
export const serviceSlugs={legal:'huquqiy-yordam',psychology:'psixolog',medical:'tibbiy-mutaxassis',children:'bolalar-uchun-yordam',elderly:'keksalar-uchun-yordam',women:'ayollar-uchun-yordam',business:'tadbirkorlik-maslahati',bank:'bank-kredit-maslahati',documents:'hujjatlar',nanny:'enaga',care:'qarovchi',cleaning:'uy-tozalash',repair:'usta-tamirlash',other:'kerakli-xizmatni-aniqlash'};
const preparation={
 legal:'Masalangiz aliment, nikoh, meros yoki mulk bilan bog‘liqligini yozing. Hujjat bor-yo‘qligini koordinator bilan aniqlashtirasiz.',
 psychology:'Kim uchun maslahat kerakligi, qulay vaqt va maslahat shakli bo‘yicha istagingizni yozishingiz mumkin.',
 medical:'Qaysi mutaxassis yoki klinika kerakligi va qabul uchun qulay vaqtni ayting. Platforma tashxis qo‘ymaydi; qabulni tashkil etishga ko‘maklashadi.',
 children:'Bolaning yoshi va qanday kundalik yordam yoki maslahat kerakligini qisqacha tushuntiring.',
 elderly:'Yaqiningizga kundalik yordam, hujjat yoki qabulni tashkil etishdan qaysi biri kerakligini ayting.',
 women:'Oilaviy, huquqiy yoki maslahatga oid vaziyatingizni qisqacha yozing. Kerakli yo‘nalish suhbatda aniqlashtiriladi.',
 business:'Hujjat, shartnoma yoki tashkilotga murojaat bo‘yicha qanday maslahat kerakligini ko‘rsating.',
 bank:'Qaysi bank hujjati yoki murojaat tartibi bo‘yicha savolingiz borligini yozing. Kredit ajratish qarorini bank qabul qiladi.',
 documents:'Qaysi hujjat, ariza, uy-joy yoki kadastr masalasi bo‘yicha yordam kerakligini tushuntiring.',
 nanny:'Bolaning yoshi, qarash kerak bo‘lgan kunlar va soatlar hamda oilangiz talablarini yozing.',
 care:'Yaqiningizning kundalik parvarish ehtiyoji va qarovchi kerak bo‘lgan vaqtni aniqlashtiring.',
 cleaning:'Tozalanadigan joy, taxminiy ish hajmi va sizga qulay vaqtni ayting.',
 repair:'Santexnika, elektr yoki boshqa maishiy ta’mirlashdan qaysi ish kerakligini va manzil hududini yozing.',
 other:'Muammoni o‘z so‘zingiz bilan yozing. Xizmat nomini bilish shart emas; koordinator yo‘nalishni aniqlashga yordam beradi.'
};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const phone=siteContent.phone.replace(/[^+\d]/g,'');
const logo=searchOrigin+'/images/zaruriyat-logo-512.png';
const org={'@type':'Organization','@id':searchOrigin+'/#organization',name:'ZARURIYAT',url:searchOrigin+'/',logo,telephone:phone,address:{'@type':'PostalAddress',streetAddress:'Yoshlar texnoparki',addressLocality:'Qarshi',addressRegion:'Qashqadaryo',addressCountry:'UZ'},areaServed:{'@type':'City',name:'Qarshi'}};
const request=id=>'/#request'+(id?'?category='+encodeURIComponent(id):'');
const servicePath=id=>'/xizmatlar/'+serviceSlugs[id]+'/';
const actions=id=>`<div class="search-actions"><a class="btn" href="${request(id)}">Murojaat qoldirish</a><a class="btn outline" href="tel:${phone}">${esc(siteContent.phone)}</a></div>`;
const stepsMarkup=`<ol class="search-steps"><li><strong>Murojaat qoldiring.</strong> Ismingiz, telefon raqamingiz va vaziyatni yozing.</li><li><strong>Koordinator bilan aniqlashtiring.</strong> Koordinator murojaatni ko‘rib chiqib, siz bilan bog‘lanadi.</li><li><strong>Shartlarni kelishing.</strong> Mos hamkor, vaqt va narx mavjud imkoniyatga qarab kelishiladi.</li><li><strong>Jarayonni kuzating.</strong> Murojaat raqami va maxfiy kalit bilan holatini tekshiring.</li></ol>`;
const contact=`<p><strong>Manzil:</strong> ${esc(siteContent.address.lat)}</p><p><strong>Ish vaqti:</strong> ${esc(siteContent.hours.lat)}</p><p><a href="tel:${phone}">${esc(siteContent.phone)}</a> · <a href="${esc(siteContent.mapUrl)}" rel="noopener">Xaritada qidirish</a></p>`;
const catalog=()=>`<div class="search-catalog">${publicConfig.categories.map(c=>`<article class="search-card"><h2><a href="${servicePath(c.id)}">${esc(c.name)}</a></h2><p>${esc(serviceContent[c.id].summary[0])}</p><a class="search-text-link" href="${servicePath(c.id)}">Batafsil →</a></article>`).join('')}</div>`;
function headTags(path,graph){return `<link rel="canonical" href="${searchOrigin+path}">\n<meta property="og:url" content="${searchOrigin+path}">\n<meta property="og:image" content="${logo}">\n<meta property="og:site_name" content="ZARURIYAT">\n<meta property="og:locale" content="uz_UZ">\n<meta name="twitter:card" content="summary">\n<script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script>`;}
function page({path,title,description,heading,content,service}){
 const graph=[org,{'@type':'WebPage','@id':searchOrigin+path,url:searchOrigin+path,name:title,description,inLanguage:'uz',isPartOf:{'@id':searchOrigin+'/#website'}}];
 if(service)graph.push({'@type':'Service',name:service.name,url:searchOrigin+path,description,serviceType:service.name,provider:{'@id':org['@id']},areaServed:{'@type':'City',name:'Qarshi'}});
 return `<!doctype html>\n<html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#1758ca"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website">${headTags(path,graph)}<link rel="icon" href="/images/zaruriyat-logo-192.png"><link rel="stylesheet" href="/styles.css?v=27"><link rel="stylesheet" href="/search-pages.css?v=1"></head><body class="search-page"><a class="skip-link" href="#main">Asosiy mazmunga o‘tish</a><header class="search-header"><div class="container"><a class="search-brand" href="/"><img src="/images/zaruriyat-logo-192.png" alt="" width="38" height="38"><strong>ZARURIYAT</strong></a><nav aria-label="Asosiy navigatsiya"><a href="/xizmatlar/">Xizmatlar</a><a href="/qanday-ishlaydi/">Qanday ishlaydi</a><a href="/aloqa/">Aloqa</a><a href="/#login">Kabinet</a></nav></div></header><main id="main" class="container search-main"><nav class="search-breadcrumb" aria-label="Sahifa yo‘li"><a href="/">Bosh sahifa</a> / ${service?'<a href="/xizmatlar/">Xizmatlar</a> / ':''}<span>${esc(heading)}</span></nav><p class="eyebrow">Qashqadaryo · Qarshi shahri</p><h1>${esc(heading)}</h1>${content}</main><footer class="search-footer"><div class="container"><strong>ZARURIYAT</strong>${contact}<nav aria-label="Qo‘shimcha havolalar"><a href="/xizmatlar/">Barcha yo‘nalishlar</a><a href="/#track">Murojaatni kuzatish</a><a href="/#privacy">Maxfiylik va rozilik</a></nav><p>Xizmatlarni muvofiqlashtirish platformasi. Murojaat yuborish avtomatik to‘lov emas.</p></div></footer></body></html>\n`;
}

export function enhanceSearchHome(html){
 const marker='<!-- search-metadata:start -->';
 const tags=marker+'\n'+headTags('/',[org,{'@type':'WebSite','@id':searchOrigin+'/#website',url:searchOrigin+'/',name:'ZARURIYAT',inLanguage:'uz'}])+'\n<!-- search-metadata:end -->';
 html=html.includes(marker)?html.replace(/<!-- search-metadata:start -->[\s\S]*?<!-- search-metadata:end -->/,tags):html.replace('</head>',tags+'\n</head>');
 const fallback=`<main id="main" class="container" style="padding-top:32px;padding-bottom:32px"><h1>ZARURIYAT — Qarshida oilangiz uchun xizmatlar</h1><p>Koordinator murojaatingizni ko‘rib chiqib, siz bilan bog‘lanadi va kerakli mutaxassis yoki hamkor xizmatni topishda ko‘maklashadi.</p><nav aria-label="Xizmat va aloqa ma’lumotlari"><a href="/xizmatlar/">Barcha xizmatlar</a> · <a href="/qanday-ishlaydi/">Qanday ishlaydi</a> · <a href="/aloqa/">Aloqa</a></nav><ul>${publicConfig.categories.map(c=>`<li><a href="${servicePath(c.id)}">${esc(c.name)}</a></li>`).join('')}</ul>${contact}</main>`;
 html=html.replace(/<noscript>[\s\S]*?<\/noscript>/,'<noscript><style>#app{display:none}</style>'+fallback.replace('id="main"','id="no-script-main"')+'</noscript>');
 html=html.replace(/<div id="app">[\s\S]*?<\/div>(\s*<dialog)/,'<div id="app"><main id="main" class="startup" aria-busy="true"></main></div>$1');
 return html;
}

export async function buildSearchPages(output='public'){
 const dir=resolve(output);const root=resolve('.');if(!dir.startsWith(root+'/')&&!dir.startsWith(root+'\\'))throw Error('Output must be inside workspace');
 const pages=[{path:'/xizmatlar/',title:'Qarshida xizmatlar va mutaxassis topish | ZARURIYAT',description:'Qarshida oilangiz uchun kerakli xizmatni toping. Huquqiy maslahat, enaga, qarovchi, klining va usta bo‘yicha koordinatorga murojaat qoldiring.',heading:'Qarshida kerakli xizmatni toping',content:'<p>Yo‘nalishni tanlang. Koordinator ehtiyojingizni aniqlashtirib, mavjud hamkor va xizmat shartlarini siz bilan kelishadi.</p>'+catalog()},
 {path:'/qanday-ishlaydi/',title:'Murojaat va koordinator qanday ishlaydi? | ZARURIYAT Qarshi',description:'ZARURIYAT’da murojaat yuborish, koordinator bilan bog‘lanish, hamkorni tanlash va ish holatini kuzatish tartibi.',heading:'Murojaatdan xizmat natijasigacha',content:stepsMarkup+actions()+'<section class="search-section"><h2>To‘lov va kelishuv</h2><p>Murojaat yuborish avtomatik to‘lov emas. Xizmat hajmi, narxi, bajarish vaqti va hamkor mavjudligi alohida kelishiladi.</p><h2>Murojaatni qanday kuzataman?</h2><p>Yuborilgandan keyin berilgan raqam va maxfiy kalitni saqlang. <a class="search-text-link" href="/#track">Murojaatni kuzatish</a> bo‘limida tekshirishingiz mumkin.</p></section>'},
 {path:'/aloqa/',title:'Aloqa: Qarshi Yoshlar texnoparki | ZARURIYAT',description:'ZARURIYAT bilan bog‘laning: +998 55 406 77 55. Qarshi shahri, Yoshlar texnoparki. Ish vaqti 24/7. Koordinator orqali murojaat qoldiring.',heading:'ZARURIYAT bilan bog‘lanish',content:'<section class="search-section">'+contact+'</section>'+actions()+'<section class="search-section"><h2>Qaysi hududda ishlaymiz?</h2><p>Dastlab Qarshi shahrida murojaatlarni muvofiqlashtiramiz. Qashqadaryoning boshqa tumanlaridagi xizmat imkoniyatini koordinator bilan alohida aniqlashtiring.</p><h2>Murojaatdan keyin nima bo‘ladi?</h2><p>Koordinator murojaatingizni ko‘rib chiqib, siz bilan bog‘lanadi. Xizmatning bajarish vaqti mavjud mutaxassis va kelishuvga bog‘liq.</p></section>'}];
 for(const c of publicConfig.categories){const copy=serviceContent[c.id];pages.push({path:servicePath(c.id),title:`Qarshida ${c.name.toLocaleLowerCase('uz')} | ZARURIYAT`,description:`${copy.summary[0]}. Qarshida koordinatorga murojaat qoldiring; xizmat shartlari alohida kelishiladi.`,heading:`Qarshida ${c.name.toLocaleLowerCase('uz')}`,service:c,content:`<p class="search-lead">${esc(copy.summary[0])}</p><p>${esc(copy.detail[0])}</p>${actions(c.id)}<section class="search-section"><h2>Murojaatda nimalarni aytish kerak?</h2><p>${esc(preparation[c.id])}</p><h2>Keyingi qadamlar</h2>${stepsMarkup}<h2>Narx va vaqt</h2><p>Hamkor mavjudligi, xizmat hajmi, narxi va vaqti koordinator orqali kelishiladi. Murojaat yuborish avtomatik to‘lov emas.</p><a class="search-text-link" href="/xizmatlar/">Boshqa xizmatlarni ko‘rish →</a></section>`});}
 for(const p of pages){const file=join(dir,p.path,'index.html');await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,page(p));}
 const urls=['/',...pages.map(p=>p.path)];
 await writeFile(join(dir,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(p=>`  <url><loc>${searchOrigin+p}</loc></url>`).join('\n')+'\n</urlset>\n');
 await writeFile(join(dir,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${searchOrigin}/sitemap.xml\n`);
 await writeFile(join(dir,'index.html'),enhanceSearchHome(await readFile(join(dir,'index.html'),'utf8')));
 await writeFile(join(dir,'search-pages.css'),await readFile(new URL('../public/search-pages.css',import.meta.url),'utf8'));
 return {pages:urls.length,origin:searchOrigin};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))console.log(await buildSearchPages(process.argv[2]||'public'));

