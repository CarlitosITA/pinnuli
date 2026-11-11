import { and, between, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  addDays,
  asGender,
  type Gender,
  generateDoses,
  patientDay,
  type Dose,
  type DoseEvent,
  type Medication,
  type PatientSettings,
  type Rule,
  type RuleOverride,
  type TherapyInput,
} from '@pinnuli/core';
import { notify } from './hub';
import { schema, type Db } from './db/client';

const { medications, rules, ruleOverrides, routineOverrides, wakeEvents, doses, doseEvents, patients } = schema;

export type PatientRow = typeof patients.$inferSelect;

export async function getPatient(db: Db, patientId: string): Promise<PatientRow | undefined> {
  const [p] = await db.select().from(patients).where(eq(patients.id, patientId));
  return p;
}

function toMedication(r: typeof medications.$inferSelect): Medication {
  return {
    id: r.id,
    name: r.name,
    distinguishing: r.distinguishing,
    form: r.form as Medication['form'],
    strength: r.strength,
    color: r.color,
    critical: r.critical,
    ifForgotten: r.ifForgotten as Medication['ifForgotten'],
    status: r.status as Medication['status'],
    instructions: r.instructions,
    photoUrl: r.photoUrl,
    stock: r.stock,
  };
}

function toRule(r: typeof rules.$inferSelect): Rule {
  return {
    id: r.id,
    medicationId: r.medicationId,
    quantity: r.quantity,
    timing: r.timing,
    days: r.days,
    startDate: r.startDate,
    endDate: r.endDate,
    note: r.note,
    active: r.active,
  };
}

function toOverride(r: typeof ruleOverrides.$inferSelect): RuleOverride {
  return {
    id: r.id,
    kind: r.kind as RuleOverride['kind'],
    from: r.fromDay,
    to: r.toDay,
    target: r.target,
    quantity: r.quantity ?? undefined,
    time: r.time ?? undefined,
    medicationId: r.medicationId ?? undefined,
    reason: r.reason,
    createdAt: r.createdAtMs,
  };
}

export async function loadTherapy(db: Db, patient: PatientRow, now: number): Promise<TherapyInput> {
  const today = patientDay(now, patient.tz);
  const from = addDays(today, -2);
  const [meds, rls, ovs, rovs, wakes] = await Promise.all([
    db.select().from(medications).where(eq(medications.patientId, patient.id)),
    db.select().from(rules).where(eq(rules.patientId, patient.id)),
    db.select().from(ruleOverrides).where(eq(ruleOverrides.patientId, patient.id)),
    db.select().from(routineOverrides).where(eq(routineOverrides.patientId, patient.id)),
    db.select().from(wakeEvents).where(and(eq(wakeEvents.patientId, patient.id), gte(wakeEvents.day, from))),
  ]);
  return {
    tz: patient.tz,
    medications: meds.map(toMedication),
    rules: rls.map(toRule),
    overrides: ovs.map(toOverride),
    routine: patient.routine,
    routineOverrides: rovs.map((r) => ({ day: r.day, moment: r.moment as never, time: r.time })),
    wakeAt: Object.fromEntries(wakes.map((w) => [w.day, w.atMs])),
  };
}

const HORIZON_DAYS = 7;
/** Tolleranza per una dose appena aggiunta all'ora corrente: chi la inserisce alle 08:31 per le 08:30 la vuole. */
const NEW_DOSE_GRACE_MS = 10 * 60_000;

type DoseRow = typeof doses.$inferSelect;

function sameDose(row: DoseRow, d: Dose): boolean {
  return (
    row.scheduledAt === d.scheduledAt &&
    row.quantity === d.quantity &&
    row.localTime === d.localTime &&
    row.critical === d.critical &&
    row.ifForgotten === d.ifForgotten &&
    (row.changeNote ?? null) === (d.changeNote ?? null) &&
    (row.note ?? null) === (d.note ?? null) &&
    row.medicationId === d.medicationId
  );
}

/**
 * Allinea le dosi conservate con quelle che le regole producono adesso (docs/02 § 2.5):
 * - le dosi future si aggiungono, si aggiornano o si tolgono;
 * - le dosi già passate non si riscrivono mai: una modifica vale da adesso in avanti.
 * Restituisce true se qualcosa è cambiato.
 */
