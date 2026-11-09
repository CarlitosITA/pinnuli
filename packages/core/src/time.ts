import { DAY_START_HOUR } from './defaults';
import type { DayKey, Hhmm } from './types';

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export function localParts(ms: number, tz: string): LocalParts {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Scostamento (ms) tra ora locale e UTC all'istante dato. */
export function tzOffsetMs(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyOf(y: number, m: number, d: number): DayKey {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDay(day: DayKey): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

export function parseHhmm(t: Hhmm): { h: number; mi: number } {
  const [h, mi] = t.split(':').map(Number) as [number, number];
  return { h, mi };
}

export function addDays(day: DayKey, n: number): DayKey {
  const { y, m, d } = parseDay(day);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dayKeyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function diffDays(a: DayKey, b: DayKey): number {
  const pa = parseDay(a);
  const pb = parseDay(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** 0 = lunedì … 6 = domenica */
export function weekdayOf(day: DayKey): number {
  const { y, m, d } = parseDay(day);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica
  return (js + 6) % 7;
}

/**
 * Istante UTC per un'ora locale. Nell'ora che "non esiste" (cambio di marzo) la dose
 * slitta al primo istante valido; nell'ora "doppia" (ottobre) vale la prima occorrenza.
 */
export function localToUtc(day: DayKey, time: Hhmm, tz: string, dayOffset = 0): number {
  const base = dayOffset === 0 ? day : addDays(day, dayOffset);
  const { y, m, d } = parseDay(base);
  const { h, mi } = parseHhmm(time);
  const wanted = Date.UTC(y, m - 1, d, h, mi, 0);
  const o1 = tzOffsetMs(wanted - 24 * 3600_000, tz);
  const o2 = tzOffsetMs(wanted + 24 * 3600_000, tz);
  const candidates = [...new Set([o1, o2])].map((o) => wanted - o).sort((a, b) => a - b);
  for (const t of candidates) {
    const lp = localParts(t, tz);
    if (Date.UTC(lp.y, lp.m - 1, lp.d, lp.h, lp.mi, 0) === wanted) return t;
  }
  // Ora inesistente: primo istante valido dopo il salto.
  for (let add = 1; add <= 180; add++) {
    const w = wanted + add * 60_000;
    for (const o of [o1, o2]) {
      const t = w - o;
      const lp = localParts(t, tz);
      if (Date.UTC(lp.y, lp.m - 1, lp.d, lp.h, lp.mi, 0) === w) return t;
    }
  }
  return wanted - o2;
}

/** Orario di una dose: le ore 00:00–03:59 cadono nel calendario del giorno successivo. */
export function doseInstant(day: DayKey, time: Hhmm, tz: string): number {
  const { h } = parseHhmm(time);
  return localToUtc(day, time, tz, h < DAY_START_HOUR ? 1 : 0);
}

/** Giorno del paziente a cui appartiene l'istante (04:00 → 03:59). */
export function patientDay(ms: number, tz: string): DayKey {
  const p = localParts(ms, tz);
  const cal = dayKeyOf(p.y, p.m, p.d);
  return p.h < DAY_START_HOUR ? addDays(cal, -1) : cal;
}

export function formatLocalTime(ms: number, tz: string): Hhmm {
  const p = localParts(ms, tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function minutesBetween(a: number, b: number): number {
  return Math.round((b - a) / 60_000);
}
