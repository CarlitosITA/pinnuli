import { z } from 'zod';
import { actorOf, json, parse, withCaller } from '@/server/api';
import { createMedication, medicationInput, ruleInput } from '@/server/commands';
import { getDb } from '@/server/db/client';

const body = z.object({ medication: medicationInput, rules: z.array(ruleInput).min(1, 'Aggiungi almeno un orario') });

export const POST = withCaller(async (caller, req: Request) => {
  const b = await parse(req, body);
  const r = await createMedication(getDb(), caller.patientId, actorOf(caller), b);
  return json(r, { status: 201 });
});
