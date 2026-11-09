import { and, eq, inArray, lt } from 'drizzle-orm';
import webpush from 'web-push';
import { addDays, buildViews, formatLocalTime, patientDay, pickScreen } from '@pinnuli/core';
import { schema, type Db } from './db/client';
import { env } from './env';
import { newId } from './security';
import { loadDosesBetween, loadEventsFor } from './therapy';

const { patients, devices, medications, pushSubscriptions, pushLog } = schema;

export interface PushPayload {
  title: string;
  body: string;
  /** Stessa etichetta = la notifica nuova sostituisce la vecchia, invece di accumularsi. */
  tag: string;
  url: string;
  /** `done`: la dose è già stata segnata altrove; sostituisce la notifica del promemoria e sparisce da sola. */
  kind?: 'remind' | 'done';
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult = 'ok' | 'gone' | 'error';

export interface PushSender {
  send(target: PushTarget, payload: PushPayload): Promise<PushResult>;
}

/** Invio reale (Web Push con chiavi VAPID). Senza chiavi configurate restituisce null: le notifiche restano spente. */
export function createWebPushSender(): PushSender | null {
  if (!env.vapidPublic || !env.vapidPrivate) return null;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublic, env.vapidPrivate);
  return {
    async send(target, payload) {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(payload),
          { TTL: 15 * 60, urgency: 'high' },
        );
        return 'ok';
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return 'gone';
        console.error('[push] invio non riuscito', status ?? (e as Error).message);
        return 'error';
      }
    },
  };
}

/** Mittente che raccoglie le notifiche: per i test. */
export function createMemoryPushSender(result: PushResult = 'ok'): PushSender & { sent: { target: PushTarget; payload: PushPayload }[] } {
  const sent: { target: PushTarget; payload: PushPayload }[] = [];
  return {
    sent,
    async send(target, payload) {
      sent.push({ target, payload });
      return result;
    },
  };
}

/**
 * Minuti di ritardo a cui parte ogni notifica per lo stesso promemoria: subito, poi sempre più rade.
 * Poi tocca all'avviso ai familiari (docs/04 § 4.4): le notifiche non devono diventare un rumore continuo.
 */
export const PUSH_OFFSETS_MIN = {
  normal: [0, 5, 10, 20, 40],
  critical: [0, 3, 6, 12, 25, 45],
} as const;

/** Quante notifiche dovrebbero essere già partite a questo punto. */
export function pushesDue(minutesLate: number, critical: boolean): number {
  return (critical ? PUSH_OFFSETS_MIN.critical : PUSH_OFFSETS_MIN.normal).filter((m) => m <= minutesLate).length;
}

function names(list: { med: { name: string; distinguishing?: string | null } }[]) {
  return list.map((v) => `${v.med.name}${v.med.distinguishing ? ' ' + v.med.distinguishing : ''}`).join(', ');
}

export function pushText(pendingNames: string, localTime: string, minutesLate: number): { title: string; body: string } {
  if (minutesLate < 3) {
    return { title: `Pìnnuli · ${localTime}`, body: `È l’ora di: ${pendingNames}. Tocca per aprire il tasto «L’ho presa».` };
  }
  return { title: `Pìnnuli · ancora da confermare`, body: `${pendingNames} (delle ${localTime}), da ${minutesLate} minuti. Tocca per aprire.` };
}

export interface PushTickResult {
  sent: number;
  removed: number;
}

/**
 * Per ogni paziente con un promemoria in corso, manda le notifiche ai dispositivi iscritti (docs/06 § 6.8).
 * Le dosi si confermano dal tablet, dal telefono o dal familiare: appena sono risolte il promemoria sparisce e le notifiche finiscono.
 */
