import { describe, expect, it } from 'vitest';
import {
  canSnooze, canTakeEarly, deriveDoseState, generateDoses, nextEscalationStep, pickScreen, quantityWords,
  reminderSpeech, buildViews, groupDoses, isNightTime, shouldRepeatSound, volumeAt, deviceHealth, escalationKind,
  type DoseEvent, NORMAL_REMINDER, CRITICAL_REMINDER, missedAtFor,
} from '../src';
import { START, TZ, at, seedTherapy, settings } from './fixtures';

const input = seedTherapy();
const doses = generateDoses(input, '2026-11-08', '2026-11-11');
const sinemet0830 = doses.find((d) => d.day === START && d.localTime === '08:30')!;
const ev = (id: string, type: DoseEvent['type'], atMs: number, extra: Partial<DoseEvent> = {}): DoseEvent => ({ id, doseKey: sinemet0830.key, type, at: atMs, ...extra });

describe('stato della dose', () => {
  it('programmata → dovuta → mancata col passare del tempo', () => {
    expect(deriveDoseState(sinemet0830, [], at(START, '08:00'), settings).status).toBe('scheduled');
    expect(deriveDoseState(sinemet0830, [], at(START, '08:30'), settings).status).toBe('due');
    expect(deriveDoseState(sinemet0830, [], at(START, '09:59'), settings).status).toBe('due'); // critica: +90 min
    expect(deriveDoseState(sinemet0830, [], at(START, '10:00'), settings).status).toBe('missed');
  });

  it('presa in ritardo: registra i minuti', () => {
    const s = deriveDoseState(sinemet0830, [ev('1', 'taken', at(START, '08:44'))], at(START, '09:00'), settings);
    expect(s.status).toBe('taken');
    expect(s.lateMin).toBe(14);
    expect(s.early).toBe(false);
  });

  it('conferma in anticipo (entro 30 min per i critici)', () => {
    expect(canTakeEarly(sinemet0830, at(START, '08:05'), settings)).toBe(true);
    expect(canTakeEarly(sinemet0830, at(START, '07:50'), settings)).toBe(false);
    const s = deriveDoseState(sinemet0830, [ev('1', 'taken', at(START, '08:10'))], at(START, '08:10'), settings);
    expect(s.early).toBe(true);
  });

  it('"annulla" riporta la dose a dovuta', () => {
    const events = [ev('1', 'taken', at(START, '08:40')), ev('2', 'undo', at(START, '08:40') + 5000)];
    expect(deriveDoseState(sinemet0830, events, at(START, '08:41'), settings).status).toBe('due');
  });

  it('inviare due volte lo stesso evento non fa danni (idempotenza)', () => {
    const e = ev('same', 'snoozed', at(START, '08:31'), { until: at(START, '08:41') });
    const s = deriveDoseState(sinemet0830, [e, e, e], at(START, '08:35'), settings);
    expect(s.snoozeCount).toBe(1);
    expect(s.status).toBe('snoozed');
  });

  it('il rinvio scade e la dose torna dovuta', () => {
    const e = ev('1', 'snoozed', at(START, '08:31'), { until: at(START, '08:41') });
    expect(deriveDoseState(sinemet0830, [e], at(START, '08:42'), settings).status).toBe('due');
  });

  it('una dichiarazione umana vince su "mancata" (docs/04 § 4.6)', () => {
    const s = deriveDoseState(sinemet0830, [ev('1', 'taken', at(START, '11:00'))], at(START, '11:05'), settings);
    expect(s.status).toBe('taken');
  });

  it('due dichiarazioni in contrasto: vince la più recente e si segnala il conflitto', () => {
    const events = [ev('1', 'not_taken', at(START, '09:00')), ev('2', 'taken', at(START, '09:10'))];
    const s = deriveDoseState(sinemet0830, events, at(START, '09:20'), settings);
    expect(s.status).toBe('taken');
    expect(s.conflict).toBe(true);
  });

  it('gli eventi arrivati fuori ordine non cambiano il risultato', () => {
    const events = [ev('2', 'taken', at(START, '09:10')), ev('1', 'not_taken', at(START, '09:00'))];
    expect(deriveDoseState(sinemet0830, events, at(START, '09:20'), settings).status).toBe('taken');
  });

  it('i rinvii sono limitati (1 per i critici, 3 per gli altri)', () => {
    const e = ev('1', 'snoozed', at(START, '08:31'), { until: at(START, '08:41') });
    const st = deriveDoseState(sinemet0830, [e], at(START, '08:42'), settings);
    expect(canSnooze(sinemet0830, st, settings)).toBe(false);
    const peridon = doses.find((d) => d.medicationId === 'peridon' && d.day === START)!;
    expect(canSnooze(peridon, { status: 'due', snoozeCount: 2, conflict: false }, settings)).toBe(true);
  });

  it('"mancata" scatta 30 minuti prima della dose successiva dello stesso farmaco', () => {
    const next = at(START, '12:30');
    expect(missedAtFor(sinemet0830, CRITICAL_REMINDER, next)).toBe(at(START, '10:00'));
    const peridon = doses.find((d) => d.medicationId === 'peridon' && d.localTime === '12:45')!;
    expect(missedAtFor(peridon, NORMAL_REMINDER, null)).toBe(peridon.scheduledAt + 180 * 60_000);
  });
});

