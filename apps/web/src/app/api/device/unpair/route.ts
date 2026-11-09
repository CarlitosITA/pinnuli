import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DEVICE_COOKIE, deviceFromRequest } from '@/server/auth';
import { fail, json, parse, safe } from '@/server/api';
import { getDb, schema } from '@/server/db/client';
import { notify } from '@/server/hub';
import { getPatient } from '@/server/therapy';
import { safeEqual } from '@/server/security';

export const dynamic = 'force-dynamic';

const body = z.object({ pin: z.string().regex(/^\d{4}$/), action: z.enum(['check', 'unpair']) });

/** Impostazioni nascoste del tablet (docs/09 P17): il PIN lo conosce solo il familiare. */
export const POST = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req, false);
  if (!dev) return fail('Dispositivo non collegato', 401);
  const { pin, action } = await parse(req, body);
  const patient = await getPatient(getDb(), dev.patientId);
  if (!patient || !safeEqual(patient.pin, pin)) return fail('PIN non corretto', 403);
  if (action === 'check') return json({ ok: true });
  await getDb().update(schema.devices).set({ status: 'revoked', tokenHash: null }).where(eq(schema.devices.id, dev.device.id));
  await notify(dev.patientId, 'device');
  return json({ ok: true }, { headers: { 'Set-Cookie': `${DEVICE_COOKIE}=; Path=/; HttpOnly; Max-Age=0` } });
});
