'use client';

import { useEffect, useState } from 'react';
import { MOMENTS, type MomentKey } from '@pinnuli/core';
import type { CaregiverState } from '@/server/caregiverState';
import { ago, api, Field, useLive, useToast } from '../ui';
import { MOMENT_NAME } from '../terapia/therapy-text';

interface TherapySlice {
  patient: {
    name: string;
    paused: boolean;
    routine: Record<MomentKey, string>;
    settings: { debounceMs: number; holdToConfirm: boolean; textLevel: 'grande' | 'moltoGrande' | 'enorme' };
  };
}
interface TelegramState {
  configured: boolean;
  linked: boolean;
  bot: string | null;
}

const TEXT_LEVELS = [
  { v: 'grande', t: 'Grande' },
  { v: 'moltoGrande', t: 'Molto grande' },
  { v: 'enorme', t: 'Enorme' },
] as const;

export default function MoreView() {
  const state = useLive<CaregiverState>('/api/app/state');
  const therapy = useLive<TherapySlice>('/api/app/therapy');
  const toast = useToast();
  const [tg, setTg] = useState<TelegramState | null>(null);
  const [tgLink, setTgLink] = useState<{ code: string; link: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [devName, setDevName] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [routine, setRoutine] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const loadTg = () => api<TelegramState>('GET', '/api/app/telegram').then(setTg).catch(() => setTg(null));
  useEffect(() => {
    void loadTg();
  }, []);

  const p = therapy.data?.patient;
  useEffect(() => {
    if (p && !loaded) {
      setName(p.name);
      setRoutine(p.routine);
      setLoaded(true);
    }
  }, [p, loaded]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.show(ok);
      await Promise.all([state.reload(), therapy.reload()]);
    } catch (e) {
      toast.show((e as Error).message);
    }
  }

  const patch = (body: unknown, ok = 'Salvato') => run(() => api('PATCH', '/api/app/patient', body), ok);

  if (!state.data || !p) return <p aria-busy="true">Un momento…</p>;

  return (
    <>
      <div className="cg-top">
        <h1>Altro</h1>
      </div>

      <section className="cg-card" aria-labelledby="h-dev">
        <h2 id="h-dev">Tablet e telefoni</h2>
        {state.data.devices.length === 0 ? <p className="cg-muted">Nessun dispositivo collegato.</p> : null}
        <ul className="cg-list">
          {state.data.devices.map((d) => (
            <li key={d.id} className="cg-row">
              <div>
                <h3>{d.name}</h3>
                <p className="cg-muted">
                  {d.health === 'online' ? 'Collegato' : d.lastSeenMs ? `Visto ${ago(d.lastSeenMs, state.data!.now)}` : 'Mai collegato'}
                  {d.battery != null ? ` · batteria ${d.battery}%` : ''}
                </p>
              </div>
              <button
                className="cg-btn quiet"
                onClick={() => {
                  if (window.confirm(`Scollegare ${d.name}? Smetterà di mostrare i promemoria.`)) {
                    void run(() => api('DELETE', `/api/app/devices/${d.id}`), 'Dispositivo scollegato');
                  }
                }}
              >
                Scollega
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api('POST', '/api/app/devices', { code: code.trim(), name: devName.trim() || undefined });
              setCode('');
              setDevName('');
            }, 'Tablet collegato');
          }}
        >
          <Field label="Collega un nuovo tablet" hint="Sul tablet apri pinnuli.it/t: compare un codice di 6 cifre. Scrivilo qui." htmlFor="pair-code">
            <input id="pair-code" inputMode="numeric" autoComplete="off" placeholder="123 456" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Nome (facoltativo)" htmlFor="pair-name">
            <input id="pair-name" type="text" maxLength={40} placeholder="Tablet del soggiorno" value={devName} onChange={(e) => setDevName(e.target.value)} />
          </Field>
          <button className="cg-btn primary" type="submit" style={{ marginTop: '0.75rem' }}>
            Collega
          </button>
        </form>
      </section>

      <section className="cg-card" aria-labelledby="h-tg">
        <h2 id="h-tg">Avvisi su Telegram</h2>
        {tg && !tg.configured ? (
          <p className="cg-muted">Il bot Telegram non è ancora configurato sul server. Quando lo sarà, qui potrai collegarti.</p>
        ) : tg?.linked ? (
          <>
            <p className="cg-ok">Collegato: gli avvisi arrivano su Telegram.</p>
            <button className="cg-btn quiet" onClick={() => void run(async () => { await api('DELETE', '/api/app/telegram'); await loadTg(); }, 'Telegram scollegato')}>
              Scollega Telegram
            </button>
          </>
        ) : (
          <>
            <p className="cg-muted">Se la dose non viene confermata, ricevi un messaggio con i tasti “L’ha presa” e “Me ne occupo io”.</p>
            {tgLink ? (
              tgLink.link ? (
                <a className="cg-btn primary" href={tgLink.link} target="_blank" rel="noreferrer">
                  Apri Telegram
                </a>
              ) : (
                <p>Scrivi al bot: <strong>/start {tgLink.code}</strong></p>
              )
            ) : (
              <button
                className="cg-btn primary"
                onClick={() => void run(async () => setTgLink(await api('POST', '/api/app/telegram')), 'Codice pronto')}
              >
                Collega Telegram
              </button>
            )}
          </>
        )}
      </section>

      <section className="cg-card" aria-labelledby="h-pat">
        <h2 id="h-pat">Per {p.name}</h2>
        <Field label="Nome" htmlFor="p-name">
          <input id="p-name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button className="cg-btn" disabled={!name.trim() || name === p.name} onClick={() => void patch({ name: name.trim() })}>
          Salva il nome
        </button>

        <Field label="Grandezza del testo sul tablet" htmlFor="p-text">
          <select id="p-text" value={p.settings.textLevel} onChange={(e) => void patch({ settings: { textLevel: e.target.value } })}>
            {TEXT_LEVELS.map((l) => (
              <option key={l.v} value={l.v}>
                {l.t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Attesa prima che il tasto risponda" hint="Più lunga se la mano trema molto: evita i tocchi involontari." htmlFor="p-deb">
          <select id="p-deb" value={p.settings.debounceMs} onChange={(e) => void patch({ settings: { debounceMs: Number(e.target.value) } })}>
            {[500, 800, 1200, 1600, 2000].map((ms) => (
              <option key={ms} value={ms}>
                {ms / 1000} secondi
              </option>
            ))}
          </select>
        </Field>

        <label className="cg-switch">
          <input type="checkbox" checked={p.settings.holdToConfirm} onChange={(e) => void patch({ settings: { holdToConfirm: e.target.checked } })} />
          <span>
            <strong>Tieni premuto per confermare</strong>
            <br />
            <span className="cg-muted">Il tasto “L’ho presa” si conferma tenendolo premuto un istante. Utile contro i tocchi per sbaglio.</span>
          </span>
        </label>

        <label className="cg-switch">
          <input type="checkbox" checked={p.paused} onChange={(e) => void patch({ paused: e.target.checked }, e.target.checked ? 'Terapia in pausa' : 'Terapia riattivata')} />
          <span>
            <strong>Metti in pausa i promemoria</strong>
            <br />
            <span className="cg-muted">Per un ricovero o un viaggio: niente promemoria e niente avvisi finché non la riattivi.</span>
          </span>
        </label>

        <Field label="PIN del menu sul tablet (4 cifre)" hint="Serve per aprire il menu nascosto tenendo premuto il logo." htmlFor="p-pin">
          <input id="p-pin" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <button
          className="cg-btn"
          disabled={pin.length !== 4}
          onClick={() => void run(async () => { await api('PATCH', '/api/app/patient', { pin }); setPin(''); }, 'PIN cambiato')}
        >
          Cambia il PIN
        </button>
      </section>

      <section className="cg-card" aria-labelledby="h-routine">
        <h2 id="h-routine">Orari di tutti i giorni</h2>
        <p className="cg-muted">Le dosi “prima di pranzo” o “dopo cena” seguono questi orari. Cambiarli vale da adesso in poi.</p>
        {MOMENTS.map((m) => (
          <Field key={m} label={MOMENT_NAME[m]} htmlFor={`r-${m}`}>
            <input id={`r-${m}`} type="time" value={routine[m] ?? ''} onChange={(e) => setRoutine({ ...routine, [m]: e.target.value })} />
          </Field>
        ))}
        <button
          className="cg-btn primary"
          style={{ marginTop: '0.75rem' }}
          onClick={() => void patch({ routine: Object.fromEntries(Object.entries(routine).filter(([, v]) => /^\d{2}:\d{2}$/.test(v))) }, 'Orari salvati')}
        >
          Salva gli orari
        </button>
      </section>

      <button
        className="cg-btn quiet"
        onClick={async () => {
          await api('POST', '/api/auth/logout');
          window.location.href = '/login';
        }}
      >
        Esci
      </button>
      {toast.node}
    </>
  );
}
