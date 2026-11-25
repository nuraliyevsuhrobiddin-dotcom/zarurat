// Customer-facing request status names in the bot. Coordinators arrange help by phone.
export const telegramStatuses = {
  received:'Qabul qilindi',
  reviewing:'Koordinator o‘rganmoqda',
  searching:'Mutaxassis qidirilmoqda',
  arranging:'Narx va vaqt kelishilmoqda',
  contacted:'Mutaxassis bilan bog‘landi',
  completed:'Bajarildi',
  cancelled:'Bekor qilindi'
};
export const telegramStatusIcons={received:'📥',reviewing:'🔍',searching:'🤝',arranging:'📅',contacted:'📞',completed:'✅',cancelled:'⛔'};
export const telegramStatusLabel=status=>`${telegramStatusIcons[status]||'🔔'} ${telegramStatuses[status]||'Yangilandi'}`;
