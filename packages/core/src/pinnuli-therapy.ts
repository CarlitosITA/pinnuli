import type { Instruction, Medication, Rule, Routine } from './types';

/**
 * La terapia attuale della prima paziente (docs/02 § 2.9), come dati di partenza modificabili.
 * Orari dei pasti (pranzo 13:00, cena 20:00) e quantità sono ipotesi da confermare (docs/08 § 8.3, Q4–Q5).
 */

const ins = (icon: Instruction['icon'], text: string): Instruction => ({ icon, text });

type SeedMed = Omit<Medication, 'id'> & { slug: string };

export const SEED_MEDICATIONS: SeedMed[] = [
  { slug: 'gastro', name: 'Gastroprotettore', form: 'capsula', color: '#9DC7E8', critical: false, ifForgotten: 'ask', status: 'suspended', instructions: [], strength: null },
  {
    slug: 'lactoflorene',
    name: 'Lactoflorene',
    form: 'bustina',
    color: '#CFE3B4',
    critical: false,
    ifForgotten: 'ask',
    status: 'active',
    instructions: [],
    strength: null,
  },
  {
    slug: 'sinemet',
    name: 'Sinemet',
    form: 'compressa',
    color: '#F2D36B',
    critical: true,
    ifForgotten: 'ask',
    status: 'active',
    instructions: [],
    strength: '100 mg + 25 mg',
  },
  {
    slug: 'sinemet-retard',
    name: 'Sinemet',
    distinguishing: 'RETARD',
    form: 'compressa',
    color: '#E9A06B',
    critical: true,
    ifForgotten: 'ask',
    status: 'active',
    instructions: [],
    strength: null,
  },
  {
    slug: 'peridon',
    name: 'Peridon',
    form: 'compressa',
    color: '#FFFFFF',
    critical: false,
    ifForgotten: 'ask',
    status: 'active',
    instructions: [ins('pieno', 'Quindici minuti prima di mangiare.')],
    strength: null,
  },
  {
    slug: 'furadantin',
    name: 'Neo Furadantin',
    form: 'capsula',
    color: '#E8B04A',
    critical: false,
    ifForgotten: 'ask',
    status: 'active',
    instructions: [ins('pieno', 'Dopo aver mangiato.')],
    strength: null,
  },
  { slug: 'cardioaspirina', name: 'Cardioaspirina', form: 'compressa', color: '#F7F3E8', critical: false, ifForgotten: 'ask', status: 'active', instructions: [], strength: null },
  {
    slug: 'movicol',
    name: 'Movicol',
    form: 'bustina',
    color: '#BFD8EF',
    critical: false,
    ifForgotten: 'ask',
    status: 'active',
    instructions: [ins('sciogliere', "Sciogli la bustina in un bicchiere d'acqua.")],
    strength: null,
  },
  { slug: 'statina', name: 'Statina', form: 'compressa', color: '#EBC9D6', critical: false, ifForgotten: 'ask', status: 'active', instructions: [], strength: null },
];

interface SeedRule {
  med: string;
  quantity: number;
  timing: Rule['timing'];
  note?: string;
  /** Giorni di durata (antibiotico). */
  durationDays?: number;
}

export const SEED_RULES: SeedRule[] = [
  { med: 'gastro', quantity: 1, timing: { kind: 'wake' } },
  { med: 'lactoflorene', quantity: 1, timing: { kind: 'fixed', time: '08:00' }, note: 'A digiuno, dopo aver urinato.' },
  { med: 'sinemet', quantity: 1, timing: { kind: 'fixed', time: '08:30' } },
  { med: 'sinemet', quantity: 1, timing: { kind: 'fixed', time: '12:30' } },
  { med: 'peridon', quantity: 1, timing: { kind: 'routine', moment: 'pranzo', offsetMin: -15 } },
  { med: 'furadantin', quantity: 1, timing: { kind: 'fixed', time: '13:45' }, note: 'Dopo pranzo.', durationDays: 7 },
  { med: 'cardioaspirina', quantity: 1, timing: { kind: 'fixed', time: '14:00' } },
  { med: 'movicol', quantity: 1, timing: { kind: 'fixed', time: '14:30' } },
  { med: 'sinemet', quantity: 1, timing: { kind: 'fixed', time: '16:30' } },
  { med: 'statina', quantity: 1, timing: { kind: 'fixed', time: '18:30' } },
  { med: 'sinemet', quantity: 0.5, timing: { kind: 'fixed', time: '19:30' }, note: 'Mezza compressa: spezzala lungo la linea.' },
  { med: 'peridon', quantity: 1, timing: { kind: 'routine', moment: 'cena', offsetMin: -15 } },
  { med: 'furadantin', quantity: 1, timing: { kind: 'fixed', time: '21:30' }, note: 'Dopo cena.', durationDays: 7 },
  { med: 'sinemet-retard', quantity: 1, timing: { kind: 'fixed', time: '22:30' } },
  { med: 'lactoflorene', quantity: 1, timing: { kind: 'fixed', time: '22:30' }, note: 'Dopo aver urinato.' },
];

export const SEED_ROUTINE: Routine = {
  risveglio: '07:30',
  colazione: '08:00',
  pranzo: '13:00',
  merenda: '17:00',
  cena: '20:00',
  coricarsi: '22:30',
};
