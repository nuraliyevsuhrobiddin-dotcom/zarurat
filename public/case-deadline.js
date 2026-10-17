export const deadlineClearUnavailable='Bajarish muddatini olib tashlash uchun baza yangilanishi kerak. Hozircha boshqa sanani tanlang.';

export function deadlineChanges(value,original,canClear) {
 if(value)return {dueAt:new Date(value).toISOString()};
 if(canClear)return {dueAt:null};
 if(original)throw new Error(deadlineClearUnavailable);
 return {};
}
