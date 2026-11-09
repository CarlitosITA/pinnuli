import { z } from 'zod';
import { json, parse, withCaller } from '@/server/api';
import { getDb } from '@/server/db/client';
import { createInvite } from '@/server/members';

const body = z.object({ label: z.string().trim().min(1, 'Scrivi il nome di chi inviti').max(40) });

export const POST = withCaller(async (caller, req: Request) => {
  const { label } = await parse(req, body);
  const res = await createInvite(getDb(), { circleId: caller.circleId, role: caller.role, userId: caller.user.id }, label);
  return json(res, { status: 201 });
});
