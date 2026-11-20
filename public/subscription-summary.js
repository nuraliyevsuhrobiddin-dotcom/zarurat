import {displayDate} from './payment-state.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function subscriptionSummary(summary,script='lat',compact=false){
 const label=(a,b)=>script==='cyr'?b:a;
 if(summary?.state==='unlinked')return `<span class="pill amber">${label('Hisobga bog‘lanmagan','Ҳисобга боғланмаган')}</span>${compact?'':`<p class="small-text">${label('Obunani tekshirish uchun mijozning hisobini aniqlang.','Обунани текшириш учун мижознинг ҳисобини аниқланг.')}</p>`}`;
 if(!summary||summary.state==='unavailable')return `<p class="small-text muted" role="status">${label('Obuna holati olinmadi. Yangilab ko‘ring.','Обуна ҳолати олинмади. Янгилаб кўринг.')}</p>`;
 if(summary.state!=='active')return `<span class="pill">${label('Faol obuna yo‘q','Фаол обуна йўқ')}</span>`;
 return summary.items.map(s=>`<div class="record-package"><span class="pill green">${label('Faol obuna','Фаол обуна')} · ${esc(s.tier)}</span>${compact?'':`<p>${label('Amal qiladi','Амал қилади')}: ${displayDate(s.expiresAt)}</p><p class="small-text">${label('Qoldi: huquqiy','Қолди: ҳуқуқий')} ${esc(s.remaining.legal)} · ${label('psixolog','психолог')} ${esc(s.remaining.psychology)} · ${label('tadbirkorlik','тадбиркорлик')} ${esc(s.remaining.business)}</p>${s.caseRecorded?`<span class="pill">${label('Bu murojaat limitdan hisoblangan','Бу мурожаат лимитдан ҳисобланган')}</span>`:''}`}</div>`).join('');
}
