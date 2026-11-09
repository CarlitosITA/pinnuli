import { json, withCaller } from '@/server/api';
import { getDb } from '@/server/db/client';
import { removeMember } from '@/server/members';

export const DELETE = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
  const { userId } = await ctx.params;
  await removeMember(getDb(), { circleId: caller.circleId, role: caller.role, userId: caller.user.id }, userId);
  return json({ ok: true });
});
