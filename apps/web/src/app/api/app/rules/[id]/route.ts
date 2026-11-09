import { z } from 'zod';
import { actorOf, json, parse, withCaller } from '@/server/api';
import { deactivateRule, ruleInput, updateRule } from '@/server/commands';
import { getDb } from '@/server/db/client';

const body = ruleInput.partial().extend({ active: z.boolean().optional() });

export const PATCH = withCaller(async (caller, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await updateRule(getDb(), caller.patientId, id, actorOf(caller), await parse(req, body));
  return json({ ok: true });
});

export const DELETE = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await deactivateRule(getDb(), caller.patientId, id, actorOf(caller));
  return json({ ok: true });
});
