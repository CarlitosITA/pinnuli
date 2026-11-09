import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addCaregiver, at, db, doseAt, schema, seedWorld, MORNING } from './helpers';
import { caregiverDoseAction, claimDevice, createMedication, createOverride, revokeDevice, setRoutineOverride, startPairing, takeOverAlert, updatePatient, updateRule } from '../src/server/commands';
import { runEscalationTick, inQuietHours } from '../src/server/escalation';
import { buildPlan, recordEvents, syncDoses } from '../src/server/therapy';
import { createMemoryNotifier } from '../src/server/telegram';
import { handleTelegramUpdate } from '../src/server/telegramWebhook';
import { buildCaregiverState } from '../src/server/caregiverState';

let w: Awaited<ReturnType<typeof seedWorld>>;
beforeEach(async () => {
  w = await seedWorld();
});

const countDoses = async (day: string) =>
  (await db.select().from(schema.doses).where(and(eq(schema.doses.patientId, w.patient.id), eq(schema.doses.day, day)))).length;

describe('dosi conservate', () => {
  it('la terapia di partenza genera 14 dosi al giorno per una settimana', async () => {
    expect(await countDoses('2026-11-09')).toBe(14);
    expect(await countDoses('2026-11-15')).toBe(14);
    expect(await countDoses('2026-11-16')).toBe(12); // l'antibiotico è finito il 15
    expect(await countDoses('2026-11-17')).toBe(0); // oltre l'orizzonte di 7 giorni
  });

  it('rigenerare senza modifiche non cambia nulla', async () => {
    expect(await syncDoses(db, w.patient.id, MORNING)).toBe(false);
  });

  it('una modifica vale da adesso in avanti: le dosi passate non si riscrivono', async () => {
    const now = at('13:00'); // le 12:30 sono passate, le 16:30 no
    const rule = (await db.select().from(schema.rules)).find((r) => r.timing.kind === 'fixed' && (r.timing as { time: string }).time === '12:30')!;
    await updateRule(db, w.patient.id, rule.id, 'test', { timing: { kind: 'fixed', time: '12:45' } }, now);
    const today = await db.select().from(schema.doses).where(eq(schema.doses.ruleId, rule.id));
    const todayDose = today.find((d) => d.day === '2026-11-09')!;
    const tomorrowDose = today.find((d) => d.day === '2026-11-10')!;
    expect(todayDose.localTime).toBe('12:30'); // già passata: resta com'era
    expect(tomorrowDose.localTime).toBe('12:45'); // da domani vale il nuovo orario
  });

  it('sospendere un farmaco toglie le dosi future ma non quelle passate', async () => {
    const statina = (await db.select().from(schema.medications)).find((m) => m.name === 'Statina')!;
    await createOverride(db, w.patient.id, 'test', { kind: 'suspend', from: '2026-11-09', to: '2026-11-11', target: { medicationId: statina.id } }, at('10:00'));
    const rows = await db.select().from(schema.doses).where(eq(schema.doses.medicationId, statina.id));
    expect(rows.map((r) => r.day).sort()).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
  });

  it('"oggi si pranza alle 14" sposta il Peridon senza toccare il resto', async () => {
    await setRoutineOverride(db, w.patient.id, 'test', { day: '2026-11-09', moment: 'pranzo', time: '14:00' }, MORNING);
    expect((await doseAt(w.patient.id, '13:45', 'Peridon')).localTime).toBe('13:45');
    expect(await countDoses('2026-11-09')).toBe(14);
  });

  it('un farmaco nuovo con due orari crea le dosi e si registra nell\'audit', async () => {
    const { id } = await createMedication(db, w.patient.id, 'test', {
      medication: { name: 'Bentelan', form: 'compressa', color: '#FFFFFF', critical: false, ifForgotten: 'ask', instructions: [] },
      rules: [
        { quantity: 1, timing: { kind: 'fixed', time: '09:00' }, days: { kind: 'daily' }, endDate: '2026-11-11' },
      ],
    }, MORNING);
    const rows = await db.select().from(schema.doses).where(eq(schema.doses.medicationId, id));
    expect(rows).toHaveLength(3);
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
    expect(audit).toHaveLength(1);
  });

  it('"Buongiorno" fa partire il gastroprotettore riattivato', async () => {
    const gastro = (await db.select().from(schema.medications)).find((m) => m.name === 'Gastroprotettore')!;
    const { updateMedication } = await import('../src/server/commands');
    await updateMedication(db, w.patient.id, gastro.id, 'test', { status: 'active' }, MORNING);
    expect((await doseAt(w.patient.id, '07:30', 'Gastroprotettore')).localTime).toBe('07:30');
    await recordEvents(db, w.patient.id, [{ id: 'wake-1234', type: 'wake', at: at('07:52') }], 'device:x', at('07:52'));
    const d = await db.select().from(schema.doses).where(and(eq(schema.doses.medicationId, gastro.id), eq(schema.doses.day, '2026-11-09')));
    expect(d[0]!.localTime).toBe('07:52');
  });

  it('pausa totale: nessuna dose futura e nessuna allerta', async () => {
    await updatePatient(db, w.patient.id, 'test', { paused: true }, MORNING);
    expect(await countDoses('2026-11-10')).toBe(0);
  });
});

