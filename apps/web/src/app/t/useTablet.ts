'use client';

import { isPhoneLike } from './notify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  pickScreen,
  patientDay,
  type DoseEvent,
  type PatientScreen,
} from '@pinnuli/core';
import type { IncomingEvent } from '@/server/therapy';
import {
  loadEtag,
  loadPair,
  loadPlan,
  loadQueue,
  loadSkew,
  saveEtag,
  savePair,
  savePlan,
  saveQueue,
  saveSkew,
  uuid,
  type PlanData,
} from './store';

export type Phase = 'boot' | 'pair' | 'run';
export type Link = 'ok' | 'offline';

const PLAN_POLL_MS = 60_000;
const FLUSH_MS = 10_000;
const HEARTBEAT_MS = 60_000;
export const SOFTWARE_VERSION = '0.1.0';

export interface PairState {
  deviceId: string;
  secret: string;
  code: string;
  expiresMs: number;
}

/**
 * Cuore del tablet: tiene il piano (ultimo scaricato, anche offline), la coda degli eventi da inviare,
 * l'orologio corretto con quello del server, e calcola che cosa mostrare con lo stesso motore delle regole
 * che gira sul server (docs/04 § 4.6).
 */
export function useTablet() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [queue, setQueue] = useState<IncomingEvent[]>([]);
  const [link, setLink] = useState<Link>('ok');
  const [pair, setPair] = useState<PairState | null>(null);
  const [tick, setTick] = useState(0);
  const skew = useRef(0);
  const queueRef = useRef<IncomingEvent[]>([]);
  const lastOk = useRef<number>(0);
  const fetching = useRef(false);

  const now = () => Date.now() + skew.current;
  // `tick` forza il ricalcolo ogni secondo
  void tick;

  // ─── avvio: archivio locale ───
  useEffect(() => {
    skew.current = loadSkew();
    const cached = loadPlan();
    const q = loadQueue();
    queueRef.current = q;
    setQueue(q);
    if (cached) {
      setPlan(cached);
      setPhase('run');
    }
    void fetchPlan(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── orologio ───
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const persistQueue = useCallback((q: IncomingEvent[]) => {
    queueRef.current = q;
    setQueue(q);
    saveQueue(q);
  }, []);

  // ─── scarico del piano ───
  const fetchPlan = useCallback(
    async (initial = false) => {
      if (fetching.current) return;
      fetching.current = true;
      try {
        const etag = loadEtag();
        const res = await fetch('/api/device/plan', { headers: etag && !initial ? { 'If-None-Match': etag } : {}, cache: 'no-store' });
        if (res.status === 304) {
          const serverNow = Number(res.headers.get('x-server-now'));
          if (serverNow) {
            skew.current = serverNow - Date.now();
            saveSkew(skew.current);
          }
          setLink('ok');
          lastOk.current = Date.now();
          return;
        }
        if (res.status === 401) {
          savePlan(null);
          saveEtag(null);
          setPlan(null);
          await startPairing();
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as PlanData;
        skew.current = data.serverNow - Date.now();
        saveSkew(skew.current);
        saveEtag(res.headers.get('etag'));
        savePlan(data);
        setPlan(data);
        setPhase('run');
        setLink('ok');
        lastOk.current = Date.now();
        // gli eventi già arrivati al server non servono più nella coda locale
        const known = new Set(data.events.map((e) => e.id));
        const rest = queueRef.current.filter((e) => !known.has(e.id));
        if (rest.length !== queueRef.current.length) persistQueue(rest);
      } catch {
        setLink('offline');
        if (!loadPlan()) setPhase((p) => (p === 'boot' ? 'pair' : p));
      } finally {
        fetching.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistQueue],
  );

  // ─── collegamento (P1) ───
  const startPairing = useCallback(async () => {
    setPhase('pair');
    let p = loadPair();
    if (!p || p.expiresMs < Date.now() + 60_000) {
      try {
        const res = await fetch('/api/device/pair-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: isPhoneLike() ? 'phone' : 'tablet' }) });
        if (!res.ok) throw new Error('pair-start');
        p = (await res.json()) as PairState;
        savePair(p);
      } catch {
        setLink('offline');
        return;
      }
    }
    setPair(p);
  }, []);

  useEffect(() => {
    if (phase !== 'pair') return;
    if (!pair) {
      void startPairing();
      return;
    }
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/device/pair-status?deviceId=${encodeURIComponent(pair.deviceId)}&secret=${encodeURIComponent(pair.secret)}`, { cache: 'no-store' });
        if (!res.ok) {
          savePair(null);
          setPair(null);
          return;
        }
        const s = (await res.json()) as { status: string; code?: string };
        setLink('ok');
        if (s.status === 'paired') {
          savePair(null);
          setPair(null);
          await fetchPlan(true);
        } else if (s.status === 'expired') {
          savePair(null);
          setPair(null);
        } else if (s.code && s.code !== pair.code) {
          setPair({ ...pair, code: s.code });
        }
      } catch {
        setLink('offline');
      }
    }, 3000);
    return () => clearInterval(id);
  }, [phase, pair, startPairing, fetchPlan]);

  // ─── aggiornamenti: SSE + controllo periodico ───
  useEffect(() => {
    if (phase !== 'run') return;
    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    try {
      es = new EventSource('/api/device/stream');
      es.addEventListener('change', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => void fetchPlan(), 300);
      });
    } catch {
      /* senza SSE resta il controllo periodico */
    }
    const poll = setInterval(() => void fetchPlan(), PLAN_POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void fetchPlan();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      es?.close();
      clearInterval(poll);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [phase, fetchPlan]);

  // ─── invio degli eventi (con nuovi tentativi) ───
  const flush = useCallback(async () => {
    const q = queueRef.current;
    if (!q.length) return;
    try {
      const res = await fetch('/api/device/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: q.slice(0, 100) }),
      });
      if (res.status === 401) return;
      if (!res.ok) throw new Error(String(res.status));
      const out = (await res.json()) as { accepted: string[]; duplicates: string[] };
      const done = new Set([...out.accepted, ...out.duplicates]);
      persistQueue(queueRef.current.filter((e) => !done.has(e.id)));
      setLink('ok');
      void fetchPlan();
    } catch {
      setLink('offline');
    }
  }, [fetchPlan, persistQueue]);

  useEffect(() => {
    if (phase !== 'run') return;
    const id = setInterval(() => void flush(), FLUSH_MS);
    void flush();
    return () => clearInterval(id);
  }, [phase, flush]);

  // ─── segnale di vita ───
  useEffect(() => {
    if (phase !== 'run') return;
    const beat = async () => {
      let battery: number | null = null;
      let charging: boolean | null = null;
      try {
        const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
        const b = await nav.getBattery?.();
        if (b) {
          battery = Math.round(b.level * 100);
          charging = b.charging;
        }
      } catch {
        /* non disponibile su tutti i browser */
      }
      const { audioReady } = await import('./audio');
      try {
        await fetch('/api/device/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ battery, charging, audioOk: audioReady(), version: SOFTWARE_VERSION, deviceNow: Date.now() }),
        });
        setLink('ok');
      } catch {
        setLink('offline');
      }
    };
    void beat();
    const id = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [phase]);

  // ─── eventi ───
  const emit = useCallback(
    (events: Omit<IncomingEvent, 'id'>[]) => {
      const withIds = events.map((e) => ({ ...e, id: uuid() }));
      persistQueue([...queueRef.current, ...withIds]);
      void flush();
      return withIds;
    },
    [flush, persistQueue],
  );

  // ─── stato calcolato ───
  const t = now();
  const allEvents: DoseEvent[] = useMemo(() => {
    if (!plan) return [];
    const map = new Map<string, DoseEvent>();
    for (const e of plan.events) map.set(e.id, e);
    for (const q of queue) {
      if (q.type === 'wake' || !q.doseKey) continue;
      map.set(q.id, { id: q.id, doseKey: q.doseKey, type: q.type, at: q.at, until: q.until, reason: q.reason });
    }
    return [...map.values()];
  }, [plan, queue]);

  const wakeDone = useMemo(() => {
    if (!plan) return false;
    if (plan.wake.at != null) return true;
    return queue.some((q) => q.type === 'wake' && plan.patient.tz && patientDay(q.at, plan.patient.tz) === patientDay(t, plan.patient.tz));
  }, [plan, queue, t]);

  const screen: PatientScreen | null = plan
    ? pickScreen(plan.doses, plan.medications, allEvents, t, plan.patient.settings)
    : null;

  // Piano troppo vecchio: niente dosi nel futuro e nessuna rete (docs/04 § 4.7).
  const stale = !!plan && link === 'offline' && !plan.doses.some((d) => d.scheduledAt > t) && t - lastOk.current > 60 * 60_000;

  return { phase, plan, screen, link, pair, now: t, emit, flush, wakeDone, stale, refresh: fetchPlan, queueLength: queue.length, startPairing };
}
