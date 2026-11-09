import { z } from 'zod';
import { actorOf, json, parse, withCaller } from '@/server/api';
import { claimDevice } from '@/server/commands';
import { getDb } from '@/server/db/client';

const body = z.object({
  code: z.string().regex(/^\s*\d{3}\s?\d{3}\s*$/, 'Il codice è di 6 cifre'),
  name: z.string().trim().max(40).optional(),
  kind: z.enum(['tablet', 'phone']).optional(),
});

/** Il familiare inserisce il codice mostrato sul tablet (docs/03 A4). */
export const POST = withCaller(async (caller, req: Request) => {
  const id = await claimDevice(getDb(), caller.patientId, actorOf(caller), await parse(req, body));
  return json({ id }, { status: 201 });
});
