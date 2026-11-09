import { json, withCaller } from '@/server/api';
import { getDb } from '@/server/db/client';
import { cancelInvite } from '@/server/members';

export const DELETE = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await cancelInvite(getDb(), { circleId: caller.circleId, role: caller.role }, id);
  return json({ ok: true });
});
