import { actorOf, json, withCaller } from '@/server/api';
import { revokeDevice } from '@/server/commands';
import { getDb } from '@/server/db/client';

export const DELETE = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await revokeDevice(getDb(), caller.patientId, id, actorOf(caller));
  return json({ ok: true });
});