export async function syncDoses(db: Db, patientId: string, now = Date.now()): Promise<boolean> {
  const patient = await getPatient(db, patientId);
  if (!patient) return false;
  const today = patientDay(now, patient.tz);
  const from = addDays(today, -1);
  const to = addDays(today, HORIZON_DAYS);

  const input = await loadTherapy(db, patient, now);
  const generated = patient.paused ? [] : generateDoses(input, from, to);
  const genByKey = new Map(generated.map((d) => [d.key, d]));

  const existing = await db.select().from(doses).where(and(eq(doses.patientId, patientId), between(doses.day, from, to)));
  const existingByKey = new Map(existing.map((r) => [r.key, r]));
  const withEvents = new Set(
    (
      await db
        .selectDistinct({ k: doseEvents.doseKey })
        .from(doseEvents)
        .where(inArray(doseEvents.doseKey, existing.map((e) => e.key).concat('-')))
    ).map((r) => r.k),
  );
  const ruleTiming = new Map(input.rules.map((r) => [r.id, r.timing.kind]));

  let changed = false;
  const toInsert: (typeof doses.$inferInsert)[] = [];
  const toDelete: string[] = [];

  for (const g of generated) {
    const row = existingByKey.get(g.key);
    if (!row) {
      // Una dose nuova che è già passata da un pezzo non si crea: una regola nuova vale da adesso in avanti
      // (altrimenti, aggiungendo un farmaco alle 15, comparirebbero come "non prese" le dosi delle 8 e delle 12).
      if (g.scheduledAt < now - NEW_DOSE_GRACE_MS) continue;
      toInsert.push({
        key: g.key,
        patientId,
        day: g.day,
        ruleId: g.ruleId,
        overrideId: g.overrideId,
        medicationId: g.medicationId,
        quantity: g.quantity,
        scheduledAt: g.scheduledAt,
        localTime: g.localTime,
        critical: g.critical,
        ifForgotten: g.ifForgotten,
        changeNote: g.changeNote ?? null,
        note: g.note ?? null,
      });
      continue;
    }
    if (sameDose(row, g)) continue;
    const isWake = g.ruleId ? ruleTiming.get(g.ruleId) === 'wake' : false;
    const rewritable = row.day >= today && (row.scheduledAt > now || (isWake && !withEvents.has(row.key)));
    if (!rewritable) continue;
    await db
      .update(doses)
      .set({
        medicationId: g.medicationId,
        quantity: g.quantity,
        scheduledAt: g.scheduledAt,
        localTime: g.localTime,
        critical: g.critical,
        ifForgotten: g.ifForgotten,
        changeNote: g.changeNote ?? null,
        note: g.note ?? null,
      })
      .where(eq(doses.key, g.key));
    changed = true;
  }

  for (const row of existing) {
    if (genByKey.has(row.key)) continue;
    // Una dose che le regole non producono più si toglie solo se è futura e nessuno ci ha ancora toccato.
    if (row.scheduledAt > now && !withEvents.has(row.key)) toDelete.push(row.key);
  }

  if (toInsert.length) {
    await db.insert(doses).values(toInsert).onConflictDoNothing();
    changed = true;
  }
  if (toDelete.length) {
    await db.delete(doses).where(inArray(doses.key, toDelete));
    changed = true;
  }
  if (changed) await db.update(patients).set({ version: sql`${patients.version} + 1` }).where(eq(patients.id, patientId));
  return changed;
}

export function rowToDose(r: DoseRow): Dose {
  return {
    key: r.key,
    day: r.day,
    ruleId: r.ruleId,
    overrideId: r.overrideId,
    medicationId: r.medicationId,
    quantity: r.quantity,
    scheduledAt: r.scheduledAt,
    localTime: r.localTime,
    critical: r.critical,
    ifForgotten: r.ifForgotten as Dose['ifForgotten'],
    changeNote: r.changeNote,
    note: r.note,
  };
}

export function rowToEvent(r: typeof doseEvents.$inferSelect): DoseEvent {
  return {
    id: r.id,
    doseKey: r.doseKey,
    type: r.type as DoseEvent['type'],
    at: r.atMs,
    until: r.untilMs ?? undefined,
    reason: r.reason,
    actor: r.actor,
  };
}

export async function loadDosesBetween(db: Db, patientId: string, fromDay: string, toDay: string) {
  const rows = await db
    .select()
    .from(doses)
    .where(and(eq(doses.patientId, patientId), between(doses.day, fromDay, toDay)))
    .orderBy(doses.scheduledAt);
  return rows.map(rowToDose);
}

export async function loadEventsFor(db: Db, patientId: string, doseKeys: string[]): Promise<DoseEvent[]> {
  if (!doseKeys.length) return [];
  const rows = await db
    .select()
    .from(doseEvents)
    .where(and(eq(doseEvents.patientId, patientId), inArray(doseEvents.doseKey, doseKeys)));
  return rows.map(rowToEvent);
}

export interface Plan {
  serverNow: number;
  version: number;
  day: string;
  patient: { id: string; name: string; gender: Gender; tz: string; routine: PatientRow['routine']; settings: PatientSettings; paused: boolean };
  medications: Medication[];
  doses: Dose[];
  events: DoseEvent[];
  /** "Buongiorno": serve solo se c'è una dose legata al risveglio che oggi non è ancora partita. */
  wake: { needed: boolean; at: number | null };
  /** Nome del familiare da chiamare se il tablet non riesce a collegarsi. */
  contact: string | null;
  /** Genere di chi viene chiamato: serve a dire «è stata avvisata» o «è stato avvisato». */
  contactGender: Gender;
}

