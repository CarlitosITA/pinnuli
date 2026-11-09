import type { MedicationForm } from './types';

interface FormWords {
  singular: string;
  plural: string;
  gender: 'f' | 'm';
}

const FORMS: Record<MedicationForm, FormWords> = {
  compressa: { singular: 'compressa', plural: 'compresse', gender: 'f' },
  capsula: { singular: 'capsula', plural: 'capsule', gender: 'f' },
  bustina: { singular: 'bustina', plural: 'bustine', gender: 'f' },
  flaconcino: { singular: 'flaconcino', plural: 'flaconcini', gender: 'm' },
  gocce: { singular: 'goccia', plural: 'gocce', gender: 'f' },
  sciroppo: { singular: 'misurino', plural: 'misurini', gender: 'm' },
  cerotto: { singular: 'cerotto', plural: 'cerotti', gender: 'm' },
  inalatore: { singular: 'inalazione', plural: 'inalazioni', gender: 'f' },
  iniezione: { singular: 'iniezione', plural: 'iniezioni', gender: 'f' },
  altro: { singular: 'dose', plural: 'dosi', gender: 'f' },
};

const NUM_F = ['zero', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];
const NUM_M = ['zero', 'un', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];

/**
 * Quantità sempre a parole (docs/04 § 4.8): "mezza compressa", "una compressa e mezza", "due bustine".
 * `emphasis` indica se la quantità richiede attenzione (frazioni): la UI la evidenzia.
 */
export function quantityWords(q: number, form: MedicationForm): { text: string; fractional: boolean } {
  const f = FORMS[form];
  const nums = f.gender === 'f' ? NUM_F : NUM_M;
  const half = f.gender === 'f' ? 'mezza' : 'mezzo';
  const whole = Math.floor(q + 1e-9);
  const frac = Math.round((q - whole) * 100) / 100;

  if (form === 'gocce') {
    return { text: `${formatNumber(q)} ${q === 1 ? f.singular : f.plural}`, fractional: false };
  }

  if (frac === 0) {
    const word = whole <= 10 ? nums[whole]! : String(whole);
    return { text: `${word} ${whole === 1 ? f.singular : f.plural}`, fractional: false };
  }
  if (whole === 0) {
    if (frac === 0.5) return { text: `${half} ${f.singular}`, fractional: true };
    if (frac === 0.25) return { text: `un quarto di ${f.singular}`, fractional: true };
    if (frac === 0.75) return { text: `tre quarti di ${f.singular}`, fractional: true };
  } else {
    const w = whole <= 10 ? nums[whole]! : String(whole);
    if (frac === 0.5) return { text: `${w} ${whole === 1 ? f.singular : f.plural} e mezza`.replace('e mezza', f.gender === 'f' ? 'e mezza' : 'e mezzo'), fractional: true };
    if (frac === 0.25) return { text: `${w} ${whole === 1 ? f.singular : f.plural} e un quarto`, fractional: true };
  }
  return { text: `${formatNumber(q)} ${f.plural}`, fractional: true };
}

export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Frazioni consentite nel selettore del caregiver. */
export const QUANTITY_CHOICES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
