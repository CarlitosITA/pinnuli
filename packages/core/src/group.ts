import { formatLocalTime } from './time';
import type { Dose, DoseState, Medication } from './types';

export interface DoseView {
  dose: Dose;
  med: Medication;
  state: DoseState;
}

export interface GroupView {
  /** Chiave stabile: orario del primo + chiavi delle dosi. */
  id: string;
  at: number;
  localTime: string;
  doses: DoseView[];
  critical: boolean;
}

/** Dosi previste a pochi minuti l'una dall'altra formano un "momento" (docs/02 § 2.6). */
export function groupDoses(views: DoseView[], windowMin: number, tz: string): GroupView[] {
  const sorted = [...views].sort((a, b) => a.dose.scheduledAt - b.dose.scheduledAt || a.med.name.localeCompare(b.med.name));
  const groups: GroupView[] = [];
  for (const v of sorted) {
    const last = groups[groups.length - 1];
    if (last && v.dose.scheduledAt - last.at <= windowMin * 60_000) {
      last.doses.push(v);
      last.critical = last.critical || v.dose.critical;
      last.id = `${last.at}:${last.doses.map((d) => d.dose.key).join('+')}`;
    } else {
      groups.push({
        id: `${v.dose.scheduledAt}:${v.dose.key}`,
        at: v.dose.scheduledAt,
        localTime: formatLocalTime(v.dose.scheduledAt, tz),
        doses: [v],
        critical: v.dose.critical,
      });
    }
  }
  return groups;
}

export function groupHas(group: GroupView, status: DoseState['status']): boolean {
  return group.doses.some((d) => d.state.status === status);
}

export function groupAllTaken(group: GroupView): boolean {
  return group.doses.every((d) => d.state.status === 'taken');
}

export function groupResolved(group: GroupView): boolean {
  return group.doses.every((d) => d.state.status === 'taken' || d.state.status === 'not_taken');
}
