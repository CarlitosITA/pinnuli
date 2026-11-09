import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/server/db/client';
import { deviceCookie } from '@/server/auth';
import { fail, json, safe } from '@/server/api';
import { safeEqual, sha256 } from '@/server/security';

export const dynamic = 'force-dynamic';

/** Il tablet chiede se un familiare ha inserito il codice. Il token passa una sola volta, in un cookie HttpOnly. */
export const GET = safe(async (req: Request) => {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get('deviceId') ?? '';
  const secret = url.searchParams.get('secret') ?? '';
  const db = getDb();
  const [d] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
  if (!d || !d.pollSecretHash || !safeEqual(d.pollSecretHash, sha256(secret))) return fail('Dispositivo sconosciuto', 404);

  if (d.status === 'active' && d.handoffToken) {
    await db
      .update(schema.devices)
      .set({ handoffToken: null, pollSecretHash: null })
      .where(and(eq(schema.devices.id, d.id), eq(schema.devices.status, 'active')));
    return json({ status: 'paired' }, { headers: { 'Set-Cookie': deviceCookie(d.handoffToken) } });
  }
  if (d.status === 'active') return json({ status: 'paired' });
  if (d.status === 'revoked') return json({ status: 'expired' });
  if ((d.pairingExpiresMs ?? 0) < Date.now()) return json({ status: 'expired' });
  return json({ status: 'pending', code: d.pairingCode });
});
