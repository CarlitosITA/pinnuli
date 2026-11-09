import { z } from 'zod';
import { actorOf, json, parse, withCaller } from '@/server/api';
import { caregiverDoseAction } from '@/server/commands';
import { getDb } from '@/server/db/client';

const body = z.object({ type: z.enum(['taken', 'not_taken', 'undo']), reason: z.string().max(100).nullish(), at: z.number().int().optional() });

/** Il familiare conferma, corregge o annulla una dose (docs/03 E4). */
export const POST = withCaller(async (caller, req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  const b = await parse(req, body);
  await caregiverDoseAction(getDb(), caller.patientId, actorOf(caller), { doseKey: decodeURIComponent(key), ...b });
  return json({ ok: true });
});
