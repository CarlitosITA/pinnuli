import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { INSTRUCTION_ICONS, MEDICATION_FORMS, MOMENTS, addDays, localToUtc, patientDay, type Hhmm } from '@pinnuli/core';
import { audit } from './audit';
import { schema, type Db } from './db/client';
import { notify } from './hub';
import { newId, newPairingCode, newToken, sha256 } from './security';
import { bumpAndNotify, getPatient, recordEvents, syncDoses } from './therapy';

const { medications, rules, ruleOverrides, routineOverrides, patients, devices, alerts } = schema;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Orario non valido (HH:MM)');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida');

export const timingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), time: hhmm }),
  z.object({ kind: z.literal('routine'), moment: z.enum(MOMENTS), offsetMin: z.number().int().min(-240).max(240) }),
  z.object({ kind: z.literal('wake') }),
  z.object({ kind: z.literal('asNeeded'), minIntervalMin: z.number().int().optional(), maxPerDay: z.number().int().optional() }),
]);

export const daysSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }),
  z.object({ kind: z.literal('weekdays'), days: z.array(z.number().int().min(0).max(6)).min(1) }),
  z.object({ kind: z.literal('everyN'), n: z.number().int().min(2).max(30), anchor: day }),
  z.object({ kind: z.literal('cycle'), on: z.number().int().min(1).max(90), off: z.number().int().min(1).max(90), anchor: day }),
]);

const quantity = z.number().min(0.25).max(20);

export const ruleInput = z.object({
  quantity,
  timing: timingSchema,
  days: daysSchema.default({ kind: 'daily' }),
  startDate: day.optional(),
  endDate: day.nullish(),
  note: z.string().max(200).nullish(),
});
export type RuleInput = z.infer<typeof ruleInput>;

export const medicationInput = z.object({
  name: z.string().trim().min(1, 'Scrivi il nome del farmaco').max(80),
  distinguishing: z.string().trim().max(30).nullish(),
  form: z.enum(MEDICATION_FORMS).default('compressa'),
  strength: z.string().trim().max(60).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#F2D36B'),
  critical: z.boolean().default(false),
  ifForgotten: z.enum(['asap', 'skip', 'ask']).default('ask'),
  instructions: z
    .array(z.object({ icon: z.enum(INSTRUCTION_ICONS), text: z.string().trim().min(1).max(120) }))
    .max(4)
    .default([]),
});
export type MedicationInput = z.infer<typeof medicationInput>;

export const overrideInput = z
  .object({
    kind: z.enum(['suspend', 'quantity', 'time', 'add', 'once']),
    from: day,
    to: day,
    target: z.object({ ruleId: z.string().optional(), medicationId: z.string().optional(), all: z.boolean().optional() }).default({}),
    quantity: quantity.optional(),
    time: hhmm.optional(),
    medicationId: z.string().optional(),
    reason: z.string().max(200).nullish(),
  })
  .refine((o) => o.to >= o.from, { message: 'La data di fine è prima di quella di inizio', path: ['to'] })
  .refine((o) => o.kind !== 'quantity' || o.quantity != null, { message: 'Scegli la quantità', path: ['quantity'] })
  .refine((o) => !['time', 'add', 'once'].includes(o.kind) || !!o.time, { message: "Scegli l'orario", path: ['time'] })
  .refine((o) => !['add', 'once'].includes(o.kind) || !!o.medicationId, { message: 'Scegli il farmaco', path: ['medicationId'] })
  .refine((o) => !['suspend', 'quantity', 'time'].includes(o.kind) || o.target.all || o.target.ruleId || o.target.medicationId, {
    message: 'Scegli che cosa cambiare',
    path: ['target'],
  });
export type OverrideInput = z.infer<typeof overrideInput>;

export class CommandError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function after(db: Db, patientId: string, now: number) {
  await syncDoses(db, patientId, now);
  await bumpAndNotify(db, patientId, 'plan');
}

