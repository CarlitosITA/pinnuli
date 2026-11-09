import { getDb } from '@/server/db/client';
import { startPairing } from '@/server/commands';
import { json, safe } from '@/server/api';

export const dynamic = 'force-dynamic';

/** Il tablet in attesa chiede un codice di collegamento da mostrare a schermo (docs/09 P1). */
export const POST = safe(async (req: Request) => {
  let kind: 'tablet' | 'phone' = 'tablet';
  try {
    const body = (await req.json()) as { kind?: string };
    if (body.kind === 'phone') kind = 'phone';
  } catch {
    /* corpo vuoto: tablet */
  }
  const r = await startPairing(getDb(), kind);
  return json(r);
});
