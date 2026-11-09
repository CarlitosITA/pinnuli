import { and, eq } from 'drizzle-orm';
import { env } from '@/server/env';
import { json, withCaller } from '@/server/api';
import { getDb, schema } from '@/server/db/client';
import { newToken } from '@/server/security';

export const dynamic = 'force-dynamic';

const where = (userId: string, circleId: string) =>
  and(eq(schema.memberships.userId, userId), eq(schema.memberships.circleId, circleId));

/** Stato del collegamento Telegram del familiare. */
export const GET = withCaller(async (caller) => {
  const [m] = await getDb().select().from(schema.memberships).where(where(caller.user.id, caller.circleId));
  return json({ configured: !!env.telegramToken, linked: !!m?.telegramChatId, bot: env.telegramBot || null });
});

/** Genera un codice monouso e il link `t.me` da aprire con il telefono. */
export const POST = withCaller(async (caller) => {
  const code = newToken().replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  await getDb().update(schema.memberships).set({ telegramLinkCode: code }).where(where(caller.user.id, caller.circleId));
  const link = env.telegramBot ? `https://t.me/${env.telegramBot}?start=${code}` : null;
  return json({ code, link });
});

export const DELETE = withCaller(async (caller) => {
  await getDb().update(schema.memberships).set({ telegramChatId: null, telegramLinkCode: null }).where(where(caller.user.id, caller.circleId));
  return json({ ok: true });
});