async function ownMedication(db: Db, patientId: string, id: string) {
  const [m] = await db.select().from(medications).where(and(eq(medications.id, id), eq(medications.patientId, patientId)));
  if (!m) throw new CommandError('Farmaco non trovato', 404);
  return m;
}

export async function createMedication(
  db: Db,
  patientId: string,
  actor: string,
  input: { medication: MedicationInput; rules: RuleInput[] },
  now = Date.now(),
) {
  const patient = await getPatient(db, patientId);
  if (!patient) throw new CommandError('Paziente non trovato', 404);
  const today = patientDay(now, patient.tz);
  const id = newId();
  const m = input.medication;
  await db.insert(medications).values({
    id,
    patientId,
    name: m.name,
    distinguishing: m.distinguishing ?? null,
    form: m.form,
    strength: m.strength ?? null,
    color: m.color,
    critical: m.critical,
    ifForgotten: m.ifForgotten,
    instructions: m.instructions,
  });
  const ruleIds: string[] = [];
  for (const r of input.rules) ruleIds.push(await insertRule(db, patientId, id, r, today));
  await audit(db, { patientId, actor, action: 'create', entity: 'medication', entityId: id, after: input }, now);
  await after(db, patientId, now);
  return { id, ruleIds };
}

async function insertRule(db: Db, patientId: string, medicationId: string, r: RuleInput, today: string) {
  const id = newId();
  await db.insert(rules).values({
    id,
    patientId,
    medicationId,
    quantity: r.quantity,
    timing: r.timing,
    days: r.days,
    startDate: r.startDate ?? today,
    endDate: r.endDate ?? null,
    note: r.note ?? null,
    active: true,
  });
  return id;
}

export async function updateMedication(
  db: Db,
  patientId: string,
  id: string,
  actor: string,
  patch: Partial<MedicationInput> & { status?: 'active' | 'suspended' | 'archived' },
  now = Date.now(),
) {
  const before = await ownMedication(db, patientId, id);
  const set: Partial<typeof medications.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.distinguishing !== undefined) set.distinguishing = patch.distinguishing ?? null;
  if (patch.form !== undefined) set.form = patch.form;
  if (patch.strength !== undefined) set.strength = patch.strength ?? null;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.critical !== undefined) set.critical = patch.critical;
  if (patch.ifForgotten !== undefined) set.ifForgotten = patch.ifForgotten;
  if (patch.instructions !== undefined) set.instructions = patch.instructions;
  if (patch.status !== undefined) set.status = patch.status;
  if (Object.keys(set).length === 0) return;
  await db.update(medications).set(set).where(eq(medications.id, id));
  await audit(db, { patientId, actor, action: 'update', entity: 'medication', entityId: id, before, after: set }, now);
  await after(db, patientId, now);
}

export async function addRule(db: Db, patientId: string, medicationId: string, actor: string, input: RuleInput, now = Date.now()) {
  await ownMedication(db, patientId, medicationId);
  const patient = await getPatient(db, patientId);
  const id = await insertRule(db, patientId, medicationId, input, patientDay(now, patient!.tz));
  await audit(db, { patientId, actor, action: 'create', entity: 'rule', entityId: id, after: input }, now);
  await after(db, patientId, now);
  return id;
}

export async function updateRule(db: Db, patientId: string, ruleId: string, actor: string, patch: Partial<RuleInput> & { active?: boolean }, now = Date.now()) {
  const [before] = await db.select().from(rules).where(and(eq(rules.id, ruleId), eq(rules.patientId, patientId)));
  if (!before) throw new CommandError('Regola non trovata', 404);
  const set: Partial<typeof rules.$inferInsert> = {};
  if (patch.quantity !== undefined) set.quantity = patch.quantity;
  if (patch.timing !== undefined) set.timing = patch.timing;
  if (patch.days !== undefined) set.days = patch.days;
  if (patch.startDate !== undefined) set.startDate = patch.startDate;
  if (patch.endDate !== undefined) set.endDate = patch.endDate ?? null;
  if (patch.note !== undefined) set.note = patch.note ?? null;
  if (patch.active !== undefined) set.active = patch.active;
  await db.update(rules).set(set).where(eq(rules.id, ruleId));
  await audit(db, { patientId, actor, action: 'update', entity: 'rule', entityId: ruleId, before, after: set }, now);
  await after(db, patientId, now);
}

