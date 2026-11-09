import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { deviceFromRequest } from '@/server/auth';
import { fail, json, parse, safe } from '@/server/api';
import { getDb, schema } from '@/server/db/client';
import { notify } from '@/server/hub';

export const dynamic = 'force-dynamic';

const body = z.object({
  battery: z.number().int().min(0).max(100).nullish(),
  charging: z.boolean().nullish(),
  audioOk: z.boolean().nullish(),
  version: z.string().max(40).nullish(),
  deviceNow: z.number().int().optional(),
});

/** Segnale di vita (docs/06 § 6.5): batteria, alimentazione, ora del dispositivo, audio sbloccato. */
export const POST = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req, false);
  if (!dev) return fail('Dispositivo non collegato', 401);
  const b = await parse(req, body);
  const now = Date.now();
  await getDb()
    .update(schema.devices)
    .set({
      lastSeenMs: now,
      battery: b.battery ?? null,
      charging: b.charging ?? null,
      audioOk: b.audioOk ?? null,
      version: b.version ?? null,
      clockSkewMs: b.deviceNow ? b.deviceNow - now : null,
    })
    .where(eq(schema.devices.id, dev.device.id));
  await notify(dev.patientId, 'device');
  return json({ ok: true, serverNow: now });
});
