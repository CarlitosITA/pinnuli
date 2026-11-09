import { getPool, getDb } from '../src/server/db/client';
import { runEscalationTick } from '../src/server/escalation';
import { createTelegramNotifier } from '../src/server/telegram';

/**
 * Processo separato dal sito (docs/06 § 6.2): ogni 30 secondi controlla le dosi dovute,
 * manda gli avvisi ai familiari e tiene d'occhio il tablet.
 */
const INTERVAL_MS = 30_000;
const notifier = createTelegramNotifier();
let stopping = false;
let timer: NodeJS.Timeout | undefined;

async function tick() {
  if (stopping) return;
  const started = Date.now();
  try {
    const r = await runEscalationTick(getDb(), started, notifier);
    if (r.created || r.resolved) console.log(JSON.stringify({ at: new Date(started).toISOString(), ...r }));
  } catch (e) {
    console.error('[worker] errore nel controllo', (e as Error).message);
  } finally {
    if (!stopping) timer = setTimeout(tick, Math.max(1000, INTERVAL_MS - (Date.now() - started)));
  }
}

function stop(signal: string) {
  console.log(`[worker] ${signal}: mi fermo`);
  stopping = true;
  if (timer) clearTimeout(timer);
  getPool()
    .end()
    .finally(() => process.exit(0));
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

console.log('[worker] avviato');
void tick();