/** Una regola non si cancella: si disattiva, così lo storico delle dosi passate resta leggibile. */
export async function deactivateRule(db: Db, patientId: string, ruleId: string, actor: string, now = Date.now()) {
  await updateRule(db, patientId, ruleId, actor, { active: false }, now);
}

export async function createOverride(db: Db, patientId: string, actor: string, input: OverrideInput, now = Date.now()) {
  if (input.target.medicationId) await ownMedication(db, patientId, input.target.medicationId);
  if (input.medicationId) await ownMedication(db, patientId, input.medicationId);
  if (input.target.ruleId) {
    const [r] = await db.select({ id: rules.id }).from(rules).where(and(eq(rules.id, input.target.ruleId), eq(rules.patientId, patientId)));
    if (!r) throw new CommandError('Regola non trovata', 404);
  }
  const id = newId();
  await db.insert(ruleOverrides).values({
    id,
    patientId,
    kind: input.kind,
    fromDay: input.from,
    toDay: input.kind === 'once' ? input.from : input.to,
    target: input.target,
    quantity: input.quantity ?? null,
    time: input.time ?? null,
    medicationId: input.medicationId ?? null,
    reason: input.reason ?? null,
    authorId: actor,
    createdAtMs: now,
  });
  await audit(db, { patientId, actor, action: 'create', entity: 'override', entityId: id, after: input }, now);
  await after(db, patientId, now);
  return id;
}

export async function deleteOverride(db: Db, patientId: string, id: string, actor: string, now = Date.now()) {
  const [before] = await db.select().from(ruleOverrides).where(and(eq(ruleOverrides.id, id), eq(ruleOverrides.patientId, patientId)));
  if (!before) throw new CommandError('Variazione non trovata', 404);
  await db.delete(ruleOverrides).where(eq(ruleOverrides.id, id));
  await audit(db, { patientId, actor, action: 'delete', entity: 'override', entityId: id, before }, now);
  await after(db, patientId, now);
}

/** "Oggi si pranza alle 14": sposta un momento solo per oggi, e le dosi agganciate si spostano con lui. */
export async function setRoutineOverride(
  db: Db,
  patientId: string,
  actor: string,
  input: { day: string; moment: (typeof MOMENTS)[number]; time: string | null },
  now = Date.now(),
) {
  if (input.time === null) {
    await db
      .delete(routineOverrides)
      .where(and(eq(routineOverrides.patientId, patientId), eq(routineOverrides.day, input.day), eq(routineOverrides.moment, input.moment)));
  } else {
    await db
      .insert(routineOverrides)
      .values({ patientId, day: input.day, moment: input.moment, time: input.time })
      .onConflictDoUpdate({ target: [routineOverrides.patientId, routineOverrides.day, routineOverrides.moment], set: { time: input.time } });
  }
  await audit(db, { patientId, actor, action: 'set', entity: 'routine_override', after: input }, now);
  await after(db, patientId, now);
}

export const patientPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  routine: z.record(z.enum(MOMENTS), hhmm).optional(),
  paused: z.boolean().optional(),
  pin: z.string().regex(/^\d{4}$/, 'Il PIN è di 4 cifre').optional(),
  settings: z
    .object({
      debounceMs: z.number().int().min(300).max(2000).optional(),
      holdToConfirm: z.boolean().optional(),
      textLevel: z.enum(['grande', 'moltoGrande', 'enorme']).optional(),
      groupWindowMin: z.number().int().min(0).max(30).optional(),
    })
    .optional(),
});
export type PatientPatch = z.infer<typeof patientPatch>;

