import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  addDays,
  buildViews,
  deviceHealth,
  groupDoses,
  patientDay,
  type DeviceHealth,
  type DoseStatus,
} from '@pinnuli/core';
import { schema, type Db } from './db/client';
import { loadDosesBetween, loadEventsFor, getPatient } from './therapy';

export type Light = 'ok' | 'attention' | 'alert';

export interface DoseCard {
  key: string;
  localTime: string;
  at: number;
  medication: { id: string; name: string; distinguishing: string | null; form: string; color: string; critical: boolean };
  quantity: number;
  status: DoseStatus;
  takenAt?: number;
  lateMin?: number;
  early?: boolean;
  conflict: boolean;
  reason?: string | null;
  changeNote: string | null;
}

export interface CaregiverState {
  now: number;
  day: string;
  patient: { id: string; name: string; paused: boolean };
  light: Light;
  lightText: string;
  groups: { id: string; localTime: string; doses: DoseCard[] }[];
  lastTaken: { name: string; at: number } | null;
  next: { name: string; localTime: string; at: number } | null;
  alerts: { id: string; kind: string; message: string; doseKey: string | null; createdAtMs: number; takenOverBy: string | null; takenOverByName: string | null }[];
  devices: {
    id: string;
    name: string;
    kind: string;
    lastSeenMs: number | null;
    battery: number | null;
    charging: boolean | null;
    audioOk: boolean | null;
    health: DeviceHealth;
  }[];
  counts: { total: number; taken: number; due: number; missed: number; upcoming: number };
}

