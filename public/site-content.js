export const siteContent = {
  // Verified public contact only; never use sample or staff account data.
  phone: '+998 55 406 77 55',
  address: {
    lat: 'Qarshi shahri, Yoshlar texnoparki',
    cyr: 'Қарши шаҳри, Ёшлар технопарки'
  },
  hours: { lat: '24/7', cyr: '24/7' },
  responseTime: { lat: '', cyr: '' },
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Qarshi%20Yoshlar%20texnoparki',
  coordinator: { image: '', name: { lat: '', cyr: '' } },
  center: { image: '/images/qarshi-center.jpg' },
  // Company (MChJ) bank account for payments outside Payme. Empty fields stay hidden;
  // until they are filled, clients are asked to get the details from a coordinator.
  bank: { company: '', account: '', bank: '', mfo: '', inn: '' },
  // Telegram users must join this channel before using the bot. The bot has to be a
  // channel administrator; TELEGRAM_REQUIRED_CHANNEL overrides it ('' turns the check off).
  telegramChannel: 'zaruriyat_center_murojatlar'
};