export async function updatePatient(db: Db, patientId: string, actor: string, patch: PatientPatch, now = Date.now()) {
  const p = await getPatient(db, patientId);
  if (!p) throw new CommandError('Paziente non trovato', 404);
  const set: Partial<typeof patients.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.paused !== undefined) set.paused = patch.paused;
  if (patch.pin !== undefined) set.pin = patch.pin;
  if (patch.routine) set.routine = { ...p.routine, ...patch.routine };
  if (patch.settings) set.settings = { ...p.settings, ...patch.settings };
  if (Object.keys(set).length === 0) return;
  await db.update(patients).set(set).where(eq(patients.id, patientId));
  const { pin: _pin, ...safe } = set;
  void _pin;
  await audit(db, { patientId, actor, action: 'update', entity: 'patient', entityId: patientId, before: { name: p.name, paused: p.paused, routine: p.routine, settings: p.settings }, after: safe }, now);
  await after(db, patientId, now);
}

// ───────── Dispositivi ─────────

const PAIRING_MINUTES = 30;

export async function startPairing(db: Db, kind: 'tablet' | 'phone' = 'tablet', now = Date.now()) {
  const secret = newToken();
  let code = newPairingCode();
  for (let i = 0; i < 5; i++) {
    const [clash] = await db.select({ id: devices.id }).from(devices).where(and(eq(devices.pairingCode, code), eq(devices.status, 'pending')));
    if (!clash) break;
    code = newPairingCode();
  }
  const id = newId();
  await db.insert(devices).values({
    id,
    kind,
    status: 'pending',
    pairingCode: code,
    pairingExpiresMs: now + PAIRING_MINUTES * 60_000,
    pollSecretHash: sha256(secret),
  });
  return { deviceId: id, code, secret, expiresMs: now + PAIRING_MINUTES * 60_000 };
}

export async function claimDevice(
  db: Db,
  patientId: string,
  actor: string,
  input: { code: string; name?: string; kind?: 'tablet' | 'phone' },
  now = Date.now(),
) {
  const code = input.code.replace(/\s+/g, '');
  const [d] = await db.select().from(devices).where(and(eq(devices.pairingCode, code), eq(devices.status, 'pending')));
  if (!d || (d.pairingExpiresMs ?? 0) < now) throw new CommandError('Codice non valido o scaduto. Controlla le cifre sullo schermo del tablet.', 404);
  const token = newToken();
  await db
    .update(devices)
    .set({
      patientId,
      status: 'active',
      name: input.name?.trim() || (d.kind === 'phone' ? 'Telefono' : 'Tablet'),
      kind: input.kind ?? d.kind,
      tokenHash: sha256(token),
      handoffToken: token,
      pairingCode: null,
      lastSeenMs: now,
    })
    .where(eq(devices.id, d.id));
  await audit(db, { patientId, actor, action: 'pair', entity: 'device', entityId: d.id }, now);
  await notify(patientId, 'device');
  return d.id;
}

export async function revokeDevice(db: Db, patientId: string, id: string, actor: string, now = Date.now()) {
  const res = await db
    .update(devices)
    .set({ status: 'revoked', tokenHash: null, handoffToken: null })
    .where(and(eq(devices.id, id), eq(devices.patientId, patientId)))
    .returning({ id: devices.id });
  if (!res.length) throw new CommandError('Dispositivo non trovato', 404);
  await audit(db, { patientId, actor, action: 'revoke', entity: 'device', entityId: id }, now);
  await notify(patientId, 'device');
}

// ───────── Dosi e allerte dal familiare ─────────

