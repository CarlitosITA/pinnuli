import { localParts, quantityWords, type DoseView } from '@pinnuli/core';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function dayPart(h: number): string {
  if (h < 6) return 'notte';
  if (h < 12) return 'mattina';
  if (h < 14) return 'mezzogiorno';
  if (h < 18) return 'pomeriggio';
  if (h < 22) return 'sera';
  return 'notte';
}

/** "Lunedì 9 novembre · mattina": il giorno e il momento sono sempre visibili (docs/05 § 5.7). */
export function dateLabel(ms: number, tz: string): string {
  const d = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(new Date(ms));
  return `${cap(d)} · ${dayPart(localParts(ms, tz).h)}`;
}

/** "tra 25 minuti", "tra 2 ore", "tra poco". */
export function inWords(targetMs: number, nowMs: number): string {
  const min = Math.round((targetMs - nowMs) / 60_000);
  if (min <= 0) return 'adesso';
  if (min === 1) return 'tra un minuto';
  if (min < 60) return `tra ${min} minuti`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 1 && m < 10) return 'tra un’ora';
  if (m >= 40) return `tra ${h + 1} ore`;
  return h === 1 ? 'tra un’ora e mezza' : `tra ${h} ore`;
}

export function minutesWords(min: number): string {
  if (min < 1) return 'meno di un minuto';
  if (min === 1) return 'un minuto';
  if (min < 60) return `${min} minuti`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h === 1 ? 'un’ora' : h + ' ore'} e ${m} minuti` : h === 1 ? 'un’ora' : `${h} ore`;
}

export function medLabel(v: DoseView): { name: string; flag: string | null } {
  return { name: v.med.name, flag: v.med.distinguishing ?? null };
}

export function qty(v: DoseView) {
  return quantityWords(v.dose.quantity, v.med.form);
}

export const listLabel = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
