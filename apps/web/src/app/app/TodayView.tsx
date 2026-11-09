'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { quantityWords, type MedicationForm } from '@pinnuli/core';
import { Alert, Check, Clock, StatusDot } from '@/components/icons';
import type { CaregiverState, DoseCard } from '@/server/caregiverState';
import { ago, api, dateLong, timeOf, useLive, useToast } from './ui';

const STATUS: Record<string, { label: string; cls: string; dot: 'taken' | 'next' | 'late' | 'future' | 'skipped' }> = {
  taken: { label: 'Presa', cls: 'ok', dot: 'taken' },
  due: { label: 'Da confermare', cls: 'nx', dot: 'next' },
  snoozed: { label: 'Rimandata', cls: 'nx', dot: 'next' },
  missed: { label: 'Senza risposta', cls: 'lt', dot: 'late' },
  not_taken: { label: 'Non presa', cls: 'gr', dot: 'skipped' },
  scheduled: { label: 'In programma', cls: 'gr', dot: 'future' },
};

export default function TodayView() {
  const { data, error, reload } = useLive<CaregiverState>('/api/app/state');
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, type: 'taken' | 'not_taken' | 'undo', time?: string) {
    setBusy(key + type);
    try {
      await api('POST', `/api/app/doses/${encodeURIComponent(key)}`, { type, time });
      toast.show(type === 'taken' ? (time ? `Segnata come presa alle ${time}` : 'Segnata come presa') : type === 'undo' ? 'Annullato' : 'Segnata come non presa');
      await reload();
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function takeOver(id: string) {
    setBusy(id);
    try {
      await api('POST', `/api/app/alerts/${id}`);
      toast.show('Va bene, te ne occupi tu');
      await reload();
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const doseByKey = useMemo(() => new Map(data?.groups.flatMap((g) => g.doses).map((d) => [d.key, d]) ?? []), [data]);

  if (error && !data) return <p className="cg-error" role="alert">{error}</p>;
  if (!data) return <p aria-busy="true">Un momento…</p>;

  const tablet = data.devices.find((d) => d.kind === 'tablet') ?? data.devices[0];
  const lightIcon = data.light === 'ok' ? <Check size="2.25rem" stroke={5} /> : data.light === 'alert' ? <Alert size="2.25rem" /> : <Clock size="2.25rem" />;

  return (
    <>
      <div className="cg-top">
        <div>
          <h1>{data.patient.name}</h1>
          <p className="sub">{dateLong(data.day)}</p>
        </div>
        <span className="cg-tag" aria-label={`${data.counts.taken} prese su ${data.counts.total}`}>
          {data.counts.taken} su {data.counts.total}
        </span>
      </div>

      <section className={`cg-card cg-light is-${data.light}`} aria-label="Come sta andando oggi">
        <div className="state" data-testid="light" data-light={data.light}>
          {lightIcon}
          <span>{data.lightText}</span>
        </div>
        <p className="detail">
          {data.lastTaken ? `Ultima: ${data.lastTaken.name} alle ${timeOf(data.lastTaken.at)}.` : 'Oggi non è stata ancora presa nessuna dose.'}{' '}
          {data.next ? `Prossima: ${data.next.name} alle ${data.next.localTime}.` : ''}
        </p>
      </section>

      {data.alerts.map((a) => {
        const dose = a.doseKey ? doseByKey.get(a.doseKey) : undefined;
        return (
          <section key={a.id} className="cg-alert" role="alert" data-testid="alert">
            <strong>{a.kind === 'dose-not-confirmed' ? 'Dose non confermata' : a.kind === 'battery' ? 'Batteria del tablet' : 'Tablet offline'}</strong>
            <p>{a.message}</p>
            <p className="meta">
              Avvisato {ago(a.createdAtMs, data.now)}
              {a.takenOverByName ? ` · ${a.takenOverByName} se ne sta occupando` : ''}
            </p>
            <div className="cg-actions">
              {dose && dose.status !== 'taken' ? (
                <button className="cg-btn ok" disabled={busy === dose.key + 'taken'} onClick={() => act(dose.key, 'taken')}>
                  L’ha presa
                </button>
              ) : null}
              {a.kind === 'dose-not-confirmed' && !a.takenOverBy ? (
                <button className="cg-btn" disabled={busy === a.id} onClick={() => takeOver(a.id)}>
                  Me ne occupo io
                </button>
              ) : null}
            </div>
          </section>
        );
      })}

      <section className="cg-card" aria-label="Tablet">
        {tablet ? (
          <div className="cg-row">
            <div>
              <h3>{tablet.name}</h3>
              <p className={tablet.health === 'online' ? 'cg-ok' : 'cg-error'} data-testid="tablet-status">
                {tablet.health === 'online' ? 'Collegato' : tablet.lastSeenMs ? `Offline da ${ago(tablet.lastSeenMs, data.now).replace(' fa', '')}` : 'Non ancora collegato'}
              </p>
            </div>
            <p className="cg-muted">
              {tablet.battery != null ? `Batteria ${tablet.battery}%${tablet.charging ? ' · in carica' : ''}` : ''}
              {tablet.audioOk === false ? ' · audio bloccato' : ''}
            </p>
          </div>
        ) : (
          <div className="cg-row">
            <p>Non c’è ancora un tablet collegato.</p>
            <Link className="cg-btn primary" href="/app/altro">
              Collega un tablet
            </Link>
          </div>
        )}
      </section>

      <h2>La giornata</h2>
      {data.patient.paused ? <p className="cg-card">La terapia è in pausa: nessun promemoria e nessun avviso.</p> : null}
      {data.groups.length === 0 ? <p className="cg-card">Oggi non ci sono dosi.</p> : null}
      {data.groups.map((g) => (
        <section key={g.id} className="cg-group" aria-label={`Dosi delle ${g.localTime}`}>
          {g.doses.map((d) => (
            <DoseRow key={d.key} d={d} busy={busy} act={act} />
          ))}
        </section>
      ))}
      {toast.node}
    </>
  );
}

function DoseRow({ d, busy, act }: { d: DoseCard; busy: string | null; act: (key: string, t: 'taken' | 'not_taken' | 'undo', time?: string) => void | Promise<void> }) {
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeVal, setTimeVal] = useState('');
  const st = STATUS[d.status] ?? STATUS.scheduled!;
  const q = quantityWords(d.quantity, d.medication.form as MedicationForm).text;
  return (
    <article className={`cg-dose is-${d.status}`} data-testid="dose" data-status={d.status}>
      <span className="tm">{d.localTime}</span>
      <div className="body">
        <div>
          <span className="nm">
            {d.medication.name}
            {d.medication.distinguishing ? ` ${d.medication.distinguishing}` : ''}
          </span>{' '}
          <span className="qt">· {q}</span>
          {d.medication.critical ? (
            <>
              {' '}
              <span className="cg-tag">Orario critico</span>
            </>
          ) : null}
        </div>
        <span className={`cg-chip ${st.cls}`}>
          <StatusDot kind={st.dot} size="1.125rem" />
          {st.label}
          {d.status === 'taken' && d.takenAt ? ` alle ${timeOf(d.takenAt)}` : ''}
          {d.status === 'taken' && d.lateMin && d.lateMin >= 15 ? ` (+${d.lateMin} min)` : ''}
          {d.early ? ' (in anticipo)' : ''}
        </span>
        {d.conflict ? <span className="cg-note">Due versioni diverse: da verificare</span> : null}
        {d.changeNote ? <span className="cg-note">{d.changeNote}</span> : null}
        <div className="cg-actions">
          {d.status === 'taken' || d.status === 'not_taken' ? (
            <>
              <button className="cg-btn quiet" disabled={busy === d.key + 'undo'} onClick={() => act(d.key, 'undo')}>
                Annulla
              </button>
              {d.status === 'taken' ? (
                <button
                  className="cg-btn quiet"
                  aria-expanded={timeOpen}
                  onClick={() => {
                    setTimeOpen(!timeOpen);
                    setTimeVal(timeOf(d.takenAt ?? Date.now()));
                  }}
                >
                  Cambia l’ora
                </button>
              ) : null}
            </>
          ) : (
            <>
              {d.status !== 'scheduled' ? (
                <button className="cg-btn ok" disabled={busy === d.key + 'taken'} onClick={() => act(d.key, 'taken', d.localTime)} data-testid="taken-on-time">
                  Presa alle {d.localTime}
                </button>
              ) : (
                <button className="cg-btn ok" disabled={busy === d.key + 'taken'} onClick={() => act(d.key, 'taken')}>
                  Segna come presa
                </button>
              )}
              {d.status !== 'scheduled' ? (
                <button
                  className="cg-btn"
                  aria-expanded={timeOpen}
                  onClick={() => {
                    setTimeOpen(!timeOpen);
                    setTimeVal(timeOf(Date.now()));
                  }}
                >
                  Presa a un’altra ora
                </button>
              ) : null}
              {d.status !== 'scheduled' ? (
                <button className="cg-btn quiet" disabled={busy === d.key + 'not_taken'} onClick={() => act(d.key, 'not_taken')}>
                  Non presa
                </button>
              ) : null}
            </>
          )}
        </div>
        {timeOpen && d.status !== 'not_taken' ? (
          <form
            className="cg-actions"
            onSubmit={async (e) => {
              e.preventDefault();
              await act(d.key, 'taken', timeVal);
              setTimeOpen(false);
            }}
          >
            <label htmlFor={`t-${d.key}`}>A che ora l’ha presa?</label>
            <input id={`t-${d.key}`} type="time" value={timeVal} onChange={(e) => setTimeVal(e.target.value)} required />
            <button className="cg-btn ok" type="submit">
              Conferma l’ora
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}
