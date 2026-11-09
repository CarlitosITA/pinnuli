import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { DaysSpec, Instruction, PatientSettings, Routine, Timing } from '@pinnuli/core';

/** Istanti (UTC, millisecondi) come bigint: si scambiano con il motore delle regole senza conversioni. */
const ms = (name: string) => bigint(name, { mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`);

export const circles = pgTable('circles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const memberships = pgTable(
  'memberships',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('admin'), // admin | caregiver
    /** Posizione nella catena di escalation (0 = primo). */
    chainPosition: integer('chain_position').notNull().default(0),
    telegramChatId: text('telegram_chat_id'),
    telegramLinkCode: text('telegram_link_code'),
    /** Ore di silenzio, ora locale "HH:MM" (docs/04 § 4.4). */
    quietFrom: text('quiet_from'),
    quietTo: text('quiet_to'),
    /** Non mostrare il nome del farmaco nelle anteprime (privacy sullo schermo bloccato). */
    discreet: boolean('discreet').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.circleId] })],
);

/** Invito per un nuovo familiare: si consegna un link da usare una volta sola (se ne conserva solo l'impronta). */
export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    /** Come lo chiama chi invita, per riconoscerlo nell'elenco (es. «Maria»). */
    label: text('label').notNull(),
    createdBy: text('created_by').notNull(),
    createdAtMs: ms('created_at_ms').notNull(),
    expiresAtMs: ms('expires_at_ms').notNull(),
    usedAtMs: ms('used_at_ms'),
  },
  (t) => [uniqueIndex('invites_token_idx').on(t.tokenHash)],
);

export const patients = pgTable('patients', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tz: text('tz').notNull().default('Europe/Rome'),
  routine: jsonb('routine').$type<Routine>().notNull(),
  settings: jsonb('settings').$type<PatientSettings>().notNull(),
  /** PIN a 4 cifre per le impostazioni nascoste del tablet. */
  pin: text('pin').notNull().default('0000'),
  /** Pausa totale (ricovero, viaggio): nessuna dose, nessuna allerta. */
  paused: boolean('paused').notNull().default(false),
  /** Cambia a ogni modifica: i dispositivi lo usano per sapere se riscaricare il piano. */
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
});

export const medications = pgTable(
  'medications',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    distinguishing: text('distinguishing'),
    form: text('form').notNull().default('compressa'),
    strength: text('strength'),
    color: text('color').notNull().default('#F2D36B'),
    critical: boolean('critical').notNull().default(false),
    ifForgotten: text('if_forgotten').notNull().default('ask'),
    status: text('status').notNull().default('active'), // active | suspended | archived
    instructions: jsonb('instructions').$type<Instruction[]>().notNull().default([]),
    photoUrl: text('photo_url'),
    stock: integer('stock'),
    createdAt: createdAt(),
  },
  (t) => [index('medications_patient_idx').on(t.patientId)],
);

export const rules = pgTable(
  'rules',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    medicationId: text('medication_id').notNull().references(() => medications.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 6, scale: 2, mode: 'number' }).notNull().default(1),
    timing: jsonb('timing').$type<Timing>().notNull(),
    days: jsonb('days').$type<DaysSpec>().notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    note: text('note'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('rules_patient_idx').on(t.patientId)],
);

export const ruleOverrides = pgTable(
  'rule_overrides',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // suspend | quantity | time | add | once
    fromDay: text('from_day').notNull(),
    toDay: text('to_day').notNull(),
    target: jsonb('target').$type<{ ruleId?: string; medicationId?: string; all?: boolean }>().notNull(),
    quantity: numeric('quantity', { precision: 6, scale: 2, mode: 'number' }),
    time: text('time'),
    medicationId: text('medication_id'),
    reason: text('reason'),
    authorId: text('author_id'),
    createdAtMs: ms('created_at_ms').notNull(),
  },
  (t) => [index('rule_overrides_patient_idx').on(t.patientId)],
);

export const routineOverrides = pgTable(
  'routine_overrides',
  {
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    moment: text('moment').notNull(),
    time: text('time').notNull(),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.day, t.moment] })],
);

/** "Buongiorno" toccato sul tablet: la dose al risveglio scatta da qui. */
export const wakeEvents = pgTable(
  'wake_events',
  {
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    atMs: ms('at_ms').notNull(),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.day] })],
);

/**
 * Le dosi sono generate dalle regole e conservate: una modifica alla terapia vale da adesso in avanti,
 * le dosi passate non vengono mai riscritte (docs/02 § 2.5).
 */
export const doses = pgTable(
  'doses',
  {
    key: text('key').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    ruleId: text('rule_id'),
    overrideId: text('override_id'),
    medicationId: text('medication_id').notNull(),
    quantity: numeric('quantity', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    scheduledAt: ms('scheduled_at').notNull(),
    localTime: text('local_time').notNull(),
    critical: boolean('critical').notNull().default(false),
    ifForgotten: text('if_forgotten').notNull().default('ask'),
    changeNote: text('change_note'),
    note: text('note'),
  },
  (t) => [index('doses_patient_time_idx').on(t.patientId, t.scheduledAt)],
);

export const doseEvents = pgTable(
  'dose_events',
  {
    /** Generato dal dispositivo: l'invio ripetuto non fa danni. */
    id: text('id').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    doseKey: text('dose_key').notNull(),
    type: text('type').notNull(), // taken | not_taken | snoozed | undo | notified
    atMs: ms('at_ms').notNull(),
    untilMs: ms('until_ms'),
    reason: text('reason'),
    actor: text('actor'), // device:<id> | user:<id> | telegram:<id>
    receivedAtMs: ms('received_at_ms').notNull(),
  },
  (t) => [index('dose_events_dose_idx').on(t.doseKey), index('dose_events_patient_idx').on(t.patientId, t.atMs)],
);

export const devices = pgTable(
  'devices',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('tablet'), // tablet | phone
    name: text('name').notNull().default('Tablet'),
    status: text('status').notNull().default('pending'), // pending | active | revoked
    /** Codice a 6 cifre mostrato sul dispositivo in attesa di collegamento. */
    pairingCode: text('pairing_code'),
    pairingExpiresMs: ms('pairing_expires_ms'),
    /** Segreto con cui il dispositivo in attesa chiede se è stato collegato (hash). */
    pollSecretHash: text('poll_secret_hash'),
    tokenHash: text('token_hash'),
    /** Token in consegna al dispositivo: si cancella alla prima lettura. */
    handoffToken: text('handoff_token'),
    lastSeenMs: ms('last_seen_ms'),
    battery: integer('battery'),
    charging: boolean('charging'),
    audioOk: boolean('audio_ok'),
    version: text('version'),
    clockSkewMs: ms('clock_skew_ms'),
    createdAt: createdAt(),
  },
  (t) => [index('devices_patient_idx').on(t.patientId), index('devices_code_idx').on(t.pairingCode)],
);

export const alerts = pgTable(
  'alerts',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    /** dose-not-confirmed | device-offline | battery */
    kind: text('kind').notNull(),
    doseKey: text('dose_key'),
    deviceId: text('device_id'),
    /** Indice del caregiver nella catena. */
    step: integer('step').notNull().default(0),
    recipientUserId: text('recipient_user_id'),
    status: text('status').notNull().default('open'), // open | resolved
    takenOverBy: text('taken_over_by'),
    message: text('message').notNull().default(''),
    createdAtMs: ms('created_at_ms').notNull(),
    resolvedAtMs: ms('resolved_at_ms'),
    deliveredVia: text('delivered_via'),
  },
  (t) => [index('alerts_patient_idx').on(t.patientId, t.status)],
);

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  atMs: ms('at_ms').notNull(),
  patientId: text('patient_id'),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
});

/** Iscrizione alle notifiche push di un dispositivo (telefono o tablet). Un dispositivo può rinnovarla. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAtMs: ms('created_at_ms').notNull(),
    lastOkMs: ms('last_ok_ms'),
    failures: integer('failures').notNull().default(0),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint), index('push_subscriptions_device_idx').on(t.deviceId)],
);

/** Quante notifiche sono già partite per ogni promemoria e a chi: evita doppioni e fissa le ripetizioni. */
export const pushLog = pgTable(
  'push_log',
  {
    subscriptionId: text('subscription_id').notNull().references(() => pushSubscriptions.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull(),
    count: integer('count').notNull().default(0),
    lastSentMs: ms('last_sent_ms').notNull(),
    /** Il promemoria è finito e la notifica è stata sostituita con «Segnata». */
    closed: boolean('closed').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.groupId] })],
);
