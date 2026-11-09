import type { PatientSettings, ReminderConfig, Routine } from './types';

/** Tempi predefiniti — docs/04 § 4.3. */
export const NORMAL_REMINDER: ReminderConfig = {
  repeatEveryMin: 3,
  repeatLaterEveryMin: 10,
  repeatPhaseMin: 15,
  snoozeMin: 10,
  maxSnoozes: 3,
  firstAlertMin: 45,
  nextCaregiverMin: 15,
  missedAfterMin: 180,
  earlyWindowMin: 60,
  missedBeforeNextMin: 30,
};

export const CRITICAL_REMINDER: ReminderConfig = {
  repeatEveryMin: 2,
  repeatLaterEveryMin: 5,
  repeatPhaseMin: 15,
  snoozeMin: 10,
  maxSnoozes: 1,
  firstAlertMin: 20,
  nextCaregiverMin: 10,
  missedAfterMin: 90,
  earlyWindowMin: 30,
  missedBeforeNextMin: 30,
};

export const DEFAULT_ROUTINE: Routine = {
  risveglio: '07:30',
  colazione: '08:00',
  pranzo: '13:00',
  merenda: '17:00',
  cena: '20:00',
  coricarsi: '22:30',
};

export const DEFAULT_SETTINGS: PatientSettings = {
  tz: 'Europe/Rome',
  groupWindowMin: 5,
  debounceMs: 800,
  holdToConfirm: false,
  undoSeconds: 10,
  textLevel: 'grande',
  reminder: { normal: NORMAL_REMINDER, critical: CRITICAL_REMINDER },
};

/** Inizio della giornata del paziente (ora locale). */
export const DAY_START_HOUR = 4;
