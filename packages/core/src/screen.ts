import { groupDoses, groupHas, groupResolved, type DoseView, type GroupView } from './group';
import { deriveDoseState, reminderConfigFor } from './state';
import { patientDay, parseHhmm, localParts } from './time';
import type { DayKey, Dose, DoseEvent, Medication, PatientSettings, ReminderConfig } from './types';

export type ScreenMode = 'reminder' | 'missed' | 'idle';

export interface ReminderInfo {
  group: GroupView;
  /** Dosi del momento ancora da confermare (le altre sono già prese). */
  pending: DoseView[];
  minutesLate: number;
  /** Il promemoria è insistente: più minuti di ritardo → più evidente. */
  insistent: boolean;
  snoozeLeft: number;
}

export interface PatientScreen {
  mode: ScreenMode;
  day: DayKey;
  reminder?: ReminderInfo;
  missed?: GroupView;
  next?: GroupView;
  today: GroupView[];
  allResolved: boolean;
}

/** Prepara le viste (dose + farmaco + stato) per un insieme di dosi. */
export function buildViews(
  doses: Dose[],
  meds: Medication[],
  events: DoseEvent[],
  now: number,
  settings: PatientSettings,
): DoseView[] {
  const medById = new Map(meds.map((m) => [m.id, m]));
  const byMed = new Map<string, Dose[]>();
  for (const d of doses) {
    const list = byMed.get(d.medicationId) ?? [];
    list.push(d);
    byMed.set(d.medicationId, list);
  }
  const views: DoseView[] = [];
  for (const d of doses) {
    const med = medById.get(d.medicationId);
    if (!med) continue;
    const next = (byMed.get(d.medicationId) ?? []).find((o) => o.scheduledAt > d.scheduledAt && o.day !== d.day) ??
      (byMed.get(d.medicationId) ?? []).find((o) => o.scheduledAt > d.scheduledAt);
    views.push({ dose: d, med, state: deriveDoseState(d, events, now, settings, next?.scheduledAt ?? null) });
  }
  return views;
}

/**
 * Decide che cosa mostra il tablet. `doses` deve coprire almeno ieri, oggi e domani del paziente.
 * Priorità: promemoria (dosi dovute, le critiche e le più vecchie per prime) → dose senza risposta → riposo.
 */
export function pickScreen(
  doses: Dose[],
  meds: Medication[],
  events: DoseEvent[],
  now: number,
  settings: PatientSettings,
): PatientScreen {
  const day = patientDay(now, settings.tz);
  const views = buildViews(doses, meds, events, now, settings);
  const todayViews = views.filter((v) => v.dose.day === day);
  const today = groupDoses(todayViews, settings.groupWindowMin, settings.tz);

  // Le dosi di ieri ancora aperte contano come promemoria/mancate.
  const openOlder = views.filter((v) => v.dose.day < day && (v.state.status === 'due' || v.state.status === 'missed'));
  const live = [...openOlder, ...todayViews];
  const liveGroups = groupDoses(live, settings.groupWindowMin, settings.tz);

  const dueGroups = liveGroups.filter((g) => groupHas(g, 'due'));
  dueGroups.sort((a, b) => Number(b.critical) - Number(a.critical) || a.at - b.at);
  if (dueGroups[0]) {
    const group = dueGroups[0];
    const pending = group.doses.filter((d) => d.state.status === 'due');
    const cfg = reminderConfigFor({ critical: group.critical }, settings);
    const minutesLate = Math.max(0, Math.floor((now - group.at) / 60_000));
    return {
      mode: 'reminder',
      day,
      today,
      allResolved: false,
      next: undefined,
      reminder: {
        group,
        pending,
        minutesLate,
        insistent: minutesLate >= cfg.repeatEveryMin * 2,
        snoozeLeft: Math.max(0, cfg.maxSnoozes - Math.max(...pending.map((p) => p.state.snoozeCount))),
      },
    };
  }

  const missedGroup = liveGroups.find((g) => groupHas(g, 'missed'));
  const next = today.find((g) => g.doses.some((d) => d.state.status === 'scheduled' || d.state.status === 'snoozed'));
  if (missedGroup) {
    return { mode: 'missed', day, today, missed: missedGroup, next, allResolved: false };
  }
  return { mode: 'idle', day, today, next, allResolved: today.length > 0 && today.every(groupResolved) };
}

/** Tema notte automatico (docs/05 § 5.5): dalle 21:00 alle 06:30. */
export function isNightTime(now: number, tz: string): boolean {
  const p = localParts(now, tz);
  const minutes = p.h * 60 + p.mi;
  return minutes >= 21 * 60 || minutes < 6 * 60 + 30;
}

/** Ripetizione di suono e voce: ogni X minuti nella prima fase, poi ogni Y (docs/04 § 4.3). */
export function repeatIntervalMs(minutesSinceDue: number, cfg: ReminderConfig): number {
  return (minutesSinceDue < cfg.repeatPhaseMin ? cfg.repeatEveryMin : cfg.repeatLaterEveryMin) * 60_000;
}

export function shouldRepeatSound(dueAt: number, lastPlayedAt: number | null, now: number, cfg: ReminderConfig): boolean {
  if (lastPlayedAt == null) return true;
  const minutes = (now - dueAt) / 60_000;
  return now - lastPlayedAt >= repeatIntervalMs(minutes, cfg);
}

/** Volume crescente in 30 secondi (docs/05 § 5.6): da 35% a 100%. */
export function volumeAt(msSincePlayStart: number, base = 0.35, max = 1): number {
  const t = Math.min(1, Math.max(0, msSincePlayStart / 30_000));
  return base + (max - base) * t;
}

export { parseHhmm };