describe('schermata del tablet', () => {
  const screen = (hhmm: string, events: DoseEvent[] = [], day = START) =>
    pickScreen(doses, input.medications, events, at(day, hhmm), settings);

  it('di mattina presto: riposo con la prossima dose', () => {
    const s = screen('07:00');
    expect(s.mode).toBe('idle');
    expect(s.next?.localTime).toBe('08:00');
    expect(s.today).toHaveLength(13);
  });

  it('alle 08:30 scatta il promemoria del Sinemet', () => {
    const s = screen('08:30');
    expect(s.mode).toBe('reminder');
    expect(s.reminder!.pending.map((p) => p.med.name)).toEqual(['Sinemet']);
  });

  it('dopo la presa si torna al riposo', () => {
    const lactoflorene = doses.find((d) => d.day === START && d.localTime === '08:00')!;
    const events: DoseEvent[] = [
      { id: 'a', doseKey: sinemet0830.key, type: 'taken', at: at(START, '08:31') },
      { id: 'b', doseKey: lactoflorene.key, type: 'taken', at: at(START, '08:05') },
    ];
    const s = screen('08:32', events);
    expect(s.mode).toBe('idle');
    expect(s.next?.localTime).toBe('12:30');
  });

  it('alle 22:30 un solo promemoria per due farmaci', () => {
    const s = screen('22:30');
    expect(s.mode).toBe('reminder');
    expect(s.reminder!.pending).toHaveLength(2);
  });

  it('la dose dopo mezzanotte resta nella giornata di ieri e il tablet non si confonde', () => {
    const s = screen('00:10', [], '2026-11-10');
    expect(s.day).toBe(START);
  });

  it('dose senza risposta: domanda "l\'hai presa?" dopo la finestra', () => {
    const lactoflorene = doses.find((d) => d.day === START && d.localTime === '08:00')!;
    const s = screen('10:05', [{ id: 'l', doseKey: lactoflorene.key, type: 'taken', at: at(START, '08:05') }]);
    expect(s.mode).toBe('missed');
    expect(s.missed!.localTime).toBe('08:30');
  });

  it('il promemoria diventa insistente dopo qualche minuto', () => {
    expect(screen('08:31').reminder!.insistent).toBe(false);
    expect(screen('08:40').reminder!.insistent).toBe(true);
  });

  it('un farmaco critico passa davanti agli altri', () => {
    const s = screen('12:50');
    expect(s.reminder!.group.critical).toBe(true);
  });

  it('di sera è notte', () => {
    expect(isNightTime(at(START, '21:30'), TZ)).toBe(true);
    expect(isNightTime(at(START, '13:00'), TZ)).toBe(false);
    expect(isNightTime(at(START, '06:00'), TZ)).toBe(true);
  });

  it('suono: si ripete ogni 2 minuti (critico) e poi ogni 5; il volume cresce in 30 s', () => {
    const due = at(START, '08:30');
    expect(shouldRepeatSound(due, null, due, CRITICAL_REMINDER)).toBe(true);
    expect(shouldRepeatSound(due, due, due + 60_000, CRITICAL_REMINDER)).toBe(false);
    expect(shouldRepeatSound(due, due, due + 120_000, CRITICAL_REMINDER)).toBe(true);
    expect(shouldRepeatSound(due, due + 20 * 60_000, due + 24 * 60_000, CRITICAL_REMINDER)).toBe(false);
    expect(shouldRepeatSound(due, due + 20 * 60_000, due + 25 * 60_000, CRITICAL_REMINDER)).toBe(true);
    expect(volumeAt(0)).toBeCloseTo(0.35);
    expect(volumeAt(30_000)).toBe(1);
    expect(volumeAt(60_000)).toBe(1);
  });
});

