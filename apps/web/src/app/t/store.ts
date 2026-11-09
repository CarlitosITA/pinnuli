import type { Plan, IncomingEvent } from '@/server/therapy';

/** Archivio locale del tablet: il piano delle prossime ore e gli eventi non ancora inviati (docs/04 § 4.6). */
export type PlanData = Plan & { device: { id: string; name: string; kind: string } };

const K = { plan: 'pn.plan', queue: 'pn.queue', pair: 'pn.pair', skew: 'pn.skew', etag: 'pn.etag' } as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* spazio finito o archivio bloccato: il tablet funziona comunque in memoria */
  }
}

export const loadPlan = () => read<PlanData>(K.plan);
export const savePlan = (p: PlanData | null) => write(K.plan, p);
export const loadQueue = () => read<IncomingEvent[]>(K.queue) ?? [];
export const saveQueue = (q: IncomingEvent[]) => write(K.queue, q.length ? q : null);
export const loadPair = () => read<{ deviceId: string; secret: string; code: string; expiresMs: number }>(K.pair);
export const savePair = (p: { deviceId: string; secret: string; code: string; expiresMs: number } | null) => write(K.pair, p);
export const loadSkew = () => read<number>(K.skew) ?? 0;
export const saveSkew = (n: number) => write(K.skew, n);
export const loadEtag = () => read<string>(K.etag);
export const saveEtag = (e: string | null) => write(K.etag, e);

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'e-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
