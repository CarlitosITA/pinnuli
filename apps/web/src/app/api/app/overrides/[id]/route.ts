import { actorOf, json, withCaller } from '@/server/api';
import { deleteOverride } from '@/server/commands';
import { getDb } from '@/server/db/client';

export const DELETE = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await deleteOverride(getDb(), caller.patientId, id, actorOf(caller));
  return json({ ok: true });
});