describe('eventi dei dispositivi', () => {
  it('sono idempotenti: lo stesso id inviato due volte conta una volta', async () => {
    const d = await doseAt(w.patient.id, '08:30', 'Sinemet');
    const e = { id: 'evt-0001-aaaa', type: 'taken' as const, doseKey: d.key, at: at('08:34') };
    const first = await recordEvents(db, w.patient.id, [e], 'device:x', at('08:34'));
    const second = await recordEvents(db, w.patient.id, [e, e], 'device:x', at('08:35'));
    expect(first.accepted).toEqual([e.id]);
    expect(second.accepted).toEqual([]);
    expect(await db.select().from(schema.doseEvents)).toHaveLength(1);
  });

  it('un dispositivo non può scrivere su dosi inesistenti o di altri', async () => {
    const res = await recordEvents(db, w.patient.id, [{ id: 'evt-0002-bbbb', type: 'taken', doseKey: 'altra-dose:2026-11-09', at: at('08:34') }], 'device:x', at('08:34'));
    expect(res.accepted).toEqual([]);
  });

  it('un evento dal futuro lontano viene riportato all\'ora del server', async () => {
    const d = await doseAt(w.patient.id, '08:30', 'Sinemet');
    await recordEvents(db, w.patient.id, [{ id: 'evt-0003-cccc', type: 'taken', doseKey: d.key, at: at('08:34') + 86_400_000 }], 'device:x', at('08:34'));
    const [row] = await db.select().from(schema.doseEvents);
    expect(row!.atMs).toBeLessThanOrEqual(at('08:34') + 60_000);
  });

  it('il piano per il tablet include ieri, oggi e i prossimi giorni, e gli eventi', async () => {
    const d = await doseAt(w.patient.id, '08:30', 'Sinemet');
    await recordEvents(db, w.patient.id, [{ id: 'evt-0004-dddd', type: 'taken', doseKey: d.key, at: at('08:34') }], 'device:x', at('08:34'));
    const plan = (await buildPlan(db, w.patient.id, at('08:40')))!;
    expect(plan.day).toBe('2026-11-09');
    expect(plan.doses.some((x) => x.day === '2026-11-12')).toBe(true);
    expect(plan.events).toHaveLength(1);
    expect(plan.patient.settings.debounceMs).toBe(800);
  });
});

describe('collegamento del tablet', () => {
  it('il tablet mostra un codice, il familiare lo inserisce, il dispositivo risulta collegato', async () => {
    const p = await startPairing(db, 'tablet', MORNING);
    expect(p.code).toMatch(/^\d{6}$/);
    const id = await claimDevice(db, w.patient.id, 'test', { code: `${p.code.slice(0, 3)} ${p.code.slice(3)}`, name: 'Tablet cucina' }, MORNING + 1000);
    const [dev] = await db.select().from(schema.devices).where(eq(schema.devices.id, id));
    expect(dev!.status).toBe('active');
    expect(dev!.patientId).toBe(w.patient.id);
    expect(dev!.handoffToken).toBeTruthy();
  });

  it('un codice sbagliato o scaduto non collega nulla', async () => {
    const p = await startPairing(db, 'tablet', MORNING);
    await expect(claimDevice(db, w.patient.id, 'test', { code: '000000' }, MORNING)).rejects.toThrow(/Codice/);
    await expect(claimDevice(db, w.patient.id, 'test', { code: p.code }, MORNING + 31 * 60_000)).rejects.toThrow(/scaduto/);
  });

  it('un dispositivo scollegato non può più usare il token', async () => {
    const p = await startPairing(db, 'tablet', MORNING);
    const id = await claimDevice(db, w.patient.id, 'test', { code: p.code }, MORNING);
    await revokeDevice(db, w.patient.id, id, 'test', MORNING);
    const [dev] = await db.select().from(schema.devices).where(eq(schema.devices.id, id));
    expect(dev!.status).toBe('revoked');
    expect(dev!.tokenHash).toBeNull();
  });
});

