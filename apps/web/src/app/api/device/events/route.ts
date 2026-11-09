import { z } from 'zod';
import { deviceFromRequest } from '@/server/auth';
import { fail, json, parse, safe } from '@/server/api';
import { getDb } from '@/server/db/client';
import { resolveAlertsForResolvedDoses } from '@/server/commands';
import { recordEvents } from '@/server/therapy';

export const dynamic = 'force-dynamic';

const body = z.object({
  events: z
    .array(
      z.object({
        id: z.string().min(8).max(64),
        type: z.enum(['taken', 'not_taken', 'snoozed', 'undo', 'notified', 'wake']),
        doseKey: z.string().max(200).optional(),
        at: z.number().int(),
        until: z.number().int().optional(),
        reason: z.string().max(100).nullish(),
      }),
    )
    .max(200),
});

/** Invio a lotti degli eventi (presa, rinvio, non presa, annulla, buongiorno), idempotente sull'id del dispositivo. */
export const POST = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req);
  if (!dev) return fail('Dispositivo non collegato', 401);
  const { events } = await parse(req, body);
  const db = getDb();
  const res = await recordEvents(db, dev.patientId, events, `device:${dev.device.id}`);
  await resolveAlertsForResolvedDoses(db, dev.patientId);
  return json({ accepted: res.accepted, duplicates: res.duplicates });
});
