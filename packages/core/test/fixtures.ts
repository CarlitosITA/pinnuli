import {
  DEFAULT_SETTINGS,
  SEED_MEDICATIONS,
  SEED_ROUTINE,
  SEED_RULES,
  addDays,
  type Medication,
  type Rule,
  type TherapyInput,
} from '../src';

export const TZ = 'Europe/Rome';
export const START = '2026-11-09'; // lunedì

export function seedTherapy(startDate = START): TherapyInput {
  const medications: Medication[] = SEED_MEDICATIONS.map(({ slug, ...m }) => ({ id: slug, ...m }));
  const rules: Rule[] = SEED_RULES.map((r, i) => ({
    id: `r${i + 1}`,
    medicationId: r.med,
    quantity: r.quantity,
    timing: r.timing,
    days: { kind: 'daily' },
    startDate,
    endDate: r.durationDays ? addDays(startDate, r.durationDays - 1) : null,
    note: r.note ?? null,
    active: true,
  }));
  return { tz: TZ, medications, rules, overrides: [], routine: SEED_ROUTINE, routineOverrides: [] };
}

export const settings = { ...DEFAULT_SETTINGS, tz: TZ };
export const at = (day: string, hhmm: string) => {
  // istante UTC di un orario locale Europe/Rome (novembre: CET = UTC+1)
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const [y, mo, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d, h - 1, m);
};
