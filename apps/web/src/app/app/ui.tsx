'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* risposta vuota */
  }
  if (res.status === 401 && typeof window !== 'undefined' && !url.includes('/auth/')) {
    window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? 'Qualcosa non ha funzionato. Riprova.', res.status);
  return data as T;
}

/** Dati che si aggiornano da soli: al primo caricamento, ad ogni cambiamento segnalato dal server (SSE) e ogni 30 secondi. */
export function useLive<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await api<T>('GET', url);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    void load();
    let es: EventSource | null = null;
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      es = new EventSource('/api/app/stream');
      es.addEventListener('change', () => {
        clearTimeout(t);
        t = setTimeout(() => void load(), 250);
      });
    } catch {
      /* resta il controllo periodico */
    }
    const poll = setInterval(() => void load(), 30_000);
    const vis = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', vis);
    return () => {
      alive.current = false;
      es?.close();
      clearInterval(poll);
      clearTimeout(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [load]);

  return { data, error, reload: load };
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);
  const node = msg ? (
    <div className="cg-toast" role="status">
      {msg}
    </div>
  ) : null;
  return { show, node };
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="cg-sheet-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cg-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header>
          <h2>{title}</h2>
          <button className="cg-btn quiet" onClick={onClose} aria-label="Chiudi">
            Chiudi
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="cg-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function timeOf(ms: number, tz = 'Europe/Rome') {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(ms));
}

export function dateShort(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function dateLong(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function ago(ms: number, now: number) {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h fa` : `${Math.floor(h / 24)} g fa`;
}
