import { describe, expect, it } from 'vitest';
import { generateDoses, groupDoses, formatLocalTime, type RuleOverride, type DaysSpec, buildViews } from '../src';
import { START, TZ, seedTherapy, settings } from './fixtures';

const times = (doses: ReturnType<typeof generateDoses>) => doses.map((d) => formatLocalTime(d.scheduledAt, TZ));

describe('terapia reale della prima paziente (docs/02 § 2.9)', () => {
  const input = seedTherapy();
  const doses = generateDoses(input, START, START);

  it('genera 14 dosi al giorno (il gastroprotettore è sospeso)', () => {
    expect(doses).toHaveLength(14);
  });

  it('gli orari sono quelli della scheda', () => {
    expect(times(doses)).toEqual([
      '08:00', '08:30', '12:30', '12:45', '13:45', '14:00', '14:30',
      '16:30', '18:30', '19:30', '19:45', '21:30', '22:30', '22:30',
    ]);
  });

  it('forma 13 momenti: alle 22:30 un solo promemoria per due farmaci', () => {
    const views = buildViews(doses, input.medications, [], 0, settings);
    const groups = groupDoses(views, 5, TZ);
    expect(groups).toHaveLength(13);
    const night = groups[groups.length - 1]!;
    expect(night.doses.map((d) => d.med.name).sort()).toEqual(['Lactoflorene', 'Sinemet'].sort());
  });

  it('Sinemet e Sinemet Retard sono a orario critico: 5 dosi critiche', () => {
    expect(doses.filter((d) => d.critical)).toHaveLength(5);
  });

  it('il mezzo Sinemet delle 19:30 ha quantità 0,5', () => {
    const d = doses.find((x) => x.localTime === '19:30')!;
    expect(d.quantity).toBe(0.5);
  });

  it('se torna il gastroprotettore: 15 dosi, la prima al risveglio', () => {
    const t = seedTherapy();
    t.medications.find((m) => m.id === 'gastro')!.status = 'active';
    const d = generateDoses(t, START, START);
    expect(d).toHaveLength(15);
    expect(formatLocalTime(d[0]!.scheduledAt, TZ)).toBe('07:30'); // orario abituale se non tocca "Buongiorno"
  });

  it('con "Buongiorno" toccato alle 07:52 la dose al risveglio scatta alle 07:52', () => {
    const t = seedTherapy();
    t.medications.find((m) => m.id === 'gastro')!.status = 'active';
    t.wakeAt = { [START]: Date.UTC(2026, 10, 9, 6, 52) };
    const d = generateDoses(t, START, START);
    expect(d[0]!.localTime).toBe('07:52');
  });

  it("l'antibiotico a durata limitata sparisce il giorno dopo la fine", () => {
    const last = '2026-11-15'; // 7 giorni da 9/11
    const next = '2026-11-16';
    expect(generateDoses(seedTherapy(), last, last).filter((d) => d.medicationId === 'furadantin')).toHaveLength(2);
    expect(generateDoses(seedTherapy(), next, next).filter((d) => d.medicationId === 'furadantin')).toHaveLength(0);
  });

  it('non genera dosi prima della data di inizio', () => {
    expect(generateDoses(seedTherapy(), '2026-11-08', '2026-11-08')).toHaveLength(0);
  });
});

describe('pasti spostati solo per oggi', () => {
  it('"oggi si pranza alle 14": il Peridon suona alle 13:45 senza toccare altro', () => {
    const t = seedTherapy();
    t.routineOverrides = [{ day: START, moment: 'pranzo', time: '14:00' }];
    const d = generateDoses(t, START, START);
    const peridon = d.filter((x) => x.medicationId === 'peridon');
    expect(peridon.map((x) => x.localTime)).toEqual(['13:45', '19:45']);
    expect(d).toHaveLength(14);
  });

  it('un pasto dopo mezzanotte non rompe la giornata', () => {
    const t = seedTherapy();
    t.routine = { ...t.routine, cena: '23:30' };
    const d = generateDoses(t, START, START).filter((x) => x.medicationId === 'peridon');
    expect(d.map((x) => x.localTime)).toEqual(['12:45', '23:15']);
  });
});

