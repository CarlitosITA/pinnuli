import { reminderConfigFor } from './state';
import type { Dose, DoseState, PatientSettings } from './types';

export interface EscalationInput {
  dose: Dose;
  state: DoseState;
  now: number;
  settings: PatientSettings;
  /** Lunghezza della catena di caregiver (≥ 1). */
  chainLength: number;
  /** Qualcuno ha toccato "Me ne occupo io". */
  takenOver: boolean;
  /** Passi già inviati (indice del caregiver nella catena). */
  sentSteps: number[];
}

/**
 * Restituisce il prossimo passo di escalation da inviare, oppure null.
 * Passo 0 = primo caregiver a +45 min (+20 min per i farmaci a orario critico);
 * poi ogni +15 (+10) minuti il successivo, finché qualcuno non prende in carico (docs/04 § 4.3–4.4).
 */
export function nextEscalationStep(i: EscalationInput): number | null {
  const { dose, state, now, settings, chainLength, takenOver, sentSteps } = i;
  if (state.status === 'taken' || state.status === 'not_taken' || state.status === 'scheduled') return null;
  if (takenOver || chainLength <= 0) return null;
  const cfg = reminderConfigFor(dose, settings);
  const elapsedMin = (now - dose.scheduledAt) / 60_000;
  if (elapsedMin < cfg.firstAlertMin) return null;
  const due = Math.min(chainLength - 1, Math.floor((elapsedMin - cfg.firstAlertMin) / cfg.nextCaregiverMin));
  for (let step = 0; step <= due; step++) {
    if (!sentSteps.includes(step)) return step;
  }
  return null;
}

export const DEVICE_OFFLINE_AFTER_MIN = 15;

export type DeviceHealth = 'online' | 'offline' | 'never';

export function deviceHealth(lastSeenAt: number | null | undefined, now: number): DeviceHealth {
  if (lastSeenAt == null) return 'never';
  return (now - lastSeenAt) / 60_000 > DEVICE_OFFLINE_AFTER_MIN ? 'offline' : 'online';
}

/**
 * Se il tablet è offline il server non può sapere se la dose è stata presa: l'avviso è diverso (docs/04 § 4.4).
 */
export function escalationKind(health: DeviceHealth): 'dose-not-confirmed' | 'device-offline' {
  return health === 'online' ? 'dose-not-confirmed' : 'device-offline';
}
