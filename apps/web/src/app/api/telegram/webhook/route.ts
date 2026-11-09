import { env } from '@/server/env';
import { fail, json, safe } from '@/server/api';
import { getDb } from '@/server/db/client';
import { safeEqual } from '@/server/security';
import { createTelegramNotifier, telegramCall } from '@/server/telegram';
import { handleTelegramUpdate, type TelegramUpdate } from '@/server/telegramWebhook';

export const dynamic = 'force-dynamic';

/** Webhook del bot. Si registra con `setWebhook` indicando il segreto: Telegram lo rimanda in un'intestazione. */
export const POST = safe(async (req: Request) => {
  const secret = env.telegramSecret;
  if (!secret) return fail('Telegram non configurato', 404);
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token') ?? '', secret)) return fail('Non autorizzato', 401);
  const update = (await req.json()) as TelegramUpdate;
  await handleTelegramUpdate(getDb(), update, {
    notifier: createTelegramNotifier(),
    answerCallback: (id, text) => telegramCall('answerCallbackQuery', { callback_query_id: id, text }),
  });
  return json({ ok: true });
});
