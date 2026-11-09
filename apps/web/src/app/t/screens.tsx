'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { formatLocalTime, type DoseView, type GroupView, type PatientScreen } from '@pinnuli/core';
import { Alert, Bell, Check, Clock, InstructionGlyph, Logo, StatusDot } from '@/components/icons';
import { Pill } from '@/components/Pill';
import { PressButton } from '@/components/PressButton';
import { dateLabel, inWords, minutesWords, qty } from './format';
import type { PlanData } from './store';

export interface Touch {
  debounceMs: number;
  hold: boolean;
}

/* ───────── Pezzi comuni ───────── */

export function MedName({ v }: { v: DoseView }) {
  return (
    <span className="pt-med-name">
      {v.med.name}
      {v.med.distinguishing ? <b> {v.med.distinguishing.toLowerCase()}</b> : null}
    </span>
  );
}

export function MedBlock({ v, many, withDetails }: { v: DoseView; many: boolean; withDetails: boolean }) {
  const q = qty(v);
  const instr = v.med.instructions[0];
  return (
    <div>
      <div className="pt-med-row">
        <span className="pt-pill">
          {v.med.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.med.photoUrl} alt={`Confezione di ${v.med.name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Pill form={v.med.form} color={v.med.color} half={v.med.form === 'compressa' && v.dose.quantity === 0.5} size="100%" label={`${v.med.name}: ${q.text}`} />
          )}
        </span>
        <div>
          <MedName v={v} />
          <div className="pt-med-qty">{q.fractional ? <em>{q.text}</em> : q.text}</div>
        </div>
      </div>
      {withDetails && (instr || v.dose.note) ? (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
          {instr ? (
            <div className="instr">
              <InstructionGlyph icon={instr.icon} />
              <span>{instr.text}</span>
            </div>
          ) : null}
          {v.dose.note && v.dose.note !== instr?.text ? <p>{v.dose.note}</p> : null}
          {v.dose.changeNote ? <span className="change">{v.dose.changeNote}</span> : null}
        </div>
      ) : null}
      {!many && !withDetails && v.dose.changeNote ? <span className="change">{v.dose.changeNote}</span> : null}
    </div>
  );
}

export function Head({
  plan,
  now,
  done,
  total,
  onLogoLongPress,
}: {
  plan: PlanData;
  now: number;
  done: number;
  total: number;
  onLogoLongPress: () => void;
}) {
  const tz = plan.patient.tz;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = () => {
    timer.current = setTimeout(onLogoLongPress, 3000);
  };
  const stop = () => clearTimeout(timer.current);
  return (
    <header className="pt-head">
      {/* Pressione lunga di 3 secondi: l'ingresso alle impostazioni del familiare. */}
      <button
        className="pt-brand"
        aria-label="Pìnnuli. Tieni premuto per 3 secondi per le impostazioni del familiare."
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Logo size="2.75rem" />
        <span>pìnnuli</span>
      </button>
      <div className="pt-clock">
        <time dateTime={new Date(now).toISOString()} data-testid="clock">
          {formatLocalTime(now, tz)}
        </time>
        <span data-testid="date">{dateLabel(now, tz)}</span>
      </div>
      <div className="pt-progress" aria-label={`${done} prese su ${total} oggi`}>
        <span>
          <strong>{done === 1 ? '1 presa' : `${done} prese`}</strong> su {total} oggi
        </span>
        <div className="pt-bar" aria-hidden="true">
          <i style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
        </div>
      </div>
    </header>
  );
}

/* ───────── Giornata (riposo) — P3 ───────── */

export function IdleScreen({
  plan,
  screen,
  now,
  linkOk,
  audioBlocked,
  tomorrowFirst,
  onEarly,
  onLogoLongPress,
  touch,
}: {
  plan: PlanData;
  screen: PatientScreen;
  now: number;
  linkOk: boolean;
  audioBlocked: boolean;
  tomorrowFirst: { time: string; names: string[] } | null;
  onEarly: () => void;
  onLogoLongPress: () => void;
  touch: Touch;
}) {
  const tz = plan.patient.tz;
  const all = screen.today.flatMap((g) => g.doses);
  const done = all.filter((d) => d.state.status === 'taken').length;
  const next = screen.next;
  const nextRef = useRef<HTMLLIElement | null>(null);
  const nextKey = next?.id ?? 'none';

  useEffect(() => {
    // La lista scorre da sola per tenere in vista la prossima dose.
    nextRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [nextKey]);

  const names = next ? next.doses : [];
  const many = names.length > 1;

  return (
    <main className="pt" data-screen="idle">
      <Head plan={plan} now={now} done={done} total={all.length} onLogoLongPress={onLogoLongPress} />
      <div className="pt-body">
        <div className="pt-left">
          <section className="pt-next" aria-live="polite">
            {plan.patient.paused ? (
              <>
                <span className="pt-kicker">In pausa</span>
                <p className="pt-reassure" style={{ marginTop: 0 }}>
                  Per ora non devi prendere niente. Ti avviso io quando si riparte.
                </p>
              </>
            ) : next ? (
              <>
                <span className="pt-kicker">{many ? `Prossime medicine · ${names.length} insieme` : 'Prossima medicina'}</span>
                <div className={`pt-next-meds ${many ? 'is-many' : ''}`}>
                  {names.slice(0, 3).map((v) => (
                    <MedBlock key={v.dose.key} v={v} many={many} withDetails={false} />
                  ))}
                </div>
                <div className="pt-when">
                  <strong>alle {next.localTime}</strong>
                  <span data-testid="next-in">{inWords(next.at, now)}</span>
                </div>
                <span className="pt-reassure">Ti avviso io quando è ora. Non devi fare niente adesso.</span>
              </>
            ) : screen.allResolved ? (
              <>
                <span className="pt-kicker">Per oggi hai finito</span>
                <p style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.15 }}>Le medicine di oggi sono finite. Bene così, {plan.patient.name}.</p>
                <p className="pt-reassure">
                  {tomorrowFirst ? `Domani la prima è alle ${tomorrowFirst.time}: ${tomorrowFirst.names.join(', ')}.` : 'Ti avviso io quando c’è la prossima.'}
                </p>
              </>
            ) : (
              <>
                <span className="pt-kicker">Oggi</span>
                <p style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.15 }}>Oggi non c’è nessuna medicina.</p>
              </>
            )}
          </section>
          {next && !plan.patient.paused ? (
            <PressButton className="pt-secondary" debounceMs={touch.debounceMs} hold={touch.hold} onPress={onEarly} data-testid="already-taken">
              <Check size="2.5rem" stroke={5} />
              L’ho già presa
            </PressButton>
          ) : null}
        </div>

        <section className="pt-list" aria-label="La tua giornata">
          <h2>La tua giornata</h2>
          <ol>
            {screen.today.map((g) => {
              const isNext = next?.id === g.id;
              return g.doses.map((d, i) => {
                const st = d.state.status;
                const kind = st === 'taken' ? 'taken' : st === 'not_taken' ? 'skipped' : st === 'missed' ? 'late' : isNext ? 'next' : st === 'due' ? 'late' : 'future';
                return (
                  <li
                    key={d.dose.key}
                    ref={isNext && i === 0 ? nextRef : undefined}
                    className={`${st === 'taken' || st === 'not_taken' ? 'is-done' : ''} ${isNext ? 'is-next' : ''} ${st === 'missed' || st === 'due' ? 'is-late' : ''}`}
                    data-status={st}
                  >
                    <StatusDot kind={kind as never} size="2.25rem" />
                    <span className="tm">{d.dose.localTime}</span>
                    <span className="nm">
                      {d.med.name}
                      {d.med.distinguishing ? ` ${d.med.distinguishing.toLowerCase()}` : ''}
                    </span>
                    <span className={`st ${st === 'taken' ? 'ok' : isNext ? 'nx' : st === 'missed' || st === 'due' ? 'lt' : ''}`}>
                      {st === 'taken' ? 'Presa' : st === 'not_taken' ? 'Non presa' : st === 'missed' ? 'Da confermare' : st === 'due' ? 'Adesso' : isNext ? 'Prossima' : ''}
                    </span>
                  </li>
                );
              });
            })}
          </ol>
          <div className="pt-list-foot">
            <span>
              {all.length - done > 0 ? `${all.length - done} ancora da prendere` : 'Tutto fatto per oggi'}
            </span>
            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {plan.contact ? `${plan.contact} è collegato` : ''}
            </span>
          </div>
        </section>
      </div>
      <footer className="pt-foot">
        <span className={linkOk ? '' : 'warn'} role="status">
          {linkOk ? '' : 'Non riesco a collegarmi. Le medicine funzionano lo stesso.'}
        </span>
        <span className={audioBlocked ? 'warn' : ''}>{audioBlocked ? 'Il suono è spento: tocca lo schermo per accenderlo.' : ''}</span>
      </footer>
    </main>
  );
}

/* ───────── Buongiorno — P2 ───────── */

export function WakeScreen({ plan, now, onWake, onLogoLongPress, touch }: { plan: PlanData; now: number; onWake: () => void; onLogoLongPress: () => void; touch: Touch }) {
  return (
    <main className="pt" data-screen="wake">
      <Head plan={plan} now={now} done={0} total={0} onLogoLongPress={onLogoLongPress} />
      <div className="pt-center">
        <h1>Buongiorno, {plan.patient.name}</h1>
        <p>Quando inizi la giornata, tocca il pulsante. Ti dico io qual è la prima medicina.</p>
      </div>
      <PressButton className="pt-take" debounceMs={touch.debounceMs} hold={touch.hold} onPress={onWake} data-testid="wake" style={{ flex: 'none', minHeight: '15rem', width: '100%' }}>
        <span className="big">BUONGIORNO!</span>
      </PressButton>
    </main>
  );
}

/* ───────── Promemoria — P4 / P5 ───────── */

export function ReminderScreen({
  plan,
  screen,
  now,
  onTakeAll,
  onSnooze,
  onSkip,
  onPick,
  touch,
}: {
  plan: PlanData;
  screen: PatientScreen;
  now: number;
  onTakeAll: () => void;
  onSnooze: () => void;
  onSkip: () => void;
  onPick: () => void;
  touch: Touch;
}) {
  const r = screen.reminder!;
  const pending = r.pending;
  const many = pending.length > 1;
  const late = r.minutesLate >= 15;
  const cfg = r.group.critical ? plan.patient.settings.reminder.critical : plan.patient.settings.reminder.normal;
  const toAlert = Math.max(0, cfg.firstAlertMin - r.minutesLate);
  const snoozeMin = cfg.snoozeMin;
  const contact = plan.contact ?? 'un familiare';
  const label = late ? 'NON ANCORA PRESA' : many ? 'È L’ORA DELLE MEDICINE' : 'È L’ORA DELLA MEDICINA';

  return (
    <main className={`pt pt--reminder ${late ? 'pt--late' : ''} ${r.insistent ? 'pn-pulsa-fast' : ''}`} data-screen="reminder" data-late={late}>
      <div className="pt-bar-top">
        <span className="lb">
          {late ? <Alert size="3rem" /> : <Bell size="3rem" />}
          {label}
        </span>
        <time data-testid="clock">{formatLocalTime(now, plan.patient.tz)}</time>
      </div>

      <div className="pt-rem">
        <div className={`pt-card ${many ? 'is-many' : ''}`} role="group" aria-label="Da prendere adesso">
          {pending.slice(0, 3).map((v) => (
            <MedBlock key={v.dose.key} v={v} many={many} withDetails={!many} />
          ))}
          {pending.length > 3 ? <p>… e altre {pending.length - 3}</p> : null}
          {late ? (
            <p>
              Sono passati <strong>{minutesWords(r.minutesLate)}</strong>. Se l’hai già {many ? 'prese' : 'presa'}, tocca il pulsante verde.
            </p>
          ) : null}
        </div>

        <div className="pt-actions">
          <PressButton className="pt-take" debounceMs={touch.debounceMs} hold={touch.hold} onPress={onTakeAll} data-testid="take">
            <Check />
            <span className="big">{many ? `LE HO PRESE TUTTE (${pending.length})` : 'L’HO PRESA'}</span>
            <span className="hint">{touch.hold ? 'tieni premuto per un secondo' : late ? 'adesso o poco fa' : 'tocca qui dopo averla presa'}</span>
          </PressButton>
          <div className={`pt-row2 ${!many && r.snoozeLeft === 0 ? 'is-single' : ''}`}>
            {many ? (
              <PressButton className="pt-ghost" debounceMs={touch.debounceMs} hold={false} onPress={onPick} data-testid="not-all">
                Non tutte
              </PressButton>
            ) : r.snoozeLeft > 0 ? (
              <PressButton className="pt-ghost" debounceMs={touch.debounceMs} hold={false} onPress={onSnooze} data-testid="snooze">
                <Clock size="2.25rem" />
                Tra {snoozeMin} minuti
              </PressButton>
            ) : null}
            {many ? (
              r.snoozeLeft > 0 ? (
                <PressButton className="pt-ghost is-soft" debounceMs={touch.debounceMs} hold={false} onPress={onSnooze} data-testid="snooze">
                  Tra {snoozeMin} minuti
                </PressButton>
              ) : (
                <span />
              )
            ) : (
              <PressButton className="pt-ghost is-soft" debounceMs={touch.debounceMs} hold={false} onPress={onSkip} data-testid="skip">
                Non la prendo
              </PressButton>
            )}
          </div>
        </div>
      </div>

      <footer className="pt-foot-msg">
        <span>{r.insistent ? 'Il suono si ripete finché non rispondi.' : 'Il suono si ripete se non rispondi.'}</span>
        <span>{toAlert > 0 ? `Se non rispondi entro ${toAlert} minuti avviso ${contact}.` : `Se non rispondi, ${contact} viene avvisato.`}</span>
      </footer>
    </main>
  );
}

/* ───────── Scelta singola nel gruppo — P6 ───────── */

export function PickScreen({
  group,
  now,
  tz,
  onTake,
  onSkipAll,
  onBack,
  touch,
}: {
  group: GroupView;
  now: number;
  tz: string;
  onTake: (v: DoseView) => void;
  onSkipAll: () => void;
  onBack: () => void;
  touch: Touch;
}) {
  return (
    <main className="pt pt--reminder" data-screen="pick">
      <div className="pt-bar-top">
        <span className="lb">QUALI HAI PRESO?</span>
        <time>{formatLocalTime(now, tz)}</time>
      </div>
      <div className="pt-pick">
        {group.doses.map((v) => {
          const done = v.state.status === 'taken';
          return (
            <PressButton key={v.dose.key} className={`item ${done ? 'is-done' : ''}`} debounceMs={touch.debounceMs} hold={false} onPress={() => !done && onTake(v)} data-testid={`pick-${v.med.name}`}>
              <span className="pt-pill">
                <Pill form={v.med.form} color={v.med.color} half={v.dose.quantity === 0.5} size="100%" label="" />
              </span>
              <span>
                {v.med.name}
                {v.med.distinguishing ? ` ${v.med.distinguishing.toLowerCase()}` : ''}
                <span className="qty">{qty(v).text}</span>
              </span>
              <span className="badge">{done ? '✓ Fatto' : 'Fatto'}</span>
            </PressButton>
          );
        })}
      </div>
      <div className="pt-row2">
        <PressButton className="pt-ghost is-white" debounceMs={touch.debounceMs} hold={false} onPress={onBack} data-testid="pick-back">
          Torna indietro
        </PressButton>
        <PressButton className="pt-ghost is-soft" debounceMs={touch.debounceMs} hold={false} onPress={onSkipAll}>
          Non le prendo
        </PressButton>
      </div>
    </main>
  );
}

/* ───────── Conferma avvenuta — P7 ───────── */

export function DoneScreen({
  plan,
  now,
  names,
  at,
  remaining,
  nextText,
  secondsLeft,
  onUndo,
  onOk,
  touch,
  early,
}: {
  plan: PlanData;
  now: number;
  names: string[];
  at: number;
  remaining: number;
  nextText: string | null;
  secondsLeft: number;
  onUndo: () => void;
  onOk: () => void;
  touch: Touch;
  early: boolean;
}) {
  const tz = plan.patient.tz;
  return (
    <main className="pt pt--done" data-screen="done">
      <div className="pt-bar-top">
        <span className="lb">SEGNATA</span>
        <time>{formatLocalTime(now, tz)}</time>
      </div>
      <div className="pt-done-body" role="status">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M12 25 L21 34 L37 15" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1>Fatto, {plan.patient.name}!</h1>
        <p>
          {names.join(' e ')} {names.length > 1 ? 'segnati' : 'segnato'} alle <strong>{formatLocalTime(at, tz)}</strong>
          {early ? ' (in anticipo)' : ''}.
        </p>
        {remaining > 0 ? <p className="sub">Ti resta ancora {remaining === 1 ? 'una medicina' : `${remaining} medicine`} di questo momento.</p> : nextText ? <p className="sub">{nextText}</p> : null}
      </div>
      <div className="pt-row-undo">
        <PressButton className="pt-ghost" debounceMs={touch.debounceMs} hold={false} onPress={onUndo} data-testid="undo">
          <span className="pt-count" aria-hidden="true">
            {secondsLeft}
          </span>
          Ho sbagliato, annulla
        </PressButton>
        <PressButton className="pt-ghost is-white" debounceMs={touch.debounceMs} hold={false} onPress={onOk} data-testid="ok">
          Va bene
        </PressButton>
      </div>
      <p style={{ textAlign: 'center', fontSize: '1.375rem', opacity: 0.9, margin: 0 }}>Tra {secondsLeft} secondi torno da solo alla tua giornata.</p>
    </main>
  );
}

/* ───────── Dose senza risposta — P9 ───────── */

export function MissedScreen({
  plan,
  group,
  now,
  onYes,
  onNo,
  touch,
}: {
  plan: PlanData;
  group: GroupView;
  now: number;
  onYes: () => void;
  onNo: () => void;
  touch: Touch;
}) {
  const open = group.doses.filter((d) => d.state.status === 'missed');
  const many = open.length > 1;
  const names = open.map((d) => d.med.name + (d.med.distinguishing ? ` ${d.med.distinguishing.toLowerCase()}` : ''));
  return (
    <main className="pt pt--question" data-screen="missed">
      <div className="pt-bar-top">
        <span className="lb">
          <Alert size="3rem" />
          NON CONFERMATA
        </span>
        <time>{formatLocalTime(now, plan.patient.tz)}</time>
      </div>
      <div className="pt-rem">
        <div className="pt-card">
          {open.slice(0, 3).map((v) => (
            <MedBlock key={v.dose.key} v={v} many={many} withDetails={false} />
          ))}
          <p>
            {many ? `Le ${names.join(' e ')} delle` : `Il ${names[0]} delle`} <strong>{group.localTime}</strong> non {many ? 'sono state confermate' : 'è stato confermato'}. {many ? 'Le hai prese' : 'L’hai presa'}?
          </p>
        </div>
        <div className="pt-actions">
          <PressButton className="pt-take" debounceMs={touch.debounceMs} hold={touch.hold} onPress={onYes} data-testid="missed-yes">
            <Check />
            <span className="big">SÌ, {many ? 'LE HO PRESE' : 'L’HO PRESA'}</span>
          </PressButton>
          <PressButton className="pt-ghost" debounceMs={touch.debounceMs} hold={false} onPress={onNo} data-testid="missed-no" style={{ minHeight: '7rem' }}>
            No, non {many ? 'le ho prese' : 'l’ho presa'}
          </PressButton>
        </div>
      </div>
      <footer className="pt-foot-msg">
        <span>Non prenderne due insieme: controlla bene prima di toccare.</span>
        <span>{plan.contact ? `${plan.contact} è stato avvisato.` : ''}</span>
      </footer>
    </main>
  );
}

/* ───────── "Non la prendo" — P8 e dose dimenticata ───────── */

export function SimpleChoice({
  title,
  body,
  tone = 'terracotta',
  now,
  tz,
  actions,
  children,
}: {
  title: string;
  body?: ReactNode;
  tone?: 'terracotta' | 'rubino';
  now: number;
  tz: string;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className={`pt pt--reminder ${tone === 'rubino' ? 'pt--late' : ''}`} data-screen="choice">
      <div className="pt-bar-top">
        <span className="lb">{title.toUpperCase()}</span>
        <time>{formatLocalTime(now, tz)}</time>
      </div>
      <div className="pt-center" style={{ gap: '1.25rem' }}>
        {body ? <p style={{ fontSize: '2.75rem', fontWeight: 700, lineHeight: 1.2 }}>{body}</p> : null}
        {children}
      </div>
      <div style={{ display: 'grid', gap: '1.25rem' }}>{actions}</div>
    </main>
  );
}

/* ───────── Collegamento — P1 ───────── */

export function PairScreen({ code, offline }: { code: string | null; offline: boolean }) {
  const spaced = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '… … …';
  return (
    <main className="pt" data-screen="pair">
      <header className="pt-head" style={{ gridTemplateColumns: '1fr' }}>
        <div className="pt-brand" style={{ justifySelf: 'center' }}>
          <Logo size="2.75rem" />
          <span>pìnnuli</span>
        </div>
      </header>
      <div className="pt-center">
        <p className="sub" style={{ fontSize: '2rem' }}>
          Questo tablet non è ancora collegato.
        </p>
        <div className="pt-code" data-testid="pair-code" aria-label={`Codice ${code?.split('').join(' ') ?? ''}`}>
          {spaced}
        </div>
        <p>Chiedi a un familiare di inserire questo codice nell’app Pìnnuli, alla voce «Altro» → «Collega un tablet».</p>
        {offline ? <p className="sub warn">Non riesco a collegarmi a internet.</p> : null}
      </div>
    </main>
  );
}

export function StaleScreen({ contact }: { contact: string | null }) {
  return (
    <main className="pt pt--question" data-screen="stale">
      <div className="pt-center">
        <Alert size="8rem" />
        <h1>Non riesco a collegarmi</h1>
        <p>{contact ? `Chiama ${contact}: ti dice lui quali medicine prendere.` : 'Chiama un familiare: ti dice lui quali medicine prendere.'}</p>
      </div>
    </main>
  );
}
