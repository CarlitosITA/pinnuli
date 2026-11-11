import { z } from 'zod';
import { json, parse, withCaller } from '@/server/api';
import { getDb } from '@/server/db/client';
import { removeMember, setMemberGender } from '@/server/members';

const patch = z.object({ gender: z.enum(['f', 'm', 'x']) });

export const PATCH = withCaller(async (caller, req: Request, ctx: { params: Promise<{ userId: string }> }) => {
  const { userId } = await ctx.params;
  const { gender } = await parse(req, patch);
  await setMemberGender(getDb(), { circleId: caller.circleId, role: caller.role, userId: caller.user.id }, userId, gender);
  return json({ ok: true });
});

export const DELETE = withCaller(async (caller, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
  const { userId } = await ctx.params;
  await removeMember(getDb(), { circleId: caller.circleId, role: caller.role, userId: caller.user.id }, userId);
  return json({ ok: true });
});
