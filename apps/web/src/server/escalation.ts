import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  addDays,
  buildViews,
  deviceHealth,
  escalationKind,
  formatLocalTime,
  localParts,
  nextEscalationStep,
  patientDay,
  type DeviceHealth,
} from '@pinnuli/core';
import { schema, type Db } from './db/client';
import { notify } from './hub';
import { newId } from './security';
import { resolveAlertsForResolvedDoses } from './commands';
import type { Notifier } from './telegram';
import { loadDosesBetween, loadEventsFor, syncDoses } from './therapy';

const { alerts, devices, memberships, users, patients, medications } = schema;

type Member = {
  userId: string;
  name: string;
  chainPosition: number;
  telegramChatId: string | null;
  quietFrom: string | null;
  quietTo: string | null;
  discreet: boolean;
};

/** Ore di silenzio in ora locale, anche a cavallo della mezzanotte (docs/04 § 4.4). */
export function inQuietHours(now: number, tz: string, from: string | null, to: string | null): boolean {
  if (!from || !to) return false;
  const p = localParts(now, tz);
  const cur = p.h * 60 + p.mi;
  const [fh, fm] = from.split(':').map(Number) as [number, number];
  const [th, tm] = to.split(':').map(Number) as [number, number];
  const a = fh * 60 + fm;
  const b = th * 60 + tm;
  if (a === b) return false;
  return a < b ? cur >= a && cur < b : cur >= a || cur < b;
}

async function chainFor(db: Db, circleId: string): Promise<Member[]> {
  const rows = await db
    .select({
      userId: memberships.userId,
      name: users.name,
      chainPosition: memberships.chainPosition,
      telegramChatId: memberships.telegramChatId,
      quietFrom: memberships.quietFrom,
      quietTo: memberships.quietTo,
      discreet: memberships.discreet,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.circleId, circleId))
    .orderBy(asc(memberships.chainPosition));
  return rows;
}

