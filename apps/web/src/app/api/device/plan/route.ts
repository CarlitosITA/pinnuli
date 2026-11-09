import { createHash } from 'node:crypto';
import { getDb } from '@/server/db/client';
import { deviceFromRequest } from '@/server/auth';
import { fail, json, safe } from '@/server/api';
import { buildPlan, syncDoses } from '@/server/therapy';

export const dynamic = 'force-dynamic';

const lastSync = new Map<string, number>();

/** Dosi, farmaci e routine per le prossime 72 ore (docs/06 § 6.5), con ETag per scaricare solo se cambiato. */
export const GET = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req);
  if (!dev) return fail('Dispositivo non collegato', 401);
  const db = getDb();
  const now = Date.now();
  if ((lastSync.get(dev.patientId) ?? 0) < now - 60_000) {
    lastSync.set(dev.patientId, now);
    await syncDoses(db, dev.patientId, now);
  }
  const plan = await buildPlan(db, dev.patientId, now);
  if (!plan) return fail('Paziente non trovato', 404);
  const { serverNow, ...stable } = plan;
  const etag = `"${createHash('sha1').update(JSON.stringify(stable)).digest('hex')}"`;
  const headers = { ETag: etag, 'Cache-Control': 'no-store' };
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ...headers, 'X-Server-Now': String(serverNow) } });
  }
  return Response.json({ ...plan, device: { id: dev.device.id, name: dev.device.name, kind: dev.device.kind } }, { headers });
});
