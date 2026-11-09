import { getPool } from '@/server/db/client';

export const dynamic = 'force-dynamic';

/** Controllo di salute per il browser chiosco e per il monitor esterno (docs/04 § 4.7). Nessun dato sanitario. */
export async function GET() {
  try {
    await getPool().query('SELECT 1');
    return Response.json({ ok: true, time: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