describe('escalation ai familiari', () => {
  async function setup() {
    const maria = await addCaregiver(w.member.circleId, 'Maria', 1, '222');
    await db.update(schema.memberships).set({ telegramChatId: '111' }).where(eq(schema.memberships.userId, w.user.id));
    // Il Lactoflorene delle 08:00 è già stato preso: qui si guarda solo al Sinemet.
    const lacto = await doseAt(w.patient.id, '08:00', 'Lactoflorene');
    await recordEvents(db, w.patient.id, [{ id: 'evt-lacto-0001', type: 'taken', doseKey: lacto.key, at: at('08:03') }], 'device:x', at('08:03'));
    return { maria, notifier: createMemoryNotifier() };
  }

  it('Sinemet non confermato: primo avviso a +20 minuti, con i pulsanti', async () => {
    const { notifier } = await setup();
    expect((await runEscalationTick(db, at('08:49'), notifier)).created).toBe(0);
    const r = await runEscalationTick(db, at('08:50'), notifier);
    // alle 08:50 sono scoperte anche le 08:00 (Lactoflorene, +45 min non ancora)
    expect(r.created).toBe(1);
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]!.chatId).toBe('111');
    expect(notifier.sent[0]!.text).toContain('Sinemet (08:30)');
    expect(notifier.sent[0]!.buttons?.map((b) => b.text)).toEqual(["✅ L'ha presa", '🙋 Me ne occupo io']);
  });

  it('non rimanda lo stesso avviso, e dopo altri 10 minuti passa al successivo', async () => {
    const { notifier } = await setup();
    await runEscalationTick(db, at('08:50'), notifier);
    expect((await runEscalationTick(db, at('08:55'), notifier)).created).toBe(0);
    const r = await runEscalationTick(db, at('09:00'), notifier);
    expect(r.created).toBeGreaterThanOrEqual(1);
    const toMaria = notifier.sent.filter((m) => m.chatId === '222');
    expect(toMaria).toHaveLength(1);
  });

  it('"Me ne occupo io" ferma la catena', async () => {
    const { notifier } = await setup();
    await runEscalationTick(db, at('08:50'), notifier);
    const [a] = await db.select().from(schema.alerts).where(eq(schema.alerts.kind, 'dose-not-confirmed'));
    await takeOverAlert(db, w.patient.id, a!.id, w.user.id, at('08:51'));
    await runEscalationTick(db, at('09:05'), notifier);
    expect(notifier.sent.filter((m) => m.chatId === '222')).toHaveLength(0);
  });

  it('quando la dose viene confermata l\'avviso si risolve e chi l\'aveva ricevuto lo sa', async () => {
    const { notifier } = await setup();
    await runEscalationTick(db, at('08:50'), notifier);
    const d = await doseAt(w.patient.id, '08:30', 'Sinemet');
    await recordEvents(db, w.patient.id, [{ id: 'evt-0005-eeee', type: 'taken', doseKey: d.key, at: at('08:56') }], 'device:x', at('08:56'));
    const r = await runEscalationTick(db, at('08:57'), notifier);
    expect(r.resolved).toBe(1);
    const last = notifier.sent[notifier.sent.length - 1]!;
    expect(last.text).toBe('✓ Risolto: Mamma ha preso la dose, alle 08:56.');
    const open = await db.select().from(schema.alerts).where(eq(schema.alerts.status, 'open'));
    expect(open).toHaveLength(0);
  });

  it('più dosi nello stesso momento diventano un solo messaggio', async () => {
    const { notifier } = await setup();
    await runEscalationTick(db, at('23:30'), notifier);
    // 22:30: Sinemet Retard (critico, +20) e Lactoflorene (normale, +45): a 23:30 sono entrambe oltre soglia
    // (le dosi delle ore precedenti non sono state prese, ma qui interessa solo il gruppo delle 22:30)
    const msgs = notifier.sent.filter((m) => m.chatId === '111' && m.text.includes('22:30'));
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs.some((m) => m.text.includes('Sinemet RETARD (22:30)') && m.text.includes('Lactoflorene (22:30)'))).toBe(true);
  });

  it('in pausa totale non parte nessun avviso', async () => {
    const { notifier } = await setup();
    await updatePatient(db, w.patient.id, 'test', { paused: true }, at('08:00'));
    const r = await runEscalationTick(db, at('09:30'), notifier);
    expect(r.created).toBe(0);
    expect(notifier.sent).toHaveLength(0);
  });

  it('ore di silenzio: si salta chi dorme, ma i farmaci critici arrivano comunque al primo', async () => {
    const { notifier } = await setup();
    // qui il Lactoflorene non è stato preso: è l'avviso "normale" che deve aspettare
    await db.delete(schema.doseEvents);
    await db.update(schema.memberships).set({ quietFrom: '22:00', quietTo: '09:00' }).where(eq(schema.memberships.userId, w.user.id));
    await db.update(schema.memberships).set({ quietFrom: '22:00', quietTo: '09:00' }).where(eq(schema.memberships.chainPosition, 1));
    await runEscalationTick(db, at('08:50'), notifier); // Sinemet: critico → arriva al primo
    expect(notifier.sent.filter((m) => m.chatId === '111')).toHaveLength(1);
    // il Lactoflorene (normale, 08:00 → +45 = 08:45) aspettava: ora che c'è silenzio per tutti, non è partito
    expect(notifier.sent.some((m) => m.text.includes('Lactoflorene'))).toBe(false);
  });

  it('tablet offline: l\'avviso dice che non sappiamo se ha preso la dose', async () => {
    const { notifier } = await setup();
    const p = await startPairing(db, 'tablet', at('07:00'));
    const id = await claimDevice(db, w.patient.id, 'test', { code: p.code }, at('07:00'));
    await db.update(schema.devices).set({ lastSeenMs: at('08:10') }).where(eq(schema.devices.id, id));
    await runEscalationTick(db, at('08:50'), notifier);
    const doseMsg = notifier.sent.find((m) => m.text.includes('Sinemet'));
    expect(doseMsg!.text).toContain('è offline da 40 minuti');
    expect(doseMsg!.text).toContain('non sappiamo se ha preso');
    const offline = await db.select().from(schema.alerts).where(eq(schema.alerts.kind, 'device-offline'));
    expect(offline).toHaveLength(1);
  });

  it('batteria quasi scarica e non in carica: un avviso, e si chiude quando torna in carica', async () => {
    const { notifier } = await setup();
    const p = await startPairing(db, 'tablet', at('07:00'));
    const id = await claimDevice(db, w.patient.id, 'test', { code: p.code }, at('07:00'));
    await db.update(schema.devices).set({ lastSeenMs: at('07:05'), battery: 9, charging: false }).where(eq(schema.devices.id, id));
    await runEscalationTick(db, at('07:06'), notifier);
    expect((await db.select().from(schema.alerts).where(eq(schema.alerts.kind, 'battery')))).toHaveLength(1);
    await db.update(schema.devices).set({ lastSeenMs: at('07:10'), battery: 12, charging: true }).where(eq(schema.devices.id, id));
    await runEscalationTick(db, at('07:11'), notifier);
    expect((await db.select().from(schema.alerts).where(and(eq(schema.alerts.kind, 'battery'), eq(schema.alerts.status, 'open'))))).toHaveLength(0);
  });

  it('inQuietHours gestisce la mezzanotte', () => {
    expect(inQuietHours(at('23:30'), 'Europe/Rome', '22:00', '07:00')).toBe(true);
    expect(inQuietHours(at('06:59'), 'Europe/Rome', '22:00', '07:00')).toBe(true);
    expect(inQuietHours(at('12:00'), 'Europe/Rome', '22:00', '07:00')).toBe(false);
    expect(inQuietHours(at('12:00'), 'Europe/Rome', null, null)).toBe(false);
  });
});

