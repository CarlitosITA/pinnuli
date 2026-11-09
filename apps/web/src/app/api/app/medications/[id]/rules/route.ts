import { actorOf, json, parse, withCaller } from '@/server/api';
import { addRule, ruleInput } from '@/server/commands';
import { getDb } from '@/server/db/client';

export const POST = withCaller(async (caller, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const ruleId = await addRule(getDb(), caller.patientId, id, actorOf(caller), await parse(req, ruleInput));
  return json({ id: ruleId }, { status: 201 });
});
