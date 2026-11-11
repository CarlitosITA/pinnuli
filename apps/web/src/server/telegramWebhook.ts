import { and, eq } from 'drizzle-orm';
import { formatLocalTime } from '@pinnuli/core';
import { caregiverDoseAction, takeOverAlert } from './commands';
import { schema, type Db } from './db/client';
import { audit } from './audit';
import type { Notifier } from './telegram';

const { memberships, alerts, users, patients } = schema;

export interface TelegramUpdate {
  message?: { chat: { id: number | string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number | string } } };
}

export interface WebhookDeps {
  notifier: Notifier;
  /** Risposta al tocco di un pulsante (toglie il cerchio di attesa). */
  answerCallback?: (callbackId: string, text: string) => Promise<unknown>;
}

/**
 * Bot Telegram dei familiari (docs/04 § 4.5):
 * - `/start <codice>` collega la chat al familiare che ha generato il codice nell'app;
 * - «✅ L'ha presa» conferma la dose dal messaggio di allerta;
 * - «🙋 Me ne occupo io» ferma la catena di escalation.
 */
export async function handleTelegramUpdate(db: Db, update: TelegramUpdate, deps: WebhookDeps, now = Date.now()) {
  if (update.message?.text) {
    const chatId = String(update.message.chat.id);
    const m = update.message.text.trim().match(/^\/start(?:@\w+)?\s+([A-Za-z0-9]{6,32})$/);
    if (!m) {
      await deps.notifier.sendTelegram(chatId, 'Ciao! Sono il bot di Pìnnuli. Per collegarti apri l’app, vai su «Altro» e tocca «Collega Telegram».');
      return;
    }
    const [mem] = await db.select().from(memberships).where(eq(memberships.telegramLinkCode, m[1]!));
    if (!mem) {
      await deps.notifier.sendTelegram(chatId, 'Codice non valido o già usato. Generane uno nuovo dall’app.');
      return;
    }
    await db.update(memberships).set({ telegramChatId: chatId, telegramLinkCode: null }).where(and(eq(memberships.userId, mem.userId), eq(memberships.circleId, mem.circleId)));
    const [u] = await db.select().from(users).where(eq(users.id, mem.userId));
    await deps.notifier.sendTelegram(chatId, `Fatto, ${u?.name ?? ''}! Da ora ricevi qui gli avvisi di Pìnnuli.`);
    return;
  }

  const cb = update.callback_query;
  if (!cb?.data || !cb.message) return;
  const chatId = String(cb.message.chat.id);
  const [kind, alertId] = cb.data.split(':');
  const [mem] = await db.select().from(memberships).where(eq(memberships.telegramChatId, chatId));
  if (!mem || !alertId) {
    await deps.answerCallback?.(cb.id, 'Non riconosco questa chat.');
    return;
  }
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
  const [patient] = alert ? await db.select().from(patients).where(eq(patients.id, alert.patientId)) : [];
  // Il familiare deve far parte dello stesso cerchio del paziente.
  if (!alert || !patient || patient.circleId !== mem.circleId) {
    await deps.answerCallback?.(cb.id, 'Avviso non trovato.');
    return;
  }

  if (kind === 'o') {
    await takeOverAlert(db, patient.id, alertId, mem.userId, now);
    await deps.answerCallback?.(cb.id, 'Grazie, te ne occupi tu.');
    return;
  }
  if (kind === 't') {
    // Un avviso accorpato riguarda più dosi: si confermano tutte quelle emesse nello stesso istante.
    const siblings = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.patientId, alert.patientId), eq(alerts.createdAtMs, alert.createdAtMs), eq(alerts.step, alert.step), eq(alerts.kind, 'dose-not-confirmed')));
    for (const a of siblings) {
      if (a.doseKey) await caregiverDoseAction(db, patient.id, `telegram:${mem.userId}`, { doseKey: a.doseKey, type: 'taken' }, now);
    }
    await audit(db, { patientId: patient.id, actor: `telegram:${mem.userId}`, action: 'confirm-from-alert', entity: 'alert', entityId: alertId }, now);
    await deps.answerCallback?.(cb.id, `Dose segnata come presa alle ${formatLocalTime(now, patient.tz)}.`);
  }
}
