import type { Dose, DoseEvent, DoseState, PatientSettings, ReminderConfig } from './types';

export function reminderConfigFor(dose: Pick<Dose, 'critical'>, settings: PatientSettings): ReminderConfig {
  return dose.critical ? settings.reminder.critical : settings.reminder.normal;
}

/**
 * Istante dopo il quale una dose senza risposta diventa "mancata":
 * +3 ore (+90 min se critica) oppure 30 minuti prima della dose successiva dello stesso farmaco (docs/04 § 4.3).
 */
export function missedAtFor(dose: Dose, cfg: ReminderConfig, nextSameMedAt?: number | null): number {
  const byTime = dose.scheduledAt + cfg.missedAfterMin * 60_000;
  if (nextSameMedAt == null) return byTime;
  const byNext = nextSameMedAt - cfg.missedBeforeNextMin * 60_000;
  return Math.max(dose.scheduledAt + 60_000, Math.min(byTime, byNext));
}

/**
 * Lo stato di una dose si calcola dagli eventi, mai si sovrascrive (docs/04 § 4.6):
 * - una dichiarazione umana vince sullo stato automatico "mancata";
 * - tra due dichiarazioni umane in contrasto vince quella con l'ora reale più recente, e si segnala `conflict`;
 * - "annulla" cancella l'ultima dichiarazione.
 * Eventi con lo stesso id (invii ripetuti) contano una volta sola.
 */
export function deriveDoseState(
  dose: Dose,
  allEvents: DoseEvent[],
  now: number,
  settings: PatientSettings,
  nextSameMedAt?: number | null,
): DoseState {
  const cfg = reminderConfigFor(dose, settings);
  const seen = new Set<string>();
  const events = allEvents
    .filter((e) => e.doseKey === dose.key)
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

  let human: { type: 'taken' | 'not_taken'; at: number; takenAt: number; reason?: string | null } | null = null;
  let conflict = false;
  let snoozeUntil: number | undefined;
  let snoozeCount = 0;
  let lastActionAt: number | undefined;

  for (const e of events) {
    if (e.type === 'taken' || e.type === 'not_taken') {
      if (human && human.type !== e.type) conflict = true;
      // `at` è quando è stato premuto (decide l'ordine); `until` su «taken» è l'ora dichiarata in cui è stata presa davvero.
      human = { type: e.type, at: e.at, takenAt: e.type === 'taken' ? (e.until ?? e.at) : e.at, reason: e.reason };
      lastActionAt = e.at;
    } else if (e.type === 'undo') {
      human = null;
      conflict = false;
      lastActionAt = e.at;
    } else if (e.type === 'snoozed') {
      snoozeCount += 1;
      snoozeUntil = e.until;
    }
  }

  if (human?.type === 'taken') {
    const lateMin = Math.max(0, Math.round((human.takenAt - dose.scheduledAt) / 60_000));
    return {
      status: 'taken',
      takenAt: human.takenAt,
      lateMin,
      early: human.takenAt < dose.scheduledAt,
      snoozeCount,
      conflict,
      lastActionAt,
    };
  }
  if (human?.type === 'not_taken') {
    return { status: 'not_taken', reason: human.reason, snoozeCount, conflict, lastActionAt };
  }

  if (now < dose.scheduledAt) return { status: 'scheduled', snoozeCount, conflict, lastActionAt };
  if (snoozeUntil != null && now < snoozeUntil && now < missedAtFor(dose, cfg, nextSameMedAt)) {
    return { status: 'snoozed', snoozeUntil, snoozeCount, conflict, lastActionAt };
  }
  if (now >= missedAtFor(dose, cfg, nextSameMedAt)) return { status: 'missed', snoozeCount, conflict, lastActionAt };
  return { status: 'due', snoozeCount, conflict, lastActionAt };
}

/** Si può confermare in anticipo solo entro la finestra consentita. */
export function canTakeEarly(dose: Dose, now: number, settings: PatientSettings): boolean {
  const cfg = reminderConfigFor(dose, settings);
  return now >= dose.scheduledAt - cfg.earlyWindowMin * 60_000;
}

/** Il rinvio è ancora consentito? */
export function canSnooze(dose: Dose, state: DoseState, settings: PatientSettings): boolean {
  return state.snoozeCount < reminderConfigFor(dose, settings).maxSnoozes;
}
