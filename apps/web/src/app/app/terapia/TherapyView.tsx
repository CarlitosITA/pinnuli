'use client';

import { useMemo, useState } from 'react';
import {
  INSTRUCTION_ICONS,
  MEDICATION_FORMS,
  MOMENTS,
  QUANTITY_CHOICES,
  quantityWords,
  type DaysSpec,
  type InstructionIcon,
  type MedicationForm,
  type MomentKey,
  type Timing,
} from '@pinnuli/core';
import { Pill } from '@/components/Pill';
import type { buildTherapyView } from '@/server/caregiverState';
import { api, dateLong, Field, Sheet, useLive, useToast } from '../ui';
import { COLORS, FORM_LABEL, ICON_LABEL, MOMENT_NAME, ruleText, timingText } from './therapy-text';

type TherapyData = Awaited<ReturnType<typeof buildTherapyView>>;
type Med = TherapyData['medications'][number];
type Rule = Med['rules'][number];

const addDaysStr = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

export default function TherapyView() {
  const { data, error, reload } = useLive<TherapyData>('/api/app/therapy');
  const toast = useToast();
  const [sheet, setSheet] = useState<
    | { k: 'med'; med?: Med }
    | { k: 'rule'; med: Med; rule?: Rule }
    | { k: 'override' }
    | { k: 'routine' }
    | null
  >(null);

  const done = async (msg: string) => {
    setSheet(null);
    toast.show(msg);
    await reload();
  };

  if (error && !data) return <p className="cg-error" role="alert">{error}</p>;
  if (!data) return <p aria-busy="true">Un momento…</p>;

  const active = data.medications.filter((m) => m.status === 'active');
  const suspended = data.medications.filter((m) => m.status === 'suspended');
  const medName = (id?: string | null) => data.medications.find((m) => m.id === id)?.name ?? '';

  async function setStatus(m: Med, status: 'active' | 'suspended') {
    try {
      await api('PATCH', `/api/app/medications/${m.id}`, { status });
      toast.show(status === 'suspended' ? `${m.name} sospeso` : `${m.name} di nuovo attivo`);
      await reload();
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  async function removeOverride(id: string) {
    try {
      await api('DELETE', `/api/app/overrides/${id}`);
      toast.show('Variazione tolta: torna la terapia di base');
      await reload();
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  const overrideText = (o: TherapyData['overrides'][number]) => {
    const period = o.kind === 'once' ? 'solo oggi' : `dal ${dateShortDM(o.from)} al ${dateShortDM(o.to)}`;
    const target = o.target.all ? 'tutta la terapia' : o.target.medicationId ? medName(o.target.medicationId) : ruleLabel(data, o.target.ruleId);
    switch (o.kind) {
      case 'suspend':
        return `${target}: sospesa ${period}`;
      case 'quantity':
        return `${target}: quantità ${o.quantity} ${period}`;
      case 'time':
        return `${target}: alle ${o.time} ${period}`;
      case 'add':
        return `${medName(o.medicationId)} alle ${o.time} ${period}`;
      case 'once':
        return `${medName(o.medicationId)} in più alle ${o.time}, ${period}`;
    }
  };

  return (
    <>
      <div className="cg-top">
        <h1>Terapia</h1>
        <button className="cg-btn primary" onClick={() => setSheet({ k: 'med' })} data-testid="new-med">
          Nuovo farmaco
        </button>
      </div>

      <div className="cg-actions">
        <button className="cg-btn" onClick={() => setSheet({ k: 'override' })} data-testid="new-override">
          Cambia per qualche giorno
        </button>
        <button className="cg-btn" onClick={() => setSheet({ k: 'routine' })} data-testid="routine">
          Oggi si mangia a un’altra ora
        </button>
      </div>

      {data.routineOverrides.length ? (
        <section className="cg-card" aria-label="Orari di oggi cambiati">
          <h3>Oggi, orari diversi dal solito</h3>
          <ul className="cg-list">
            {data.routineOverrides.map((r) => (
              <li key={r.moment}>
                {MOMENT_NAME[r.moment as MomentKey]} alle {r.time}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.overrides.length ? (
        <section className="cg-card" aria-label="Variazioni in corso" data-testid="overrides">
          <h2>Variazioni in corso</h2>
          <p className="cg-muted">Finiscono da sole alla data indicata e la terapia di base torna com’era.</p>
          <ul className="cg-list">
            {data.overrides.map((o) => (
              <li key={o.id} className="cg-row">
                <span>
                  {overrideText(o)}
                  {o.reason ? <span className="cg-muted"> · {o.reason}</span> : null}
                </span>
                <button className="cg-btn quiet" onClick={() => removeOverride(o.id)}>
                  Togli
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2>Farmaci attivi</h2>
      {active.length === 0 ? <p className="cg-card">Nessun farmaco attivo. Aggiungi il primo con «Nuovo farmaco».</p> : null}
      {active.map((m) => (
        <MedCard key={m.id} m={m} onEdit={() => setSheet({ k: 'med', med: m })} onRule={(r) => setSheet({ k: 'rule', med: m, rule: r })} onToggle={() => setStatus(m, 'suspended')} />
      ))}

      {suspended.length ? (
        <>
          <h2>Sospesi</h2>
          <p className="cg-muted">Restano in archivio: si riattivano con un tocco.</p>
          {suspended.map((m) => (
            <MedCard key={m.id} m={m} onEdit={() => setSheet({ k: 'med', med: m })} onRule={(r) => setSheet({ k: 'rule', med: m, rule: r })} onToggle={() => setStatus(m, 'active')} />
          ))}
        </>
      ) : null}

      {sheet?.k === 'med' ? <MedSheet med={sheet.med} today={data.today} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {sheet?.k === 'rule' ? <RuleSheet med={sheet.med} rule={sheet.rule} today={data.today} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {sheet?.k === 'override' ? <OverrideSheet data={data} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {sheet?.k === 'routine' ? <RoutineSheet data={data} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {toast.node}
    </>
  );
}

function dateShortDM(day: string) {
  const [, m, d] = day.split('-');
  return `${Number(d)}/${Number(m)}`;
}

function ruleLabel(data: TherapyData, ruleId?: string) {
  for (const m of data.medications) {
    const r = m.rules.find((x) => x.id === ruleId);
    if (r) return `${m.name} ${timingText(r.timing)}`;
  }
  return 'una dose';
}

/* ───────── Scheda farmaco ───────── */

function MedCard({ m, onEdit, onRule, onToggle }: { m: Med; onEdit: () => void; onRule: (r?: Rule) => void; onToggle: () => void }) {
  return (
    <article className="cg-card" data-testid="med" data-name={m.name}>
      <div className="cg-row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
        <span style={{ width: '3.5rem', height: '3.5rem', flex: 'none' }}>
          <Pill form={m.form} color={m.color} size="100%" label="" />
        </span>
        <div style={{ flex: 1 }}>
          <h3>
            {m.name}
            {m.distinguishing ? ` ${m.distinguishing}` : ''}
          </h3>
          <p className="cg-muted">
            {FORM_LABEL[m.form] ?? m.form}
            {m.critical ? ' · ' : ''}
            {m.critical ? <span className="cg-tag">Orario critico</span> : null}
            {m.status === 'suspended' ? ' · Sospeso' : ''}
          </p>
        </div>
      </div>
      <ul className="cg-list">
        {m.rules.map((r) => (
          <li key={r.id}>
            <button className="cg-btn quiet block" style={{ justifyContent: 'space-between', textAlign: 'left' }} onClick={() => onRule(r)} aria-label={`Modifica: ${ruleText(r, m.form)}`}>
              <span>{ruleText(r, m.form)}</span>
              <span aria-hidden="true">Modifica</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="cg-actions">
        <button className="cg-btn" onClick={() => onRule()}>
          Aggiungi un orario
        </button>
        <button className="cg-btn" onClick={onEdit}>
          Modifica farmaco
        </button>
        <button className="cg-btn quiet" onClick={onToggle}>
          {m.status === 'active' ? 'Sospendi' : 'Riattiva'}
        </button>
      </div>
    </article>
  );
}

/* ───────── Orario (regola) ───────── */

interface RuleDraft {
  quantity: number;
  kind: 'fixed' | 'routine' | 'wake';
  time: string;
  moment: MomentKey;
  offset: number;
  daysKind: 'daily' | 'weekdays' | 'everyN';
  weekdays: number[];
  everyN: number;
  endDate: string;
  note: string;
}

const emptyRule = (): RuleDraft => ({ quantity: 1, kind: 'fixed', time: '08:00', moment: 'pranzo', offset: -15, daysKind: 'daily', weekdays: [0, 1, 2, 3, 4], everyN: 2, endDate: '', note: '' });

function draftFromRule(r: Rule): RuleDraft {
  const d = emptyRule();
  d.quantity = r.quantity;
  if (r.timing.kind === 'fixed') {
    d.kind = 'fixed';
    d.time = r.timing.time;
  } else if (r.timing.kind === 'routine') {
    d.kind = 'routine';
    d.moment = r.timing.moment;
    d.offset = r.timing.offsetMin;
  } else if (r.timing.kind === 'wake') d.kind = 'wake';
  if (r.days.kind === 'weekdays') {
    d.daysKind = 'weekdays';
    d.weekdays = r.days.days;
  } else if (r.days.kind === 'everyN') {
    d.daysKind = 'everyN';
    d.everyN = r.days.n;
  }
  d.endDate = r.endDate ?? '';
  d.note = r.note ?? '';
  return d;
}

function draftToInput(d: RuleDraft, today: string) {
  const timing: Timing = d.kind === 'fixed' ? { kind: 'fixed', time: d.time } : d.kind === 'wake' ? { kind: 'wake' } : { kind: 'routine', moment: d.moment, offsetMin: d.offset };
  const days: DaysSpec = d.daysKind === 'daily' ? { kind: 'daily' } : d.daysKind === 'weekdays' ? { kind: 'weekdays', days: d.weekdays } : { kind: 'everyN', n: d.everyN, anchor: today };
  return { quantity: d.quantity, timing, days, endDate: d.endDate || null, note: d.note.trim() || null };
}

const WD_LABEL = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function RuleFields({ value, onChange, form, id }: { value: RuleDraft; onChange: (v: RuleDraft) => void; form: MedicationForm; id: string }) {
  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Field label="Quanta" htmlFor={`${id}-q`} hint="Le frazioni si vedono disegnate sul tablet.">
        <select id={`${id}-q`} value={value.quantity} onChange={(e) => set('quantity', Number(e.target.value))}>
          {(QUANTITY_CHOICES.includes(value.quantity) ? QUANTITY_CHOICES : [...QUANTITY_CHOICES, value.quantity]).map((q) => (
            <option key={q} value={q}>
              {quantityWords(q, form).text}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quando" htmlFor={`${id}-k`}>
        <select id={`${id}-k`} value={value.kind} onChange={(e) => set('kind', e.target.value as RuleDraft['kind'])}>
          <option value="fixed">A un’ora precisa</option>
          <option value="routine">Legata a un pasto</option>
          <option value="wake">Al risveglio</option>
        </select>
      </Field>
      {value.kind === 'fixed' ? (
        <Field label="Ora" htmlFor={`${id}-t`}>
          <input id={`${id}-t`} type="time" value={value.time} onChange={(e) => set('time', e.target.value)} required />
        </Field>
      ) : null}
      {value.kind === 'routine' ? (
        <>
          <Field label="Momento" htmlFor={`${id}-m`}>
            <select id={`${id}-m`} value={value.moment} onChange={(e) => set('moment', e.target.value as MomentKey)}>
              {MOMENTS.filter((m) => m !== 'risveglio').map((m) => (
                <option key={m} value={m}>
                  {MOMENT_NAME[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prima o dopo" htmlFor={`${id}-o`} hint="Se oggi si mangia a un’altra ora, la dose si sposta da sola.">
            <select id={`${id}-o`} value={value.offset} onChange={(e) => set('offset', Number(e.target.value))}>
              {[-60, -30, -15, 0, 15, 30, 60, 90, 120].map((o) => (
                <option key={o} value={o}>
                  {o === 0 ? 'Proprio a quell’ora' : o < 0 ? `${-o} minuti prima` : `${o} minuti dopo`}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}
      {value.kind === 'wake' ? <p className="cg-muted">Il promemoria parte quando tocca «Buongiorno» sul tablet, o all’ora abituale del risveglio se non lo tocca.</p> : null}

      <Field label="In quali giorni" htmlFor={`${id}-d`}>
        <select id={`${id}-d`} value={value.daysKind} onChange={(e) => set('daysKind', e.target.value as RuleDraft['daysKind'])}>
          <option value="daily">Tutti i giorni</option>
          <option value="weekdays">Alcuni giorni della settimana</option>
          <option value="everyN">A giorni alterni</option>
        </select>
      </Field>
      {value.daysKind === 'weekdays' ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="lb" style={{ fontWeight: 700, marginBottom: '0.375rem' }}>
            Giorni
          </legend>
          <div className="cg-chips">
            {WD_LABEL.map((l, i) => (
              <label key={l}>
                <input
                  type="checkbox"
                  checked={value.weekdays.includes(i)}
                  onChange={(e) => set('weekdays', e.target.checked ? [...value.weekdays, i].sort() : value.weekdays.filter((x) => x !== i))}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {value.daysKind === 'everyN' ? (
        <Field label="Ogni quanti giorni" htmlFor={`${id}-n`}>
          <input id={`${id}-n`} type="number" min={2} max={30} value={value.everyN} onChange={(e) => set('everyN', Number(e.target.value))} />
        </Field>
      ) : null}

      <Field label="Fino a quando (facoltativo)" htmlFor={`${id}-e`} hint="Per un antibiotico: l’ultimo giorno. Il giorno dopo la dose sparisce da sola.">
        <input id={`${id}-e`} type="date" value={value.endDate} onChange={(e) => set('endDate', e.target.value)} />
      </Field>
      <Field label="Nota per questa dose (facoltativa)" htmlFor={`${id}-note`} hint="Esempio: «Dopo cena» o «Mezza compressa: spezzala lungo la linea».">
        <input id={`${id}-note`} type="text" maxLength={200} value={value.note} onChange={(e) => set('note', e.target.value)} />
      </Field>
    </div>
  );
}

function RuleSheet({ med, rule, today, onClose, onSaved }: { med: Med; rule?: Rule; today: string; onClose: () => void; onSaved: (m: string) => void }) {
  const [draft, setDraft] = useState<RuleDraft>(rule ? draftFromRule(rule) : emptyRule());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = draftToInput(draft, today);
      if (rule) await api('PATCH', `/api/app/rules/${rule.id}`, body);
      else await api('POST', `/api/app/medications/${med.id}/rules`, body);
      onSaved(rule ? 'Orario salvato' : 'Orario aggiunto');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!rule) return;
    setBusy(true);
    try {
      await api('DELETE', `/api/app/rules/${rule.id}`);
      onSaved('Orario tolto');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={rule ? `Orario di ${med.name}` : `Nuovo orario per ${med.name}`} onClose={onClose}>
      <form onSubmit={save} style={{ display: 'grid', gap: '1rem' }}>
        <RuleFields value={draft} onChange={setDraft} form={med.form as MedicationForm} id="rule" />
        <p className="cg-muted">La modifica vale da adesso in avanti: le dosi già passate non cambiano.</p>
        {error ? <p className="cg-error" role="alert">{error}</p> : null}
        <div className="cg-actions">
          <button className="cg-btn primary" type="submit" disabled={busy}>
            Salva
          </button>
          {rule ? (
            <button className="cg-btn danger" type="button" onClick={remove} disabled={busy}>
              Togli questo orario
            </button>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}

/* ───────── Farmaco ───────── */

function MedSheet({ med, today, onClose, onSaved }: { med?: Med; today: string; onClose: () => void; onSaved: (m: string) => void }) {
  const [name, setName] = useState(med?.name ?? '');
  const [distinguishing, setDistinguishing] = useState(med?.distinguishing ?? '');
  const [form, setForm] = useState<MedicationForm>((med?.form as MedicationForm) ?? 'compressa');
  const [color, setColor] = useState(med?.color ?? COLORS[0]!);
  const [critical, setCritical] = useState(med?.critical ?? false);
  const [ifForgotten, setIfForgotten] = useState(med?.ifForgotten ?? 'ask');
  const [icon, setIcon] = useState<InstructionIcon>(med?.instructions[0]?.icon ?? 'nessuno');
  const [instrText, setInstrText] = useState(med?.instructions[0]?.text ?? '');
  const [rules, setRules] = useState<RuleDraft[]>([emptyRule()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const instructions = icon !== 'nessuno' || instrText.trim() ? [{ icon, text: instrText.trim() || ICON_LABEL[icon]! }] : [];
    const medication = { name: name.trim(), distinguishing: distinguishing.trim() || null, form, color, critical, ifForgotten, instructions };
    try {
      if (med) {
        await api('PATCH', `/api/app/medications/${med.id}`, medication);
        onSaved('Farmaco salvato');
      } else {
        await api('POST', '/api/app/medications', { medication, rules: rules.map((r) => draftToInput(r, today)) });
        onSaved('Farmaco aggiunto');
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={med ? `Modifica ${med.name}` : 'Nuovo farmaco'} onClose={onClose}>
      <form onSubmit={save} style={{ display: 'grid', gap: '1rem' }} noValidate>
        <Field label="Nome come sulla scatola" htmlFor="m-name">
          <input id="m-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Parola che lo distingue (facoltativa)" htmlFor="m-dist" hint="Esempio: RETARD. Farmaci simili sono farmaci diversi: sul tablet la parola risalta.">
          <input id="m-dist" type="text" value={distinguishing} onChange={(e) => setDistinguishing(e.target.value)} />
        </Field>
        <Field label="Forma" htmlFor="m-form">
          <select id="m-form" value={form} onChange={(e) => setForm(e.target.value as MedicationForm)}>
            {MEDICATION_FORMS.map((f) => (
              <option key={f} value={f}>
                {FORM_LABEL[f]}
              </option>
            ))}
          </select>
        </Field>
        <div className="cg-field">
          <span className="lb">Colore del disegno</span>
          <div className="cg-chips" role="radiogroup" aria-label="Colore del disegno">
            {COLORS.map((c) => (
              <label key={c} style={{ padding: 0, minWidth: 0, border: 0 }}>
                <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} />
                <span
                  className="cg-swatch"
                  style={{ background: c, display: 'block', outline: color === c ? '4px solid var(--pn-testo)' : 'none', outlineOffset: 2 }}
                  title={c}
                />
                <span style={{ position: 'absolute', left: '-999px' }}>Colore {c}</span>
              </label>
            ))}
          </div>
          <span style={{ width: '4rem', height: '4rem' }} aria-hidden="true">
            <Pill form={form} color={color} size="100%" label="" />
          </span>
        </div>
        <label className="cg-switch">
          <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
          <span>
            <strong>Orario critico</strong>
            <br />
            <span className="cg-muted">Promemoria più insistenti e avviso ai familiari più in fretta (dopo 20 minuti invece di 45). Per la levodopa, l’insulina, gli anticoagulanti.</span>
          </span>
        </label>
        <Field label="Se una dose viene dimenticata" htmlFor="m-forgot" hint="Lo decidi tu in base a medico e bugiardino: Pìnnuli non dà indicazioni cliniche.">
          <select id="m-forgot" value={ifForgotten} onChange={(e) => setIfForgotten(e.target.value as 'asap' | 'skip' | 'ask')}>
            <option value="ask">Di’ di chiedere a un familiare</option>
            <option value="asap">Di’ di prenderla appena possibile</option>
            <option value="skip">Di’ di saltarla e prendere la prossima</option>
          </select>
        </Field>
        <Field label="Indicazione sempre valida (facoltativa)" htmlFor="m-icon">
          <select id="m-icon" value={icon} onChange={(e) => setIcon(e.target.value as InstructionIcon)}>
            {INSTRUCTION_ICONS.map((i) => (
              <option key={i} value={i}>
                {ICON_LABEL[i]}
              </option>
            ))}
          </select>
        </Field>
        {icon !== 'nessuno' || instrText ? (
          <Field label="Frase sul tablet" htmlFor="m-itext" hint="Scrivila come un’azione, al presente: «Sciogli la bustina in un bicchiere d’acqua.»">
            <input id="m-itext" type="text" maxLength={120} value={instrText} onChange={(e) => setInstrText(e.target.value)} placeholder={ICON_LABEL[icon]} />
          </Field>
        ) : null}

        {!med ? (
          <>
            <h3>Quando si prende</h3>
            {rules.map((r, i) => (
              <fieldset key={i} className="cg-card" style={{ margin: 0 }}>
                <legend className="lb" style={{ fontWeight: 700 }}>
                  Orario {rules.length > 1 ? i + 1 : ''}
                </legend>
                <RuleFields value={r} onChange={(v) => setRules(rules.map((x, j) => (j === i ? v : x)))} form={form} id={`nr${i}`} />
                {rules.length > 1 ? (
                  <button type="button" className="cg-btn quiet" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                    Togli questo orario
                  </button>
                ) : null}
              </fieldset>
            ))}
            <button type="button" className="cg-btn" onClick={() => setRules([...rules, emptyRule()])}>
              Aggiungi un altro orario
            </button>
          </>
        ) : null}

        {error ? <p className="cg-error" role="alert">{error}</p> : null}
        <button className="cg-btn primary block" type="submit" disabled={busy}>
          {med ? 'Salva' : 'Aggiungi il farmaco'}
        </button>
      </form>
    </Sheet>
  );
}

/* ───────── Cambia per qualche giorno ───────── */

const KINDS = [
  { id: 'suspend', label: 'Sospendi per qualche giorno' },
  { id: 'quantity', label: 'Cambia la quantità' },
  { id: 'time', label: 'Sposta un orario' },
  { id: 'add', label: 'Aggiungi un farmaco per qualche giorno' },
  { id: 'once', label: 'Una dose in più, solo oggi' },
] as const;

function OverrideSheet({ data, onClose, onSaved }: { data: TherapyData; onClose: () => void; onSaved: (m: string) => void }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('suspend');
  const [target, setTarget] = useState<string>('all');
  const [medId, setMedId] = useState(data.medications[0]?.id ?? '');
  const [from, setFrom] = useState(data.today);
  const [to, setTo] = useState(addDaysStr(data.today, 2));
  const [quantity, setQuantity] = useState(1);
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ruleOptions = useMemo(
    () => data.medications.filter((m) => m.status === 'active').flatMap((m) => m.rules.map((r) => ({ id: r.id, label: `${m.name} · ${timingText(r.timing)} · ${quantityWords(r.quantity, m.form as MedicationForm).text}` }))),
    [data],
  );
  const needsRule = kind === 'quantity' || kind === 'time';
  const ruleId = needsRule ? (target.startsWith('rule:') ? target.slice(5) : (ruleOptions[0]?.id ?? '')) : '';

  const summary = (() => {
    const period = kind === 'once' ? 'solo oggi' : `dal ${dateShortDM(from)} al ${dateShortDM(to)}`;
    const med = data.medications.find((m) => m.id === medId)?.name ?? '';
    if (kind === 'suspend') return `${target === 'all' ? 'Tutta la terapia' : (data.medications.find((m) => m.id === target.slice(4))?.name ?? '')} sospesa ${period}. Poi torna da sola.`;
    if (kind === 'quantity') return `${ruleOptions.find((r) => r.id === ruleId)?.label ?? ''}: nuova quantità ${quantity} ${period}. Poi torna quella di prima.`;
    if (kind === 'time') return `${ruleOptions.find((r) => r.id === ruleId)?.label ?? ''}: alle ${time} ${period}. Poi torna l’orario di prima.`;
    if (kind === 'add') return `${med} alle ${time} ${period}.`;
    return `${med} in più alle ${time}, solo oggi.`;
  })();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { kind, from, to: kind === 'once' ? from : to, reason: reason.trim() || null, target: {} };
      if (kind === 'suspend') body.target = target === 'all' ? { all: true } : { medicationId: target.slice(4) };
      if (needsRule) body.target = { ruleId };
      if (kind === 'quantity') body.quantity = quantity;
      if (kind === 'time') body.time = time;
      if (kind === 'add' || kind === 'once') {
        body.medicationId = medId;
        body.time = time;
        body.quantity = quantity;
      }
      await api('POST', '/api/app/overrides', body);
      onSaved('Variazione salvata');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title="Cambia per qualche giorno" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'grid', gap: '1rem' }} noValidate>
        <p className="cg-muted">La terapia di base non si tocca: alla data di fine torna da sola com’era.</p>
        <Field label="Che cosa vuoi fare" htmlFor="o-kind">
          <select id="o-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        {kind === 'suspend' ? (
          <Field label="Che cosa sospendere" htmlFor="o-target">
            <select id="o-target" value={target.startsWith('med:') || target === 'all' ? target : 'all'} onChange={(e) => setTarget(e.target.value)}>
              <option value="all">Tutta la terapia (ricovero, viaggio)</option>
              {data.medications
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <option key={m.id} value={`med:${m.id}`}>
                    Solo {m.name}
                    {m.distinguishing ? ` ${m.distinguishing}` : ''}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        {needsRule ? (
          <Field label="Quale dose" htmlFor="o-rule">
            <select id="o-rule" value={ruleId} onChange={(e) => setTarget(`rule:${e.target.value}`)}>
              {ruleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind === 'add' || kind === 'once' ? (
          <Field label="Quale farmaco" htmlFor="o-med">
            <select id="o-med" value={medId} onChange={(e) => setMedId(e.target.value)}>
              {data.medications.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.distinguishing ? ` ${m.distinguishing}` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind === 'quantity' || kind === 'add' || kind === 'once' ? (
          <Field label="Quanta" htmlFor="o-q">
            <select id="o-q" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
              {QUANTITY_CHOICES.map((q) => (
                <option key={q} value={q}>
                  {q === 0.5 ? 'Mezza' : q === 0.25 ? 'Un quarto' : q === 0.75 ? 'Tre quarti' : q === 1.5 ? 'Una e mezza' : q}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind === 'time' || kind === 'add' || kind === 'once' ? (
          <Field label="Ora" htmlFor="o-time">
            <input id="o-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        ) : null}
        <Field label={kind === 'once' ? 'Giorno' : 'Dal giorno'} htmlFor="o-from">
          <input id="o-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </Field>
        {kind !== 'once' ? (
          <Field label="Fino al giorno (compreso)" htmlFor="o-to">
            <input id="o-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </Field>
        ) : null}
        <Field label="Motivo (facoltativo)" htmlFor="o-reason">
          <input id="o-reason" type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <p className="cg-card" data-testid="override-summary">
          {summary}
        </p>
        {error ? <p className="cg-error" role="alert">{error}</p> : null}
        <button className="cg-btn primary block" type="submit" disabled={busy}>
          Salva la variazione
        </button>
      </form>
    </Sheet>
  );
}

/* ───────── Oggi si mangia alle… ───────── */

function RoutineSheet({ data, onClose, onSaved }: { data: TherapyData; onClose: () => void; onSaved: (m: string) => void }) {
  const [moment, setMoment] = useState<MomentKey>('pranzo');
  const [time, setTime] = useState(data.patient.routine.pranzo);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const overridden = data.routineOverrides.some((r) => r.moment === moment);

  async function save(t: string | null) {
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/app/routine', { day: data.today, moment, time: t });
      onSaved(t ? 'Orario di oggi cambiato' : 'Tornato l’orario abituale');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title="Oggi si mangia a un’altra ora" onClose={onClose}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <p className="cg-muted">Vale solo per oggi, {dateLong(data.today)}. Le medicine legate al pasto (come il Peridon) si spostano da sole.</p>
        <Field label="Momento" htmlFor="r-moment">
          <select
            id="r-moment"
            value={moment}
            onChange={(e) => {
              const m = e.target.value as MomentKey;
              setMoment(m);
              setTime(data.routineOverrides.find((r) => r.moment === m)?.time ?? data.patient.routine[m]);
            }}
          >
            {MOMENTS.filter((m) => m !== 'risveglio').map((m) => (
              <option key={m} value={m}>
                {MOMENT_NAME[m]} (di solito {data.patient.routine[m]})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Oggi alle" htmlFor="r-time">
          <input id="r-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {error ? <p className="cg-error" role="alert">{error}</p> : null}
        <div className="cg-actions">
          <button className="cg-btn primary" onClick={() => save(time)} disabled={busy}>
            Salva per oggi
          </button>
          {overridden ? (
            <button className="cg-btn" onClick={() => save(null)} disabled={busy}>
              Rimetti l’orario abituale
            </button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
