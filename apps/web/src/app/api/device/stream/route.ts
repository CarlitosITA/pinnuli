import { deviceFromRequest } from '@/server/auth';
import { fail, safe } from '@/server/api';
import { sseResponse } from '@/server/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Flusso SSE: dose aggiornata da un altro dispositivo, terapia cambiata (docs/06 § 6.5). */
export const GET = safe(async (req: Request) => {
  const dev = await deviceFromRequest(req, false);
  if (!dev) return fail('Dispositivo non collegato', 401);
  return sseResponse(req, dev.patientId);
});
