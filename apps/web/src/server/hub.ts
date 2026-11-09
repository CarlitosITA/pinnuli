import pg from 'pg';
import { getPool } from './db/client';

/**
 * Tempo reale con LISTEN/NOTIFY di PostgreSQL (docs/06): un solo collegamento in ascolto per processo,
 * i flussi SSE si registrano qui. `notify` lo possono chiamare anche il worker e gli altri processi.
 */
type Listener = (msg: { patientId: string; kind: string }) => void;

interface HubState {
  listeners: Map<string, Set<Listener>>;
  client?: pg.Client;
  starting?: Promise<void>;
}

const g = globalThis as unknown as { __pinnuliHub?: HubState };
const state: HubState = (g.__pinnuliHub ??= { listeners: new Map() });
const CHANNEL = 'pinnuli_events';

async function ensureListening() {
  if (state.client) return;
  state.starting ??= (async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    client.on('notification', (n) => {
      if (n.channel !== CHANNEL || !n.payload) return;
      try {
        const msg = JSON.parse(n.payload) as { patientId: string; kind: string };
        state.listeners.get(msg.patientId)?.forEach((fn) => fn(msg));
      } catch {
        /* messaggio non valido: ignorato */
      }
    });
    const reset = () => {
      state.client = undefined;
      state.starting = undefined;
    };
    client.on('error', reset);
    client.on('end', reset);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    state.client = client;
  })().catch((e) => {
    state.starting = undefined;
    throw e;
  });
  await state.starting;
}

export async function subscribe(patientId: string, fn: Listener): Promise<() => void> {
  await ensureListening();
  let set = state.listeners.get(patientId);
  if (!set) state.listeners.set(patientId, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) state.listeners.delete(patientId);
  };
}

export async function notify(patientId: string, kind: 'plan' | 'alert' | 'device' | 'command', pool = getPool()) {
  await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ patientId, kind })]);
}
