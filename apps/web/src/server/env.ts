/** Configurazione letta dall'ambiente, con valori sicuri per lo sviluppo. */
export const env = {
  get appUrl() {
    return process.env.APP_URL ?? 'http://localhost:3000';
  },
  get secure() {
    return this.appUrl.startsWith('https://');
  },
  get sessionSecret() {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 32) {
      if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET mancante o troppo corta (min. 32 caratteri)');
      return 'sviluppo-sviluppo-sviluppo-sviluppo-sviluppo';
    }
    return s;
  },
  get telegramToken() {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  },
  get telegramSecret() {
    return process.env.TELEGRAM_WEBHOOK_SECRET || '';
  },
  get telegramBot() {
    return process.env.TELEGRAM_BOT_USERNAME || '';
  },
};
