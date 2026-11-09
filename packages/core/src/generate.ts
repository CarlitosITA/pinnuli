import { addDays, diffDays, doseInstant, localToUtc, parseHhmm, weekdayOf } from './time';
import { DAY_START_HOUR } from './defaults';
import type {
  DayKey,
  DaysSpec,
  Dose,
  Hhmm,
  Medication,
  MomentKey,
  Rule,
  RuleOverride,
  TherapyInput,
} from './types';

const WD = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

export function dayMatches(spec: DaysSpec, day: DayKey, start: DayKey): boolean {
  switch (spec.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return spec.days.includes(weekdayOf(day));
    case 'everyN': {
      const d = diffDays(spec.anchor, day);
      return d >= 0 && d % Math.max(1, spec.n) === 0;
    }
    case 'cycle': {
      const d = diffDays(spec.anchor ?? start, day);
      if (d < 0) return false;
      const period = spec.on + spec.off;
      return period > 0 && d % period < spec.on;
    }
  }
}

function inRange(day: DayKey, from: DayKey, to: DayKey): boolean {
  return day >= from && day <= to;
}

function overrideTargets(o: RuleOverride, rule: Rule): boolean {
  if (o.target.all) return true;
  if (o.target.ruleId) return o.target.ruleId === rule.id;
  if (o.target.medicationId) return o.target.medicationId === rule.medicationId;
  return false;
}

function shortDate(day: DayKey): string {
  const [, m, d] = day.split('-');
  return `${WD[weekdayOf(day)]} ${Number(d)}/${Number(m)}`;
}

/** Orario dell'ancora (momento di routine) per un giorno, tenendo conto di "oggi si pranza alle…". */
export function momentTime(input: TherapyInput, day: DayKey, moment: MomentKey): Hhmm {
  const ov = input.routineOverrides.find((r) => r.day === day && r.moment === moment);
  return ov?.time ?? input.routine[moment];
}

function hhmmOf(totalMin: number): Hhmm {
  const t = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Orario locale di una regola per un giorno. Restituisce null per "al bisogno".
 * `wakeAt` (UTC ms) per la regola "al risveglio": se il paziente ha toccato "Buongiorno" vale quell'istante.
 */
function resolveInstant(
  timing: Rule['timing'],
  day: DayKey,
  input: TherapyInput,
): { at: number; localTime: Hhmm } | null {
  const tz = input.tz;
  if (timing.kind === 'asNeeded') return null;
  if (timing.kind === 'fixed') {
    return { at: doseInstant(day, timing.time, tz), localTime: timing.time };
  }
  if (timing.kind === 'wake') {
    const woke = input.wakeAt?.[day];
    if (woke != null) {
      const hhmm = new Intl.DateTimeFormat('it-IT', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(woke));
      return { at: woke, localTime: hhmm };
    }
    const t = momentTime(input, day, 'risveglio');
    return { at: doseInstant(day, t, tz), localTime: t };
  }
  const anchor = momentTime(input, day, timing.moment);
  const { h, mi } = parseHhmm(anchor);
  // Un'ancora tra 00:00 e 03:59 cade nel calendario del giorno successivo (giornata 04:00–03:59).
  const anchorMin = h * 60 + mi + (h < DAY_START_HOUR ? 1440 : 0);
  const total = anchorMin + timing.offsetMin;
  const calOffset = Math.floor(total / 1440);
  const time = hhmmOf(total);
  return { at: localToUtc(day, time, tz, calOffset), localTime: time };
}

export function medicationMap(meds: Medication[]): Map<string, Medication> {
  return new Map(meds.map((m) => [m.id, m]));
}

/**
 * Genera le dosi per i giorni [from, to] (inclusi). Funzione pura: nessun I/O.
 * Priorità tra variazioni (docs/02 § 2.4): sospensione totale > la più recente.
 */
export function generateDoses(input: TherapyInput, from: DayKey, to: DayKey): Dose[] {
  const meds = medicationMap(input.medications);
  const doses: Dose[] = [];

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const dayOverrides = input.overrides.filter((o) => inRange(day, o.from, o.to));
    const totalSuspend = dayOverrides.some((o) => o.kind === 'suspend' && o.target.all);

    for (const rule of input.rules) {
      if (!rule.active) continue;
      const med = meds.get(rule.medicationId);
      if (!med || med.status !== 'active') continue;
      if (day < rule.startDate) continue;
      if (rule.endDate && day > rule.endDate) continue;
      if (!dayMatches(rule.days, day, rule.startDate)) continue;
      if (rule.timing.kind === 'asNeeded') continue;

      const mine = dayOverrides
        .filter((o) => (o.kind === 'suspend' || o.kind === 'quantity' || o.kind === 'time') && overrideTargets(o, rule))
        .sort((a, b) => b.createdAt - a.createdAt);

      // Una sospensione vale più di qualunque altra variazione.
      if (totalSuspend || mine.some((o) => o.kind === 'suspend')) continue;

      let quantity = rule.quantity;
      let timing = rule.timing;
      let note: string | null = null;
      const qOv = mine.find((o) => o.kind === 'quantity');
      if (qOv?.quantity != null) {
        quantity = qOv.quantity;
        note = `cambiata fino a ${shortDate(qOv.to)}`;
      }
      const tOv = mine.find((o) => o.kind === 'time');
      if (tOv?.time) {
        timing = { kind: 'fixed', time: tOv.time };
        note = `cambiata fino a ${shortDate(tOv.to)}`;
      }

      const at = resolveInstant(timing, day, input);
      if (!at) continue;
      doses.push({
        key: `${rule.id}:${day}`,
        day,
        ruleId: rule.id,
        overrideId: null,
        medicationId: med.id,
        quantity,
        scheduledAt: at.at,
        localTime: at.localTime,
        critical: med.critical,
        ifForgotten: med.ifForgotten,
        changeNote: note,
        note: rule.note ?? null,
      });
    }

    // Variazioni "aggiungi" e "una tantum".
    if (!totalSuspend) {
      for (const o of dayOverrides) {
        if ((o.kind !== 'add' && o.kind !== 'once') || !o.medicationId || !o.time) continue;
        const med = meds.get(o.medicationId);
        if (!med || med.status === 'archived') continue;
        if (o.kind === 'once' && day !== o.from) continue;
        const suspendedMed = dayOverrides.some(
          (s) => s.kind === 'suspend' && s.target.medicationId === o.medicationId && s.createdAt > o.createdAt,
        );
        if (suspendedMed) continue;
        doses.push({
          key: `${o.id}:${day}`,
          day,
          ruleId: null,
          overrideId: o.id,
          medicationId: med.id,
          quantity: o.quantity ?? 1,
          scheduledAt: doseInstant(day, o.time, input.tz),
          localTime: o.time,
          critical: med.critical,
          ifForgotten: med.ifForgotten,
          changeNote: o.kind === 'once' ? 'solo oggi' : `aggiunta fino a ${shortDate(o.to)}`,
        });
      }
    }
  }

  doses.sort((a, b) => a.scheduledAt - b.scheduledAt || a.key.localeCompare(b.key));
  return doses;
}

/** Giorni in cui un antibiotico a durata limitata finisce domani: per l'avviso al caregiver (docs/02 § 2.3). */
export function rulesEndingOn(rules: Rule[], day: DayKey): Rule[] {
  return rules.filter((r) => r.active && r.endDate === day);
}