describe('variazioni temporanee (docs/02 § 2.4)', () => {
  const base = (): RuleOverride => ({
    id: 'o1', kind: 'quantity', from: '2026-11-10', to: '2026-11-13',
    target: { ruleId: 'r11' }, quantity: 1, createdAt: 1,
  });

  it('cambia quantità per il periodo e poi torna da sola', () => {
    const t = seedTherapy();
    t.overrides = [base()];
    const during = generateDoses(t, '2026-11-12', '2026-11-12').find((d) => d.localTime === '19:30')!;
    expect(during.quantity).toBe(1);
    expect(during.changeNote).toBe('cambiata fino a ven 13/11');
    const after = generateDoses(t, '2026-11-14', '2026-11-14').find((d) => d.localTime === '19:30')!;
    expect(after.quantity).toBe(0.5);
    expect(after.changeNote).toBeNull();
  });

  it('sospende un farmaco per qualche giorno', () => {
    const t = seedTherapy();
    t.overrides = [{ id: 'o2', kind: 'suspend', from: '2026-11-10', to: '2026-11-12', target: { medicationId: 'statina' }, createdAt: 1 }];
    expect(generateDoses(t, '2026-11-11', '2026-11-11').some((d) => d.medicationId === 'statina')).toBe(false);
    expect(generateDoses(t, '2026-11-13', '2026-11-13').some((d) => d.medicationId === 'statina')).toBe(true);
  });

  it('la sospensione totale (ricovero) ha sempre la precedenza', () => {
    const t = seedTherapy();
    t.overrides = [
      { id: 'o3', kind: 'suspend', from: '2026-11-10', to: '2026-11-12', target: { all: true }, createdAt: 1 },
      { id: 'o4', kind: 'add', from: '2026-11-10', to: '2026-11-12', target: {}, medicationId: 'statina', time: '09:00', createdAt: 2 },
    ];
    expect(generateDoses(t, '2026-11-11', '2026-11-11')).toHaveLength(0);
    expect(generateDoses(t, '2026-11-13', '2026-11-13')).toHaveLength(14);
  });

  it('cambia orario: "domani il Sinemet delle 16:30 alle 17:00"', () => {
    const t = seedTherapy();
    t.overrides = [{ id: 'o5', kind: 'time', from: '2026-11-10', to: '2026-11-10', target: { ruleId: 'r9' }, time: '17:00', createdAt: 1 }];
    const d = generateDoses(t, '2026-11-10', '2026-11-10');
    expect(d.find((x) => x.ruleId === 'r9')!.localTime).toBe('17:00');
    expect(d.some((x) => x.localTime === '16:30')).toBe(false);
  });

  it('aggiunge un farmaco per 3 giorni e una dose una tantum', () => {
    const t = seedTherapy();
    t.medications.push({ id: 'bentelan', name: 'Bentelan', form: 'compressa', color: '#fff', critical: false, ifForgotten: 'ask', status: 'active', instructions: [] });
    t.overrides = [
      { id: 'o6', kind: 'add', from: '2026-11-10', to: '2026-11-12', target: {}, medicationId: 'bentelan', time: '09:00', quantity: 1, createdAt: 1 },
      { id: 'o7', kind: 'once', from: '2026-11-11', to: '2026-11-11', target: {}, medicationId: 'movicol', time: '17:00', quantity: 1, createdAt: 2 },
    ];
    expect(generateDoses(t, '2026-11-10', '2026-11-10').some((d) => d.medicationId === 'bentelan')).toBe(true);
    expect(generateDoses(t, '2026-11-13', '2026-11-13').some((d) => d.medicationId === 'bentelan')).toBe(false);
    const once = generateDoses(t, '2026-11-11', '2026-11-12').filter((d) => d.overrideId === 'o7');
    expect(once).toHaveLength(1);
    expect(once[0]!.changeNote).toBe('solo oggi');
  });

  it('più variazioni sulla stessa dose: vince la più recente', () => {
    const t = seedTherapy();
    t.overrides = [
      { id: 'a', kind: 'quantity', from: START, to: START, target: { ruleId: 'r3' }, quantity: 2, createdAt: 1 },
      { id: 'b', kind: 'quantity', from: START, to: START, target: { ruleId: 'r3' }, quantity: 0.5, createdAt: 2 },
    ];
    expect(generateDoses(t, START, START).find((d) => d.ruleId === 'r3')!.quantity).toBe(0.5);
  });
});

describe('ricorrenze', () => {
  const run = (days: DaysSpec, from: string, to: string) => {
    const t = seedTherapy();
    t.rules = [{ ...t.rules[2]!, days, startDate: START }];
    return generateDoses(t, from, to).map((d) => d.day);
  };
  it('giorni della settimana (lun, mer, ven)', () => {
    expect(run({ kind: 'weekdays', days: [0, 2, 4] }, '2026-11-09', '2026-11-15')).toEqual(['2026-11-09', '2026-11-11', '2026-11-13']);
  });
  it('giorni alterni', () => {
    expect(run({ kind: 'everyN', n: 2, anchor: START }, '2026-11-09', '2026-11-14')).toEqual(['2026-11-09', '2026-11-11', '2026-11-13']);
  });
  it('ciclo 3 sì, 2 no', () => {
    expect(run({ kind: 'cycle', on: 3, off: 2, anchor: START }, '2026-11-09', '2026-11-18')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-14', '2026-11-15', '2026-11-16',
    ]);
  });
});