/** Piano per i dispositivi: ieri, oggi e i prossimi 3 giorni (≥ 72 ore), con gli eventi di quelle dosi. */
export async function buildPlan(db: Db, patientId: string, now = Date.now()): Promise<Plan | null> {
  const patient = await getPatient(db, patientId);
  if (!patient) return null;
  const today = patientDay(now, patient.tz);
  const [meds, ds] = await Promise.all([
    db.select().from(medications).where(eq(medications.patientId, patientId)),
    loadDosesBetween(db, patientId, addDays(today, -1), addDays(today, 3)),
  ]);
  const events = await loadEventsFor(db, patientId, ds.map((d) => d.key));
  const [wakeRow] = await db.select().from(wakeEvents).where(and(eq(wakeEvents.patientId, patientId), eq(wakeEvents.day, today)));
  const activeMeds = new Set(meds.filter((m) => m.status === 'active').map((m) => m.id));
  const wakeRules = await db.select().from(rules).where(and(eq(rules.patientId, patientId), eq(rules.active, true)));
  const wakeNeeded = wakeRules.some(
    (r) => r.timing.kind === 'wake' && activeMeds.has(r.medicationId) && r.startDate <= today && (!r.endDate || r.endDate >= today),
  );
  const [first] = await db
    .select({ name: schema.users.name, gender: schema.users.gender })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.circleId, patient.circleId))
    .orderBy(schema.memberships.chainPosition)
    .limit(1);
  return {
    serverNow: now,
    version: patient.version,
    day: today,
    patient: { id: patient.id, name: patient.name, gender: asGender(patient.gender), tz: patient.tz, routine: patient.routine, settings: patient.settings, paused: patient.paused },
    medications: meds.filter((m) => m.status !== 'archived').map(toMedication),
    doses: ds,
    events,
    wake: { needed: wakeNeeded && !patient.paused, at: wakeRow?.atMs ?? null },
    contact: first?.name ?? null,
    contactGender: asGender(first?.gender),
  };
}

export interface IncomingEvent {
  id: string;
  type: DoseEvent['type'] | 'wake';
  doseKey?: string;
  at: number;
  until?: number;
  reason?: string | null;
}

/**
 * Registra gli eventi arrivati da un dispositivo o da un familiare. Idempotente sull'id (docs/04 § 4.6):
 * inviare due volte lo stesso evento non fa danni. Restituisce gli id realmente nuovi.
 */
export async function recordEvents(
  db: Db,
  patientId: string,
  incoming: IncomingEvent[],
  actor: string,
  now = Date.now(),
): Promise<{ accepted: string[]; duplicates: string[] }> {
  const patient = await getPatient(db, patientId);
  if (!patient) return { accepted: [], duplicates: [] };
  const accepted: string[] = [];
  const duplicates: string[] = [];
  let needsSync = false;

  for (const e of incoming) {
    if (e.type === 'wake') {
      const day = patientDay(e.at, patient.tz);
      const res = await db
        .insert(wakeEvents)
        .values({ patientId, day, atMs: e.at })
        .onConflictDoNothing()
        .returning({ day: wakeEvents.day });
      (res.length ? accepted : duplicates).push(e.id);
      needsSync = needsSync || res.length > 0;
      continue;
    }
    if (!e.doseKey) continue;
    // Solo dosi di questo paziente: un dispositivo non può scrivere sulle dosi di altri.
    const [dose] = await db.select({ k: doses.key }).from(doses).where(and(eq(doses.key, e.doseKey), eq(doses.patientId, patientId)));
    if (!dose) {
      duplicates.push(e.id);
      continue;
    }
    const res = await db
      .insert(doseEvents)
      .values({
        id: e.id,
        patientId,
        doseKey: e.doseKey,
        type: e.type,
        atMs: Math.min(e.at, now + 60_000),
        untilMs: e.until ?? null,
        reason: e.reason ?? null,
        actor,
        receivedAtMs: now,
      })
      .onConflictDoNothing()
      .returning({ id: doseEvents.id });
    (res.length ? accepted : duplicates).push(e.id);
  }

  if (needsSync) await syncDoses(db, patientId, now);
  if (accepted.length) {
    await db.update(patients).set({ version: sql`${patients.version} + 1` }).where(eq(patients.id, patientId));
    await notify(patientId, 'plan');
  }
  return { accepted, duplicates };
}

export async function bumpAndNotify(db: Db, patientId: string, kind: 'plan' | 'alert' | 'device' | 'command' = 'plan') {
  await db.update(patients).set({ version: sql`${patients.version} + 1` }).where(eq(patients.id, patientId));
  await notify(patientId, kind);
}

