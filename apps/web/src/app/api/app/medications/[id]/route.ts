import { actorOf, json, parse, withCaller } from '@/server/api';
import { medicationInput, updateMedication } from '@/server/commands';
import { getDb } from '@/server/db/client';
import { z } from 'zod';

const body = medicationInput.partial().extend({ status: z.enum(['active', 'suspended', 'archived']).optional() });

export const PATCH = withCaller(async (caller, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await updateMedication(getDb(), caller.patientId, id, actorOf(caller), await parse(req, body));
  return json({ ok: true });
});
