import { z } from 'zod';
import { MOMENTS } from '@pinnuli/core';
import { actorOf, json, parse, withCaller } from '@/server/api';
import { setRoutineOverride } from '@/server/commands';
import { getDb } from '@/server/db/client';

const body = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moment: z.enum(MOMENTS),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
});

/** "Oggi si pranza alle 14" (docs/03 B8). `time: null` rimette l'orario abituale. */
export const POST = withCaller(async (caller, req: Request) => {
  await setRoutineOverride(getDb(), caller.patientId, actorOf(caller), await parse(req, body));
  return json({ ok: true });
});