export async function caregiverDoseAction(
  db: Db,
  patientId: string,
  actor: string,
  input: { doseKey: string; type: 'taken' | 'not_taken' | 'undo'; reason?: string | null; at?: number; time?: string },
  now = Date.now(),
) {
  let when = input.at;
  if (input.time) {
    // «L'ha presa alle 08:40»: l'ora vera, non quella in cui il familiare se ne accorge.
    if (input.type !== 'taken') throw new CommandError('L’ora si può indicare solo per una dose presa', 400);
    const [dose] = await db.select().from(schema.doses).where(and(eq(schema.doses.key, input.doseKey), eq(schema.doses.patientId, patientId)));
    if (!dose) throw new CommandError('Dose non trovata', 404);
    const [patient] = await db.select({ tz: schema.patients.tz }).from(schema.patients).where(eq(schema.patients.id, patientId));
    const tz = patient?.tz ?? 'Europe/Rome';
    when = localToUtc(dose.day, input.time as Hhmm, tz);
    // Dopo la mezzanotte (la giornata finisce alle 04:00): «00:30» per una dose delle 23:00 è la notte dopo.
    if (when < dose.scheduledAt - 3 * 3600_000) when = localToUtc(addDays(dose.day, 1), input.time as Hhmm, tz);
    if (when > now) throw new CommandError('Quest’ora non è ancora arrivata', 400);
    // Le risposte si ordinano per ora reale: una risposta più recente coprirebbe questa. Solo per dosi ancora senza risposta.
    const earlier = await db.select({ type: schema.doseEvents.type, at: schema.doseEvents.atMs }).from(schema.doseEvents).where(eq(schema.doseEvents.doseKey, input.doseKey));
    if (earlier.some((e) => (e.type === 'taken' || e.type === 'not_taken' || e.type === 'undo') && e.at >= when!)) {
      throw new CommandError('Questa dose ha già una risposta più recente: l’ora non si può cambiare.', 409);
    }
  }
  const at = Math.min(when ?? now, now);
  const res = await recordEvents(db, patientId, [{ id: newId(), type: input.type, doseKey: input.doseKey, at, reason: input.reason ?? null }], actor, now);
  if (!res.accepted.length) throw new CommandError('Dose non trovata', 404);
  await resolveAlertsForResolvedDoses(db, patientId, now);
  await audit(db, { patientId, actor, action: input.type, entity: 'dose', entityId: input.doseKey, after: { reason: input.reason ?? null, time: input.time ?? null } }, now);
}

/** "Me ne occupo io": ferma la catena di escalation per quella dose (docs/04 § 4.4). */
export async function takeOverAlert(db: Db, patientId: string, alertId: string, userId: string, now = Date.now()) {
  const [a] = await db.select().from(alerts).where(and(eq(alerts.id, alertId), eq(alerts.patientId, patientId)));
  if (!a) throw new CommandError('Allerta non trovata', 404);
  const siblings = a.doseKey ? await db.select({ id: alerts.id }).from(alerts).where(and(eq(alerts.patientId, patientId), eq(alerts.doseKey, a.doseKey))) : [{ id: a.id }];
  await db
    .update(alerts)
    .set({ takenOverBy: userId })
    .where(inArray(alerts.id, siblings.map((s) => s.id)));
  await audit(db, { patientId, actor: `user:${userId}`, action: 'takeover', entity: 'alert', entityId: alertId }, now);
  await notify(patientId, 'alert');
}

/** Quando una dose viene confermata, da chiunque, le allerte collegate si risolvono. */
export async function resolveAlertsForResolvedDoses(db: Db, patientId: string, now = Date.now()) {
  const open = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.patientId, patientId), eq(alerts.status, 'open'), eq(alerts.kind, 'dose-not-confirmed')));
  if (!open.length) return [];
  const keys = [...new Set(open.map((a) => a.doseKey).filter((k): k is string => !!k))];
  if (!keys.length) return [];
  const events = await db.select().from(schema.doseEvents).where(inArray(schema.doseEvents.doseKey, keys));
  const resolved: string[] = [];
  for (const k of keys) {
    const mine = events.filter((e) => e.doseKey === k).sort((a, b) => a.atMs - b.atMs);
    let last: string | null = null;
    for (const e of mine) {
      if (e.type === 'taken' || e.type === 'not_taken') last = e.type;
      else if (e.type === 'undo') last = null;
    }
    if (last) resolved.push(k);
  }
  if (!resolved.length) return [];
  await db
    .update(alerts)
    .set({ status: 'resolved', resolvedAtMs: now })
    .where(and(eq(alerts.patientId, patientId), inArray(alerts.doseKey, resolved), eq(alerts.status, 'open')));
  await notify(patientId, 'alert');
  return resolved;
}