export async function runPushTick(db: Db, now: number, sender: PushSender): Promise<PushTickResult> {
  const result: PushTickResult = { sent: 0, removed: 0 };
  const allPatients = await db.select().from(patients);

  for (const patient of allPatients) {
    if (patient.paused) continue;
    const subs = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        failures: pushSubscriptions.failures,
      })
      .from(pushSubscriptions)
      .innerJoin(devices, eq(devices.id, pushSubscriptions.deviceId))
      .where(and(eq(devices.patientId, patient.id), eq(devices.status, 'active')));
    if (!subs.length) continue;

    const day = patientDay(now, patient.tz);
    const doses = await loadDosesBetween(db, patient.id, addDays(day, -1), addDays(day, 1));
    const events = await loadEventsFor(db, patient.id, doses.map((d) => d.key));
    const meds = await db.select().from(medications).where(eq(medications.patientId, patient.id));
    const medsView = meds.map((m) => ({
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
    const screen = pickScreen(doses, medsView, events, now, patient.settings);
    const current = screen.mode === 'reminder' && screen.reminder ? screen.reminder : null;
    const subIds = subs.map((s) => s.id);
    const logs = await db.select().from(pushLog).where(inArray(pushLog.subscriptionId, subIds));

    // Un promemoria già notificato e poi risolto (da un altro dispositivo, o dal familiare): la notifica si sostituisce con «Segnata».
    for (const log of logs) {
      if (log.closed || log.count === 0 || log.groupId === current?.group.id) continue;
      const keys = log.groupId.slice(log.groupId.indexOf(':') + 1).split('+');
      const views = buildViews(doses.filter((d) => keys.includes(d.key)), medsView, events, now, patient.settings);
      if (!views.length || !views.every((v) => v.state.status === 'taken' || v.state.status === 'not_taken')) continue;
      const sub = subs.find((x) => x.id === log.subscriptionId);
      if (!sub) continue;
      const taken = views.filter((v) => v.state.status === 'taken');
      const at = Math.max(0, ...taken.map((v) => v.state.takenAt ?? 0));
      const text = taken.length
        ? { title: 'Pìnnuli · segnata ✓', body: `${names(taken)} segnata alle ${formatLocalTime(at, patient.tz)}.` }
        : { title: 'Pìnnuli · segnata', body: `${names(views)} segnata come non presa.` };
      const outcome = await sender.send(sub, { ...text, tag: `dose-${log.groupId}`, url: '/t', kind: 'done' });
      if (outcome === 'gone') {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.removed += 1;
        continue;
      }
      // Anche se l'invio non riesce non si insiste: il promemoria è comunque finito.
      await db.update(pushLog).set({ closed: true }).where(and(eq(pushLog.subscriptionId, log.subscriptionId), eq(pushLog.groupId, log.groupId)));
      if (outcome === 'ok') result.sent += 1;
    }

    if (!current) continue;
    const { group, pending, minutesLate } = current;
    const due = pushesDue(minutesLate, group.critical);
    if (due === 0) continue;
    const text = pushText(names(pending), formatLocalTime(group.at, patient.tz), minutesLate);
    const done = new Map(logs.filter((l) => l.groupId === group.id).map((l) => [l.subscriptionId, l.count]));

    for (const sub of subs) {
      if ((done.get(sub.id) ?? 0) >= due) continue;
      const outcome = await sender.send(sub, { ...text, tag: `dose-${group.id}`, url: '/t', kind: 'remind' });
      if (outcome === 'gone') {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.removed += 1;
        continue;
      }
      await db
        .insert(pushLog)
        .values({ subscriptionId: sub.id, groupId: group.id, count: due, lastSentMs: now, closed: false })
        .onConflictDoUpdate({ target: [pushLog.subscriptionId, pushLog.groupId], set: { count: due, lastSentMs: now, closed: false } });
      if (outcome === 'ok') {
        result.sent += 1;
        await db.update(pushSubscriptions).set({ lastOkMs: now, failures: 0 }).where(eq(pushSubscriptions.id, sub.id));
      } else if (sub.failures + 1 >= 10) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        result.removed += 1;
      } else {
        await db.update(pushSubscriptions).set({ failures: sub.failures + 1 }).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  // Il registro serve solo per i promemoria in corso.
  await db.delete(pushLog).where(lt(pushLog.lastSentMs, now - 2 * 24 * 3600_000));
  return result;
}

export async function saveSubscription(
  db: Db,
  deviceId: string,
  input: { endpoint: string; p256dh: string; auth: string },
  now = Date.now(),
) {
  await db
    .insert(pushSubscriptions)
    .values({ id: newId(), deviceId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, createdAtMs: now })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { deviceId, p256dh: input.p256dh, auth: input.auth, failures: 0 },
    });
}