export async function buildCaregiverState(db: Db, patientId: string, now = Date.now()): Promise<CaregiverState> {
  const patient = await getPatient(db, patientId);
  if (!patient) throw new Error('Paziente non trovato');
  const day = patientDay(now, patient.tz);
  const [meds, doses] = await Promise.all([
    db.select().from(schema.medications).where(eq(schema.medications.patientId, patientId)),
    loadDosesBetween(db, patientId, addDays(day, -1), addDays(day, 1)),
  ]);
  const events = await loadEventsFor(db, patientId, doses.map((d) => d.key));
  const medsForCore = meds.map((m) => ({
    id: m.id,
    name: m.name,
    distinguishing: m.distinguishing,
    form: m.form as never,
    strength: m.strength,
    color: m.color,
    critical: m.critical,
    ifForgotten: m.ifForgotten as never,
    status: m.status as never,
    instructions: m.instructions,
  }));
  const settings = patient.settings;
  const views = buildViews(doses, medsForCore, events, now, settings);
  const todayViews = views.filter((v) => v.dose.day === day);
  const groups = groupDoses(todayViews, settings.groupWindowMin, patient.tz);

  const toCard = (v: (typeof views)[number]): DoseCard => ({
    key: v.dose.key,
    localTime: v.dose.localTime,
    at: v.dose.scheduledAt,
    medication: {
      id: v.med.id,
      name: v.med.name,
      distinguishing: v.med.distinguishing ?? null,
      form: v.med.form,
      color: v.med.color,
      critical: v.med.critical,
    },
    quantity: v.dose.quantity,
    status: v.state.status,
    takenAt: v.state.takenAt,
    lateMin: v.state.lateMin,
    early: v.state.early,
    conflict: v.state.conflict,
    reason: v.state.reason,
    changeNote: v.dose.changeNote ?? null,
  });

  const cards = groups.map((g) => ({ id: g.id, localTime: g.localTime, doses: g.doses.map(toCard) }));
  const flat = cards.flatMap((g) => g.doses);
  const counts = {
    total: flat.length,
    taken: flat.filter((d) => d.status === 'taken').length,
    due: flat.filter((d) => d.status === 'due' || d.status === 'snoozed').length,
    missed: flat.filter((d) => d.status === 'missed').length,
    upcoming: flat.filter((d) => d.status === 'scheduled').length,
  };

  const taken = flat.filter((d) => d.status === 'taken' && d.takenAt).sort((a, b) => b.takenAt! - a.takenAt!)[0];
  const upcoming = flat.filter((d) => d.status === 'scheduled').sort((a, b) => a.at - b.at)[0];

  const openAlerts = await db
    .select()
    .from(schema.alerts)
    .where(and(eq(schema.alerts.patientId, patientId), eq(schema.alerts.status, 'open')))
    .orderBy(desc(schema.alerts.createdAtMs));
  const owners = openAlerts.map((a) => a.takenOverBy).filter((x): x is string => !!x);
  const ownerRows = owners.length ? await db.select().from(schema.users).where(inArray(schema.users.id, owners)) : [];
  const ownerName = new Map(ownerRows.map((u) => [u.id, u.name]));

  const devs = await db
    .select()
    .from(schema.devices)
    .where(and(eq(schema.devices.patientId, patientId), eq(schema.devices.status, 'active')));

  let light: Light = 'ok';
  let lightText = 'Tutto in regola';
  if (patient.paused) {
    lightText = 'In pausa: nessun promemoria';
  } else if (openAlerts.length || counts.missed) {
    light = 'alert';
    lightText = counts.missed && !openAlerts.length ? 'Una dose senza risposta' : 'C’è un avviso da guardare';
  } else if (counts.due) {
    light = 'attention';
    lightText = counts.due === 1 ? 'Una dose da confermare' : `${counts.due} dosi da confermare`;
  }

  return {
    now,
    day,
    patient: { id: patient.id, name: patient.name, paused: patient.paused },
    light,
    lightText,
    groups: cards,
    lastTaken: taken ? { name: taken.medication.name, at: taken.takenAt! } : null,
    next: upcoming ? { name: upcoming.medication.name, localTime: upcoming.localTime, at: upcoming.at } : null,
    alerts: openAlerts.map((a) => ({
      id: a.id,
      kind: a.kind,
      message: a.message,
      doseKey: a.doseKey,
      createdAtMs: a.createdAtMs,
      takenOverBy: a.takenOverBy,
      takenOverByName: a.takenOverBy ? (ownerName.get(a.takenOverBy) ?? null) : null,
    })),
    devices: devs.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind,
      lastSeenMs: d.lastSeenMs,
      battery: d.battery,
      charging: d.charging,
      audioOk: d.audioOk,
      health: deviceHealth(d.lastSeenMs, now),
    })),
    counts,
  };
}

// ───────── Terapia ─────────

export async function buildTherapyView(db: Db, patientId: string, now = Date.now()) {
  const patient = await getPatient(db, patientId);
  if (!patient) throw new Error('Paziente non trovato');
  const today = patientDay(now, patient.tz);
  const [meds, rls, ovs, rovs] = await Promise.all([
    db.select().from(schema.medications).where(eq(schema.medications.patientId, patientId)),
    db.select().from(schema.rules).where(and(eq(schema.rules.patientId, patientId), eq(schema.rules.active, true))),
    db.select().from(schema.ruleOverrides).where(eq(schema.ruleOverrides.patientId, patientId)),
    db.select().from(schema.routineOverrides).where(and(eq(schema.routineOverrides.patientId, patientId), eq(schema.routineOverrides.day, today))),
  ]);
  return {
    today,
    patient: { id: patient.id, name: patient.name, routine: patient.routine, settings: patient.settings, paused: patient.paused, pin: patient.pin },
    medications: meds
      .filter((m) => m.status !== 'archived')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({
        id: m.id,
        name: m.name,
        distinguishing: m.distinguishing,
        form: m.form,
        strength: m.strength,
        color: m.color,
        critical: m.critical,
        ifForgotten: m.ifForgotten,
        status: m.status,
        instructions: m.instructions,
        rules: rls
          .filter((r) => r.medicationId === m.id)
          .map((r) => ({ id: r.id, quantity: r.quantity, timing: r.timing, days: r.days, startDate: r.startDate, endDate: r.endDate, note: r.note })),
      })),
    // Le variazioni già finite non servono più in elenco.
    overrides: ovs
      .filter((o) => o.toDay >= today)
      .sort((a, b) => a.fromDay.localeCompare(b.fromDay))
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        from: o.fromDay,
        to: o.toDay,
        target: o.target,
        quantity: o.quantity,
        time: o.time,
        medicationId: o.medicationId,
        reason: o.reason,
      })),
    routineOverrides: rovs.map((r) => ({ moment: r.moment, time: r.time })),
  };
}