describe('testi (docs/04 § 4.8)', () => {
  it('quantità a parole', () => {
    expect(quantityWords(1, 'compressa').text).toBe('una compressa');
    expect(quantityWords(0.5, 'compressa')).toEqual({ text: 'mezza compressa', fractional: true });
    expect(quantityWords(2, 'compressa').text).toBe('due compresse');
    expect(quantityWords(1.5, 'compressa').text).toBe('una compressa e mezza');
    expect(quantityWords(1, 'bustina').text).toBe('una bustina');
    expect(quantityWords(1, 'capsula').text).toBe('una capsula');
    expect(quantityWords(0.25, 'compressa').text).toBe('un quarto di compressa');
    expect(quantityWords(20, 'gocce').text).toBe('20 gocce');
    expect(quantityWords(1, 'flaconcino').text).toBe('un flaconcino');
    expect(quantityWords(0.5, 'flaconcino').text).toBe('mezzo flaconcino');
  });

  it('frase del promemoria singolo', () => {
    const v = buildViews([sinemet0830], input.medications, [], at(START, '08:30'), settings);
    expect(reminderSpeech('Anna', sinemet0830.scheduledAt, v, TZ)).toBe(
      "Anna, sono le otto e mezza del mattino. È l'ora del Sinemet: una compressa.",
    );
  });

  it('frase del gruppo', () => {
    const night = doses.filter((d) => d.day === START && d.localTime === '22:30');
    const v = buildViews(night, input.medications, [], at(START, '22:30'), settings);
    const group = groupDoses(v, 5, TZ)[0]!;
    expect(reminderSpeech('Anna', night[0]!.scheduledAt, group.doses, TZ)).toBe(
      'Anna, sono le dieci e mezza di notte. È l\'ora di due medicine: Lactoflorene e Sinemet.',
    );
  });
});

describe('escalation verso i caregiver', () => {
  const base = { dose: sinemet0830, settings, chainLength: 2, takenOver: false, sentSteps: [] as number[] };
  const state = (now: number) => deriveDoseState(sinemet0830, [], now, settings);

  it('Sinemet: prima allerta a +20 minuti, non prima', () => {
    expect(nextEscalationStep({ ...base, now: at(START, '08:49'), state: state(at(START, '08:49')) })).toBeNull();
    expect(nextEscalationStep({ ...base, now: at(START, '08:50'), state: state(at(START, '08:50')) })).toBe(0);
  });

  it('passa al caregiver successivo dopo altri 10 minuti, solo se nessuno se ne occupa', () => {
    const now = at(START, '09:00');
    expect(nextEscalationStep({ ...base, now, state: state(now), sentSteps: [0] })).toBe(1);
    expect(nextEscalationStep({ ...base, now, state: state(now), sentSteps: [0], takenOver: true })).toBeNull();
    expect(nextEscalationStep({ ...base, now, state: state(now), sentSteps: [0, 1] })).toBeNull();
  });

  it('farmaco normale: prima allerta a +45 minuti', () => {
    const peridon = doses.find((d) => d.medicationId === 'peridon' && d.day === START && d.localTime === '12:45')!;
    const n1 = at(START, '13:29');
    const n2 = at(START, '13:30');
    const st = (n: number) => deriveDoseState(peridon, [], n, settings);
    expect(nextEscalationStep({ ...base, dose: peridon, now: n1, state: st(n1) })).toBeNull();
    expect(nextEscalationStep({ ...base, dose: peridon, now: n2, state: st(n2) })).toBe(0);
  });

  it('nessuna allerta se la dose è stata presa', () => {
    const now = at(START, '09:30');
    const s = deriveDoseState(sinemet0830, [ev('x', 'taken', at(START, '08:55'))], now, settings);
    expect(nextEscalationStep({ ...base, now, state: s })).toBeNull();
  });

  it('tablet offline: allerta diversa ("non sappiamo se l\'ha presa")', () => {
    const now = at(START, '12:00');
    expect(deviceHealth(now - 40 * 60_000, now)).toBe('offline');
    expect(deviceHealth(now - 2 * 60_000, now)).toBe('online');
    expect(deviceHealth(null, now)).toBe('never');
    expect(escalationKind('offline')).toBe('device-offline');
    expect(escalationKind('online')).toBe('dose-not-confirmed');
  });
});
