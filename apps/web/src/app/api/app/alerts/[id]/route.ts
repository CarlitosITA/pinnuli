import { json, withCaller } from '@/server/api';
import { takeOverAlert } from '@/server/commands';
import { getDb } from '@/server/db/client';

/** "Me ne occupo io": ferma la catena di escalation per quella dose. */
export const POST = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await takeOverAlert(getDb(), caller.patientId, id, caller.user.id);
  return json({ ok: true });
});
