import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { deviceFromRequest } from '@/server/auth';
import { fail, json, parse, safe } from '@/server/api';
import { getDb, schema } from '@/server/db/client';
import { env } from '@/server/env';
import { saveSubscription } from '@/server/push';

export const dynamic = 'force-dynamic';

const body = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(6).max(100) }),
});

/** Il dispositivo chiede se le notifiche sono disponibili e con quale chiave iscriversi. */
export const GET = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req, false);
  if (!dev) return fail('Dispositivo non collegato', 401);
  return json({ enabled: !!(env.vapidPublic && env.vapidPrivate), publicKey: env.vapidPublic || null });
});

/** Registra (o rinnova) l'iscrizione alle notifiche di questo dispositivo. */
export const POST = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req, false);
  if (!dev) return fail('Dispositivo non collegato', 401);
  const b = await parse(req, body);
  await saveSubscription(getDb(), dev.device.id, { endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth });
  return json({ ok: true }, { status: 201 });
});

/** Disattiva le notifiche di questo dispositivo. */
export const DELETE = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req, false);
  if (!dev) return fail('Dispositivo non collegato', 401);
  await getDb().delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.deviceId, dev.device.id));
  return json({ ok: true });
});
