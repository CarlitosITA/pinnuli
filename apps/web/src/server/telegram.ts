import { env } from './env';

export interface Button {
  text: string;
  data: string;
}

export interface Notifier {
  /** Restituisce true se il messaggio è stato consegnato al canale. */
  sendTelegram(chatId: string, text: string, buttons?: Button[]): Promise<boolean>;
}

/** Invio reale tramite il bot Telegram (docs/04 § 4.5). Senza token configurato non fa nulla. */
export function createTelegramNotifier(fetchImpl: typeof fetch = fetch): Notifier {
  return {
    async sendTelegram(chatId, text, buttons) {
      const token = env.telegramToken;
      if (!token) return false;
      try {
        const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_markup: buttons?.length
              ? { inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.data }))] }
              : undefined,
          }),
        });
        return res.ok;
      } catch (e) {
        console.error('[telegram] invio non riuscito', (e as Error).message);
        return false;
      }
    },
  };
}

export async function telegramCall(method: string, payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch) {
  const token = env.telegramToken;
  if (!token) return false;
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Notificatore che raccoglie i messaggi: per i test e per l'ambiente senza bot. */
export function createMemoryNotifier(): Notifier & { sent: { chatId: string; text: string; buttons?: Button[] }[] } {
  const sent: { chatId: string; text: string; buttons?: Button[] }[] = [];
  return {
    sent,
    async sendTelegram(chatId, text, buttons) {
      sent.push({ chatId, text, buttons });
      return true;
    },
  };
}
