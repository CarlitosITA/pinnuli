import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE, newSessionValue, sessionCookieOptions } from '@/server/auth';
import { json, parse, safe } from '@/server/api';
import { getDb } from '@/server/db/client';
import { acceptInvite } from '@/server/members';

export const dynamic = 'force-dynamic';

const body = z.object({
  token: z.string().min(20).max(100),
  name: z.string().trim().min(1, 'Scrivi il tuo nome').max(60),
  email: z.string().trim().toLowerCase().email('Scrivi un indirizzo email valido'),
  gender: z.enum(['f', 'm', 'x']).optional(),
  password: z.string().min(1, 'Scegli una password').max(200),
});

export const POST = safe(async (req: Request) => {
  const { token, ...input } = await parse(req, body);
  const { userId } = await acceptInvite(getDb(), token, input);
  (await cookies()).set(SESSION_COOKIE, newSessionValue(userId), sessionCookieOptions());
  return json({ ok: true }, { status: 201 });
});
