/** Giorno del paziente, in forma "AAAA-MM-GG". La giornata va dalle 04:00 alle 03:59 (docs/02 § 2.7). */
export type DayKey = string;
/** Orario locale "HH:MM". */
export type Hhmm = string;

export const MOMENTS = ['risveglio', 'colazione', 'pranzo', 'merenda', 'cena', 'coricarsi'] as const;
export type MomentKey = (typeof MOMENTS)[number];

export const MEDICATION_FORMS = [
  'compressa',
  'capsula',
  'bustina',
  'flaconcino',
  'gocce',
  'sciroppo',
  'cerotto',
  'inalatore',
  'iniezione',
  'altro',
] as const;
export type MedicationForm = (typeof MEDICATION_FORMS)[number];

export type IfForgotten = 'asap' | 'skip' | 'ask';
export type MedicationStatus = 'active' | 'suspended' | 'archived';

/** Pittogrammi delle istruzioni (docs/08 § 8.4). */
export const INSTRUCTION_ICONS = [
  'digiuno',
  'pieno',
  'acqua',
  'sciogliere',
  'urinare',
  'non-masticare',
  'spezzare',
  'nessuno',
] as const;
export type InstructionIcon = (typeof INSTRUCTION_ICONS)[number];

export interface Instruction {
  icon: InstructionIcon;
  text: string;
}

export interface Medication {
  id: string;
  name: string;
  /** Parola che distingue farmaci simili (es. "RETARD"), evidenziata nell'interfaccia. */
  distinguishing?: string | null;
  form: MedicationForm;
  strength?: string | null;
  /** Colore della pastiglia disegnata quando manca la foto. */
  color: string;
  critical: boolean;
  ifForgotten: IfForgotten;
  status: MedicationStatus;
  instructions: Instruction[];
  photoUrl?: string | null;
  /** Unità in casa; null = non tracciata. */
  stock?: number | null;
}

export type Timing =
  | { kind: 'fixed'; time: Hhmm }
  | { kind: 'routine'; moment: MomentKey; offsetMin: number }
  | { kind: 'wake' }
  | { kind: 'asNeeded'; minIntervalMin?: number; maxPerDay?: number };

export type DaysSpec =
  | { kind: 'daily' }
  /** 0 = lunedì … 6 = domenica */
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'everyN'; n: number; anchor: DayKey }
  | { kind: 'cycle'; on: number; off: number; anchor: DayKey };

export interface Rule {
  id: string;
  medicationId: string;
  /** Quantità in unità della forma, con frazioni (0.25, 0.5, 1, 1.5, 2…). */
  quantity: number;
  timing: Timing;
  days: DaysSpec;
  startDate: DayKey;
  /** Ultimo giorno incluso. */
  endDate?: DayKey | null;
  /** Istruzioni valide solo per questa regola. */
  note?: string | null;
  active: boolean;
}

export type OverrideKind = 'suspend' | 'quantity' | 'time' | 'add' | 'once';

export interface RuleOverride {
  id: string;
  kind: OverrideKind;
  from: DayKey;
  /** Incluso. */
  to: DayKey;
  /** Bersaglio per suspend/quantity/time: una regola, un farmaco, oppure tutto il paziente. */
  target: { ruleId?: string; medicationId?: string; all?: boolean };
  quantity?: number;
  time?: Hhmm;
  /** Per add / once: il farmaco da aggiungere. */
  medicationId?: string;
  reason?: string | null;
  createdAt: number;
}

export type Routine = Record<MomentKey, Hhmm>;

export interface RoutineOverride {
  day: DayKey;
  moment: MomentKey;
  time: Hhmm;
}

export interface TherapyInput {
  tz: string;
  medications: Medication[];
  rules: Rule[];
  overrides: RuleOverride[];
  routine: Routine;
  routineOverrides: RoutineOverride[];
  /** Per ogni giorno, l'istante (UTC ms) in cui il paziente ha toccato "Buongiorno". */
  wakeAt?: Record<DayKey, number>;
}

export interface Dose {
  /** Chiave stabile: `${ruleId|overrideId}:${day}` */
  key: string;
  day: DayKey;
  ruleId: string | null;
  overrideId: string | null;
  medicationId: string;
  quantity: number;
  /** UTC ms */
  scheduledAt: number;
  localTime: Hhmm;
  critical: boolean;
  ifForgotten: IfForgotten;
  /** Testo discreto da mostrare sulla dose ("cambiata fino a ven 13"). */
  changeNote?: string | null;
  asNeeded?: boolean;
}

export type DoseEventType = 'taken' | 'not_taken' | 'snoozed' | 'undo' | 'notified';

export interface DoseEvent {
  /** UUID generato dal dispositivo: rende l'invio idempotente (docs/04 § 4.6). */
  id: string;
  doseKey: string;
  type: DoseEventType;
  /** Ora reale in cui è successo (UTC ms). */
  at: number;
  /** Per snoozed: fino a quando. Per taken: ora dichiarata se diversa. */
  until?: number;
  reason?: string | null;
  actor?: string | null;
  device?: string | null;
}

export type DoseStatus = 'scheduled' | 'due' | 'snoozed' | 'taken' | 'not_taken' | 'missed';

export interface DoseState {
  status: DoseStatus;
  takenAt?: number;
  lateMin?: number;
  snoozeUntil?: number;
  snoozeCount: number;
  /** Due dichiarazioni umane in contrasto: il caregiver deve verificare. */
  conflict: boolean;
  reason?: string | null;
  /** Ultima presa/annullo: serve per mostrare "Annulla" per 10 secondi. */
  lastActionAt?: number;
  /** Vero se la presa è avvenuta prima dell'ora prevista. */
  early?: boolean;
}

export interface ReminderConfig {
  /** Ripetizione del suono: ogni X minuti per i primi 15, poi ogni Y. */
  repeatEveryMin: number;
  repeatLaterEveryMin: number;
  repeatPhaseMin: number;
  snoozeMin: number;
  maxSnoozes: number;
  /** Minuti dopo i quali si avvisa il primo caregiver. */
  firstAlertMin: number;
  /** Minuti dopo i quali si passa al caregiver successivo se nessuno prende in carico. */
  nextCaregiverMin: number;
  /** Minuti dopo i quali la dose diventa "mancata". */
  missedAfterMin: number;
  /** Conferma in anticipo consentita fino a X minuti prima. */
  earlyWindowMin: number;
  /** Margine prima della dose successiva dello stesso farmaco oltre il quale scatta "mancata". */
  missedBeforeNextMin: number;
}

export interface PatientSettings {
  tz: string;
  groupWindowMin: number;
  /** Disattiva l'antirimbalzo: valore in ms (300–2000). */
  debounceMs: number;
  holdToConfirm: boolean;
  undoSeconds: number;
  textLevel: 'grande' | 'moltoGrande' | 'enorme';
  reminder: { normal: ReminderConfig; critical: ReminderConfig };
}