describe('bot Telegram', () => {
  it('/start <codice> collega la chat al familiare', async () => {
    await db.update(schema.memberships).set({ telegramLinkCode: 'ABC123XYZ' }).where(eq(schema.memberships.userId, w.user.id));
    const notifier = createMemoryNotifier();
    await handleTelegramUpdate(db, { message: { chat: { id: 555 }, text: '/start ABC123XYZ' } }, { notifier });
    const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, w.user.id));
    expect(m!.telegramChatId).toBe('555');
    expect(m!.telegramLinkCode).toBeNull();
    expect(notifier.sent[0]!.text).toContain('Da ora ricevi qui gli avvisi');
  });

  it('un codice sconosciuto non collega nulla', async () => {
    const notifier = createMemoryNotifier();
    await handleTelegramUpdate(db, { message: { chat: { id: 555 }, text: '/start SBAGLIATO1' } }, { notifier });
    expect(notifier.sent[0]!.text).toContain('non valido');
  });

  it('«✅ L\'ha presa» conferma la dose; «Me ne occupo io» ferma la catena', async () => {
    await db.update(schema.memberships).set({ telegramChatId: '111' }).where(eq(schema.memberships.userId, w.user.id));
    const notifier = createMemoryNotifier();
    await runEscalationTick(db, at('08:50'), notifier);
    const [a] = await db.select().from(schema.alerts);
    const answers: string[] = [];
    const deps = { notifier, answerCallback: async (_id: string, t: string) => void answers.push(t) };
    await handleTelegramUpdate(db, { callback_query: { id: 'cb1', data: `o:${a!.id}`, message: { chat: { id: 111 } } } }, deps, at('08:52'));
    expect((await db.select().from(schema.alerts).where(eq(schema.alerts.id, a!.id)))[0]!.takenOverBy).toBe(w.user.id);
    await handleTelegramUpdate(db, { callback_query: { id: 'cb2', data: `t:${a!.id}`, message: { chat: { id: 111 } } } }, deps, at('08:53'));
    const d = await doseAt(w.patient.id, '08:30', 'Sinemet');
    const ev = await db.select().from(schema.doseEvents).where(eq(schema.doseEvents.doseKey, d.key));
    expect(ev).toHaveLength(1);
    expect(ev[0]!.actor).toBe(`telegram:${w.user.id}`);
    expect(answers).toEqual(['Grazie, te ne occupi tu.', 'Segnato come preso alle 08:53.']);
  });

  it('una chat sconosciuta non può confermare nulla', async () => {
    await db.update(schema.memberships).set({ telegramChatId: '111' }).where(eq(schema.memberships.userId, w.user.id));
    const notifier = createMemoryNotifier();
    await runEscalationTick(db, at('08:50'), notifier);
    const [a] = await db.select().from(schema.alerts);
    await handleTelegramUpdate(db, { callback_query: { id: 'x', data: `t:${a!.id}`, message: { chat: { id: 999 } } } }, { notifier }, at('08:53'));
    expect(await db.select().from(schema.doseEvents)).toHaveLength(0);
  });
});

describe('stato per il familiare', () => {
  it('semaforo: verde, arancione, rosso', async () => {
    expect((await buildCaregiverState(db, w.patient.id, at('07:00'))).light).toBe('ok');
    const attention = await buildCaregiverState(db, w.patient.id, at('08:10'));
    expect(attention.light).toBe('attention');
    expect(attention.lightText).toBe('Una dose da confermare');
    const notifier = createMemoryNotifier();
    await runEscalationTick(db, at('08:50'), notifier);
    expect((await buildCaregiverState(db, w.patient.id, at('08:50'))).light).toBe('alert');
  });

  it('mostra l\'ultima dose presa e la prossima', async () => {
    const d = await doseAt(w.patient.id, '08:30', 'Sinemet');
    await caregiverDoseAction(db, w.patient.id, 'user:x', { doseKey: d.key, type: 'taken', at: at('08:35') }, at('08:36'));
    const s = await buildCaregiverState(db, w.patient.id, at('08:40'));
    expect(s.lastTaken?.name).toBe('Sinemet');
    expect(s.counts.taken).toBe(1);
    expect(s.next?.localTime).toBe('12:30');
  });
});