function minutesWord(min: number): string {
  if (min < 60) return `${min} minuti`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h e ${m} min` : h === 1 ? '1 ora' : `${h} ore`;
}

export interface TickResult {
  created: number;
  resolved: number;
  sent: number;
}

/**
 * Un giro di controllo (ogni 30 secondi dal worker, docs/06 § 6.2):
 * 1. mantiene le dosi aggiornate;
 * 2. per ogni dose senza risposta decide se avvisare il prossimo caregiver della catena (docs/04 § 4.3–4.4);
 * 3. accorpa più dosi nello stesso avviso;
 * 4. risolve gli avvisi quando la dose viene confermata e avvisa chi li aveva ricevuti;
 * 5. controlla il tablet (offline, batteria).
 */
export async function runEscalationTick(db: Db, now: number, notifier: Notifier): Promise<TickResult> {
  const result: TickResult = { created: 0, resolved: 0, sent: 0 };
  const allPatients = await db.select().from(patients);

  for (const patient of allPatients) {
    await syncDoses(db, patient.id, now);
    const chain = await chainFor(db, patient.circleId);

    // ── Risoluzione ──
    const openBefore = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.patientId, patient.id), eq(alerts.status, 'open'), eq(alerts.kind, 'dose-not-confirmed')));
    const resolvedKeys = await resolveAlertsForResolvedDoses(db, patient.id, now);
    if (resolvedKeys.length) {
      const events = await loadEventsFor(db, patient.id, resolvedKeys);
      const notified = new Set<string>();
      for (const a of openBefore) {
        if (!a.doseKey || !resolvedKeys.includes(a.doseKey) || !a.recipientUserId) continue;
        result.resolved += 1;
        const mark = `${a.recipientUserId}:${a.doseKey}`;
        if (notified.has(mark)) continue;
        notified.add(mark);
        const member = chain.find((m) => m.userId === a.recipientUserId);
        if (!member?.telegramChatId) continue;
        const taken = events.filter((e) => e.doseKey === a.doseKey && e.type === 'taken').sort((x, y) => y.at - x.at)[0];
        const text = taken
          ? `✓ Risolto: ${patient.name} ha preso la dose, alle ${formatLocalTime(taken.at, patient.tz)}.`
          : `✓ Risolto: la dose di ${patient.name} è stata sistemata.`;
        if (await notifier.sendTelegram(member.telegramChatId, text)) result.sent += 1;
      }
    }

    if (patient.paused) {
      // Mai allarmi falsi in pausa (docs/04 § 4.4): si chiudono anche quelli aperti.
      await db
        .update(alerts)
        .set({ status: 'resolved', resolvedAtMs: now })
        .where(and(eq(alerts.patientId, patient.id), eq(alerts.status, 'open')));
      continue;
    }

    const devs = await db.select().from(devices).where(and(eq(devices.patientId, patient.id), eq(devices.status, 'active')));
    const tablets = devs.filter((d) => d.kind === 'tablet');
    const lastSeen = Math.max(0, ...tablets.map((d) => d.lastSeenMs ?? 0)) || null;
    // Con solo un telefono (niente tablet) la pagina non resta aperta: lo stato "offline" non vuol dire nulla,
    // quindi gli avvisi parlano di dose non confermata e non di tablet spento.
    const phonesOnly = !tablets.length && devs.some((d) => d.kind === 'phone');
    const health: DeviceHealth = tablets.length ? deviceHealth(lastSeen, now) : phonesOnly ? 'online' : 'never';

    // ── Dosi senza risposta ──
    const day = patientDay(now, patient.tz);
    const doses = await loadDosesBetween(db, patient.id, addDays(day, -1), day);
    const events = await loadEventsFor(db, patient.id, doses.map((d) => d.key));
    const meds = await db.select().from(medications).where(eq(medications.patientId, patient.id));
    const views = buildViews(
      doses,
      meds.map((m) => ({
        id: m.id,
        name: m.name,
        distinguishing: m.distinguishing,
        form: m.form as never,
        color: m.color,
        critical: m.critical,
        ifForgotten: m.ifForgotten as never,
        status: m.status as never,
        instructions: m.instructions,
      })),
      events,
      now,
      patient.settings,
    );
    const existing = doses.length
      ? await db.select().from(alerts).where(and(eq(alerts.patientId, patient.id), eq(alerts.kind, 'dose-not-confirmed'), inArray(alerts.doseKey, doses.map((d) => d.key))))
      : [];

    const byStep = new Map<number, typeof views>();
    for (const v of views) {
      const mine = existing.filter((a) => a.doseKey === v.dose.key);
      const step = nextEscalationStep({
        dose: v.dose,
        state: v.state,
        now,
        settings: patient.settings,
        chainLength: Math.max(1, chain.length),
        takenOver: mine.some((a) => !!a.takenOverBy),
        sentSteps: mine.map((a) => a.step),
      });
      if (step == null) continue;
      const list = byStep.get(step) ?? [];
      list.push(v);
      byStep.set(step, list);
    }

    for (const [step, fullList] of [...byStep.entries()].sort((a, b) => a[0] - b[0])) {
      let list = fullList;
      let recipient = chain[step] ?? chain[chain.length - 1];
      // Ore di silenzio: si salta chi dorme; se dorme tutta la catena, le dosi critiche vanno comunque al primo
      // e le altre aspettano la fine del silenzio.
      if (recipient && inQuietHours(now, patient.tz, recipient.quietFrom, recipient.quietTo)) {
        const awake = chain.find((m, i) => i >= step && !inQuietHours(now, patient.tz, m.quietFrom, m.quietTo));
        if (awake) {
          recipient = awake;
        } else {
          list = fullList.filter((v) => v.dose.critical);
          if (!list.length) continue;
          recipient = chain[0];
        }
      }
      const oldest = list.reduce((a, b) => (a.dose.scheduledAt < b.dose.scheduledAt ? a : b));
      const late = Math.max(1, Math.round((now - oldest.dose.scheduledAt) / 60_000));
      const names = list.map((v) => `${v.med.name}${v.med.distinguishing ? ' ' + v.med.distinguishing : ''} (${v.dose.localTime})`);
      const kind = escalationKind(health);
      let message: string;
      if (kind === 'device-offline') {
        const since = lastSeen ? Math.round((now - lastSeen) / 60_000) : null;
        message = `Il tablet di ${patient.name} è offline${since ? ` da ${minutesWord(since)}` : ''}: non sappiamo se ha preso ${names.join(', ')}. Prova a telefonarle.`;
      } else {
        message =
          list.length === 1
            ? `${names[0]} non confermato, da ${minutesWord(late)}.`
            : `${list.length} medicine non confermate: ${names.join(', ')}.`;
      }
      const discreet = recipient?.discreet ?? false;
      const text = discreet ? `Promemoria per ${patient.name}: dose non confermata` : `⚠️ ${patient.name}: ${message}`;

      const rows = list.map((v) => ({
        id: newId(),
        patientId: patient.id,
        kind: 'dose-not-confirmed',
        doseKey: v.dose.key,
        step,
        recipientUserId: recipient?.userId ?? null,
        status: 'open',
        message,
        createdAtMs: now,
        deliveredVia: null as string | null,
      }));

      let delivered = false;
      if (recipient?.telegramChatId) {
        const buttons = [
          { text: "✅ L'ha presa", data: `t:${rows[0]!.id}` },
          { text: '🙋 Me ne occupo io', data: `o:${rows[0]!.id}` },
        ];
        delivered = await notifier.sendTelegram(recipient.telegramChatId, text, buttons);
        if (delivered) result.sent += 1;
      }
      for (const r of rows) r.deliveredVia = delivered ? 'telegram' : 'app';
      await db.insert(alerts).values(rows);
      result.created += rows.length;
    }

    // ── Tablet offline e batteria ──
    for (const d of tablets) {
      const open = await db
        .select()
        .from(alerts)
        .where(and(eq(alerts.patientId, patient.id), eq(alerts.deviceId, d.id), eq(alerts.status, 'open')));
      const offlineMin = d.lastSeenMs ? Math.round((now - d.lastSeenMs) / 60_000) : null;
      const offline = offlineMin != null && offlineMin >= 30;
      const lowBattery = (d.battery ?? 100) <= 15 && d.charging === false;
      const openOffline = open.find((a) => a.kind === 'device-offline');
      const openBattery = open.find((a) => a.kind === 'battery');

      const raise = async (kind: 'device-offline' | 'battery', message: string) => {
        const first = chain[0];
        const id = newId();
        let delivered = false;
        if (first?.telegramChatId) {
          delivered = await notifier.sendTelegram(first.telegramChatId, `⚠️ ${message}`);
          if (delivered) result.sent += 1;
        }
        await db.insert(alerts).values({
          id,
          patientId: patient.id,
          kind,
          deviceId: d.id,
          step: 0,
          recipientUserId: first?.userId ?? null,
          status: 'open',
          message,
          createdAtMs: now,
          deliveredVia: delivered ? 'telegram' : 'app',
        });
        result.created += 1;
      };

      if (offline && !openOffline) {
        await raise('device-offline', `Il tablet di ${patient.name} è offline da ${minutesWord(offlineMin!)}. Le medicine suonano comunque, ma non vediamo cosa succede.`);
      } else if (!offline && openOffline) {
        await db.update(alerts).set({ status: 'resolved', resolvedAtMs: now }).where(eq(alerts.id, openOffline.id));
        result.resolved += 1;
        const first = chain.find((m) => m.userId === openOffline.recipientUserId);
        if (first?.telegramChatId && (await notifier.sendTelegram(first.telegramChatId, `✓ Il tablet di ${patient.name} è di nuovo collegato.`))) result.sent += 1;
      }
      if (lowBattery && !openBattery) {
        await raise('battery', `Il tablet di ${patient.name} ha la batteria al ${d.battery}% e non è in carica.`);
      } else if (!lowBattery && openBattery && ((d.battery ?? 100) > 30 || d.charging)) {
        await db.update(alerts).set({ status: 'resolved', resolvedAtMs: now }).where(eq(alerts.id, openBattery.id));
        result.resolved += 1;
      }
    }

    if (result.created || result.resolved) await notify(patient.id, 'alert');
  }
  return result;
}