// ───────── Storico ─────────

export interface HistoryDay {
  day: string;
  total: number;
  taken: number;
  late: number;
  notTaken: number;
  missed: number;
  pending: number;
}

export async function buildHistory(db: Db, patientId: string, now = Date.now(), days = 14) {
  const patient = await getPatient(db, patientId);
  if (!patient) throw new Error('Paziente non trovato');
  const today = patientDay(now, patient.tz);
  const from = addDays(today, -(days - 1));
  const [meds, doses] = await Promise.all([
    db.select().from(schema.medications).where(eq(schema.medications.patientId, patientId)),
    loadDosesBetween(db, patientId, from, today),
  ]);
  const events = await loadEventsFor(db, patientId, doses.map((d) => d.key));
  const medsForCore = meds.map((m) => ({
    id: m.id,
    name: m.name,
    distinguishing: m.distinguishing,
    form: m.form as never,
    color: m.color,
    critical: m.critical,
    ifForgotten: m.ifForgotten as never,
    status: m.status as never,
    instructions: m.instructions,
  }));
  const views = buildViews(doses, medsForCore, events, now, patient.settings);
  const rows: HistoryDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const vs = views.filter((v) => v.dose.day === day);
    rows.push({
      day,
      total: vs.length,
      taken: vs.filter((v) => v.state.status === 'taken').length,
      late: vs.filter((v) => v.state.status === 'taken' && (v.state.lateMin ?? 0) >= 15).length,
      notTaken: vs.filter((v) => v.state.status === 'not_taken').length,
      missed: vs.filter((v) => v.state.status === 'missed').length,
      pending: vs.filter((v) => ['due', 'snoozed', 'scheduled'].includes(v.state.status)).length,
    });
  }
  const closed = rows.filter((r) => r.day < today || r.pending === 0);
  const totalClosed = closed.reduce((a, r) => a + r.total, 0);
  const takenClosed = closed.reduce((a, r) => a + r.taken, 0);

  const medName = new Map(meds.map((m) => [m.id, m.name + (m.distinguishing ? ` ${m.distinguishing}` : '')]));
  const doseByKey = new Map(doses.map((d) => [d.key, d]));
  const recent = events
    .filter((e) => e.type === 'taken' || e.type === 'not_taken' || e.type === 'undo')
    .sort((a, b) => b.at - a.at)
    .slice(0, 40);
  const userIds = [...new Set(recent.map((e) => e.actor).filter((a): a is string => !!a && a.startsWith('user:')).map((a) => a.slice(5)))];
  const userRows = userIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const userName = new Map(userRows.map((u) => [`user:${u.id}`, u.name]));
  const actorLabel = (a?: string | null) =>
    !a ? '' : a.startsWith('device:') ? 'Tablet' : a.startsWith('telegram:') ? 'Telegram' : (userName.get(a) ?? 'Familiare');

  return {
    today,
    days: rows,
    adherence: totalClosed ? Math.round((takenClosed / totalClosed) * 100) : null,
    events: recent.map((e) => {
      const d = doseByKey.get(e.doseKey);
      return {
        id: e.id,
        type: e.type,
        at: e.at,
        medication: d ? (medName.get(d.medicationId) ?? '') : '',
        scheduled: d?.localTime ?? '',
        day: d?.day ?? '',
        by: actorLabel(e.actor),
        reason: e.reason ?? null,
      };
    }),
  };
}
