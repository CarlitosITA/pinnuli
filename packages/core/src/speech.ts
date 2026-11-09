import { quantityWords } from './quantity';
import type { DoseView } from './group';
import { localParts } from './time';

const HOURS = ['mezzanotte', "l'una", 'le due', 'le tre', 'le quattro', 'le cinque', 'le sei', 'le sette', 'le otto', 'le nove', 'le dieci', 'le undici', 'mezzogiorno'];

/** "le otto e mezza del mattino", "mezzogiorno e un quarto", "le sette meno un quarto di sera". */
export function timeInWords(ms: number, tz: string): string {
  const { h, mi } = localParts(ms, tz);
  let hour = h;
  let minute = mi;
  let minus = false;
  if (minute === 45) {
    hour = (h + 1) % 24;
    minus = true;
  }
  const h12 = hour % 12 === 0 ? (hour === 0 ? 0 : 12) : hour % 12;
  const hourWord = HOURS[h12]!;
  let tail = '';
  if (minus) tail = ' meno un quarto';
  else if (minute === 15) tail = ' e un quarto';
  else if (minute === 30) tail = ' e mezza';
  else if (minute !== 0) tail = ` e ${minute}`;
  const part = dayPart(h);
  return `${hourWord}${tail}${hour === 0 || hour === 12 ? '' : ` ${part}`}`.trim();
}

function dayPart(h: number): string {
  if (h >= 4 && h < 12) return 'del mattino';
  if (h >= 12 && h < 18) return 'del pomeriggio';
  if (h >= 18 && h < 22) return 'di sera';
  return 'di notte';
}

function medSpoken(v: DoseView): string {
  return v.med.name;
}

/**
 * Testo del promemoria (docs/04 § 4.8): nome, ora, farmaco, quantità. Nient'altro.
 * "Anna, sono le otto e mezza. È l'ora del Sinemet: una compressa."
 */
export function reminderSpeech(patientName: string, atMs: number, pending: DoseView[], tz: string): string {
  const when = timeInWords(atMs, tz);
  const verb = /^(l'una|mezzanotte|mezzogiorno)/.test(when) ? 'è' : 'sono';
  const lead = `${patientName}, ${verb} ${when}.`;
  if (pending.length === 1) {
    const v = pending[0]!;
    const q = quantityWords(v.dose.quantity, v.med.form).text;
    return `${lead} È l'ora del ${v.med.name}${v.med.distinguishing && !v.med.name.includes(v.med.distinguishing) ? ' ' + v.med.distinguishing : ''}: ${q}.`;
  }
  const names = pending.map(medSpoken);
  const list = names.length === 2 ? `${names[0]} e ${names[1]}` : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  const count = ['zero', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei'][pending.length] ?? String(pending.length);
  return `${lead} È l'ora di ${count} medicine: ${list}.`;
}
