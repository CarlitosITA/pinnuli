import { quantityWords, type DaysSpec, type MedicationForm, type MomentKey, type Timing } from '@pinnuli/core';

export const MOMENT_NAME: Record<MomentKey, string> = {
  risveglio: 'Risveglio',
  colazione: 'Colazione',
  pranzo: 'Pranzo',
  merenda: 'Merenda',
  cena: 'Cena',
  coricarsi: 'Andare a letto',
};

const AT: Record<MomentKey, string> = {
  risveglio: 'al risveglio',
  colazione: 'a colazione',
  pranzo: 'a pranzo',
  merenda: 'a merenda',
  cena: 'a cena',
  coricarsi: 'quando va a letto',
};
const BEFORE: Record<MomentKey, string> = {
  risveglio: 'del risveglio',
  colazione: 'della colazione',
  pranzo: 'del pranzo',
  merenda: 'della merenda',
  cena: 'della cena',
  coricarsi: 'di andare a letto',
};
const AFTER: Record<MomentKey, string> = {
  risveglio: 'il risveglio',
  colazione: 'la colazione',
  pranzo: 'il pranzo',
  merenda: 'la merenda',
  cena: 'la cena',
  coricarsi: 'il coricarsi',
};

export function timingText(t: Timing): string {
  switch (t.kind) {
    case 'fixed':
      return `alle ${t.time}`;
    case 'wake':
      return 'al risveglio';
    case 'asNeeded':
      return 'al bisogno';
    case 'routine': {
      if (t.offsetMin === 0) return AT[t.moment];
      const mins = Math.abs(t.offsetMin);
      return t.offsetMin < 0 ? `${mins} minuti prima ${BEFORE[t.moment]}` : `${mins} minuti dopo ${AFTER[t.moment]}`;
    }
  }
}

const WD = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
export function daysText(d: DaysSpec): string {
  switch (d.kind) {
    case 'daily':
      return 'tutti i giorni';
    case 'weekdays':
      return d.days.map((x) => WD[x]).join(', ');
    case 'everyN':
      return `ogni ${d.n} giorni`;
    case 'cycle':
      return `${d.on} giorni sì, ${d.off} no`;
  }
}

export function ruleText(r: { quantity: number; timing: Timing; days: DaysSpec; endDate: string | null }, form: string): string {
  const parts = [quantityWords(r.quantity, form as MedicationForm).text, timingText(r.timing), daysText(r.days)];
  if (r.endDate) {
    const [y, m, d] = r.endDate.split('-');
    parts.push(`fino al ${Number(d)}/${Number(m)}/${y}`);
  }
  return parts.join(' · ');
}

export const FORM_LABEL: Record<string, string> = {
  compressa: 'Compressa',
  capsula: 'Capsula',
  bustina: 'Bustina',
  flaconcino: 'Flaconcino',
  gocce: 'Gocce',
  sciroppo: 'Sciroppo',
  cerotto: 'Cerotto',
  inalatore: 'Inalatore',
  iniezione: 'Iniezione',
  altro: 'Altro',
};

export const ICON_LABEL: Record<string, string> = {
  nessuno: 'Nessuna indicazione',
  digiuno: 'A digiuno',
  pieno: 'A stomaco pieno / durante i pasti',
  acqua: 'Con un bicchiere d’acqua',
  sciogliere: 'Da sciogliere in acqua',
  urinare: 'Dopo aver urinato',
  'non-masticare': 'Da non masticare',
  spezzare: 'Da spezzare',
};

export const COLORS = ['#F2D36B', '#E9A06B', '#FFFFFF', '#F7F3E8', '#CFE3B4', '#9DC7E8', '#BFD8EF', '#EBC9D6', '#C9B6E4', '#E8B04A'];
