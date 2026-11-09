import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE, newSessionValue, sessionCookieOptions } from '@/server/auth';
import { fail, json, parse, safe } from '@/server/api';
import { getDb, schema } from '@/server/db/client';
import { verifyPassword } from '@/server/security';

export const dynamic = 'force-dynamic';

const body = z.object({ email: z.string().trim().toLowerCase().email('Scrivi un indirizzo email valido'), password: z.string().min(1, 'Scrivi la password') });

// Freno semplice contro i tentativi a raffica: 10 errori ogni 10 minuti per indirizzo.
const attempts = new Map<string, { n: number; since: number }>();

export const POST = safe(async (req: Request) => {
  const { email, password } = await parse(req, body);
  const now = Date.now();
  const a = attempts.get(email);
  if (a && now - a.since < 600_000 && a.n >= 10) return fail('Troppi tentativi. Riprova tra qualche minuto.', 429);

  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email));
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) {
    attempts.set(email, { n: a && now - a.since < 600_000 ? a.n + 1 : 1, since: a && now - a.since < 600_000 ? a.since : now });
    return fail('Email o password non corrette', 401);
  }
  attempts.delete(email);
  (await cookies()).set(SESSION_COOKIE, newSessionValue(user.id), sessionCookieOptions());
  return json({ ok: true });
});
