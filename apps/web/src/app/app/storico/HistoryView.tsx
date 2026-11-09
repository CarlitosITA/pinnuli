'use client';

import type { buildHistory } from '@/server/caregiverState';
import { dateShort, timeOf, useLive } from '../ui';

type History = Awaited<ReturnType<typeof buildHistory>>;

const EVENT_LABEL: Record<string, string> = {
  taken: 'Presa',
  not_taken: 'Non presa',
  undo: 'Annullata',
};

export default function HistoryView() {
  const { data, error } = useLive<History>('/api/app/history');

  if (error && !data) return <p className="cg-error" role="alert">{error}</p>;
  if (!data) return <p aria-busy="true">Un momento…</p>;

  return (
    <>
      <div className="cg-top">
        <h1>Storico</h1>
      </div>

      <section className="cg-card" aria-label="Regolarità">
        <p className="cg-muted">Ultimi 14 giorni</p>
        <p className="cg-big" data-testid="adherence">
          {data.adherence == null ? '—' : `${data.adherence}%`}
        </p>
        <p>{data.adherence == null ? 'Ancora nessuna dose da contare.' : 'delle dosi risulta presa'}</p>
      </section>

      <section aria-label="Giorno per giorno">
        <h2>Giorno per giorno</h2>
        <ul className="cg-list" style={{ marginTop: '0.5rem' }}>
          {[...data.days].reverse().map((d) => {
            const pct = (n: number) => (d.total ? `${(n / d.total) * 100}%` : '0%');
            const parts = [
              `${d.taken} prese su ${d.total}`,
              d.late ? `${d.late} in ritardo` : '',
              d.notTaken ? `${d.notTaken} non prese` : '',
              d.missed ? `${d.missed} senza risposta` : '',
            ].filter(Boolean);
            return (
              <li key={d.day} className="cg-card">
                <div className="cg-row">
                  <h3>{d.day === data.today ? 'Oggi' : dateShort(d.day)}</h3>
                  <span className="cg-muted">{d.total ? parts.join(' · ') : 'Nessuna dose'}</span>
                </div>
                <div className="cg-bar" role="img" aria-label={parts.join(', ')} style={{ marginTop: '0.5rem' }}>
                  <i style={{ width: pct(d.taken), background: 'var(--pn-ok)' }} />
                  <i style={{ width: pct(d.notTaken), background: 'var(--pn-testo-2)' }} />
                  <i style={{ width: pct(d.missed), background: 'var(--pn-allarme)' }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Ultime conferme">
        <h2>Ultime conferme</h2>
        {data.events.length === 0 ? (
          <p className="cg-card" style={{ marginTop: '0.5rem' }}>Ancora nessuna conferma.</p>
        ) : (
          <ul className="cg-list" style={{ marginTop: '0.5rem' }}>
            {data.events.map((e) => (
              <li key={e.id} className="cg-card">
                <div className="cg-row">
                  <strong>
                    {EVENT_LABEL[e.type] ?? e.type}: {e.medication}
                  </strong>
                  <span className="cg-muted">{timeOf(e.at)}</span>
                </div>
                <p className="cg-muted">
                  {e.day ? `Prevista ${dateShort(e.day)} alle ${e.scheduled}` : ''}
                  {e.by ? ` · ${e.by}` : ''}
                  {e.reason ? ` · ${e.reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
