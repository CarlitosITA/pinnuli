'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  canTakeEarly,
  groupDoses,
  isNightTime,
  patientDay,
  reminderConfigFor,
  reminderSpeech,
  shouldRepeatSound,
  buildViews,
  formatLocalTime,
  type DoseView,
  type GroupView,
} from '@pinnuli/core';
import { PressButton } from '@/components/PressButton';
import { audioReady, playConfirmSound, playReminderChime, speak, stopSpeaking, unlockAudio } from './audio';
import { inWords, listLabel } from './format';
import { DoneScreen, IdleScreen, MissedScreen, NotifyScreen, PairScreen, PickScreen, ReminderScreen, SimpleChoice, StaleScreen, WakeScreen } from './screens';
import { clearShownNotifications, enableNotifications, isPhoneLike, needsInstall, notifState, type NotifState } from './notify';
import { useTablet } from './useTablet';

type Ui =
  | { k: 'none' }
  | { k: 'done'; keys: string[]; names: string[]; at: number; until: number; early: boolean }
  | { k: 'pick'; groupId: string }
  | { k: 'when'; views: DoseView[]; at: string }
  | { k: 'skip1'; keys: string[]; names: string[] }
  | { k: 'skip2'; keys: string[]; names: string[] }
  | { k: 'forgotten'; keys: string[]; names: string[]; mode: 'asap' | 'skip' | 'ask' }
  | { k: 'early'; text: string }
  | { k: 'pin'; digits: string; error: boolean }
  | { k: 'menu'; pin: string; confirmUnpair: boolean };

/** Da quanti minuti di ritardo si chiede «quando l'hai presa?» invece di segnare subito. */
const LATE_ASK_MIN = 15;

const REASONS = [
  { id: 'unavailable', label: 'Non ce l’ho' },
  { id: 'unwell', label: 'Mi sento male' },
  { id: 'other', label: 'Altro' },
] as const;

export default function TabletApp() {
  const t = useTablet();
  const { plan, screen, now, emit } = t;
  const [ui, setUi] = useState<Ui>({ k: 'none' });
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [notif, setNotif] = useState<NotifState>('checking');
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifLater, setNotifLater] = useState(true);
  const [installHint, setInstallHint] = useState(false);

  const settings = plan?.patient.settings;
  const touch = useMemo(() => ({ debounceMs: settings?.debounceMs ?? 800, hold: settings?.holdToConfirm ?? false }), [settings?.debounceMs, settings?.holdToConfirm]);
  const tz = plan?.patient.tz ?? 'Europe/Rome';

  // ─── tema notte automatico, dimensione del testo ───
  useEffect(() => {
    const night = isNightTime(now, tz);
    document.documentElement.dataset.tema = night ? 'notte' : 'giorno';
  }, [now, tz]);
  useEffect(() => {
    document.documentElement.dataset.testo = settings?.textLevel ?? 'grande';
  }, [settings?.textLevel]);

  // ─── service worker: l'app parte anche senza rete ───
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  // ─── avvisi sul telefono: solo per i telefoni, mai sul tablet a muro ───
  const paired = t.phase !== 'boot' && t.phase !== 'pair' && !!plan;
  useEffect(() => {
    setInstallHint(needsInstall());
    if (!paired || !isPhoneLike()) return;
    void notifState().then(setNotif);
    try {
      const until = Number(localStorage.getItem('pn_notif_later') ?? 0);
      setNotifLater(until > Date.now());
    } catch {
      setNotifLater(false);
    }
  }, [paired]);
  const reminderOn = screen?.mode === 'reminder';
  useEffect(() => {
    if (!reminderOn && paired) void clearShownNotifications();
  }, [reminderOn, paired]);

  // ─── schermo sempre acceso ───
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = async () => {
      try {
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        /* non concesso: il browser chiosco tiene comunque lo schermo acceso */
      }
    };
    void acquire();
    const onVis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, []);

  // ─── audio: il primo tocco lo sblocca ───
  useEffect(() => {
    const unlock = async () => {
      const ok = await unlockAudio();
      setAudioBlocked(!ok);
    };
    const onFirst = () => void unlock();
    document.addEventListener('pointerdown', onFirst);
    document.addEventListener('keydown', onFirst);
    setAudioBlocked(!audioReady());
    const id = setInterval(() => setAudioBlocked(!audioReady()), 5000);
    return () => {
      document.removeEventListener('pointerdown', onFirst);
      document.removeEventListener('keydown', onFirst);
      clearInterval(id);
    };
  }, []);

  // ─── suono e voce del promemoria (docs/04 § 4.3) ───
  const alarm = useRef<{ id: string | null; last: number | null; n: number }>({ id: null, last: null, n: 0 });
  useEffect(() => {
    if (!plan || !screen || screen.mode !== 'reminder' || ui.k !== 'none') {
      if (!screen || screen.mode !== 'reminder') alarm.current = { id: null, last: null, n: 0 };
      return;
    }
    const r = screen.reminder!;
    const cfg = reminderConfigFor({ critical: r.group.critical }, plan.patient.settings);
    if (alarm.current.id !== r.group.id) alarm.current = { id: r.group.id, last: null, n: 0 };
    if (!shouldRepeatSound(r.group.at, alarm.current.last, now, cfg)) return;
    alarm.current.last = now;
    const level = Math.min(1, 0.4 + 0.15 * alarm.current.n);
    alarm.current.n += 1;
    const ms = playReminderChime(level);
    const text = reminderSpeech(plan.patient.name, r.group.at, r.pending, plan.patient.tz);
    setTimeout(() => speak(text, Math.min(1, level + 0.2)), ms || 0);
  }, [plan, screen, ui.k, now]);

  // ─── azioni ───
  const goDone = useCallback(
    (views: DoseView[], early: boolean, onTime = false) => {
      // «All'ora giusta»: la dose si segna all'ora prevista, così non risulta in ritardo (e l'annulla, scritto dopo, la copre).
      const at = onTime ? Math.min(...views.map((v) => v.dose.scheduledAt)) : now;
      emit(views.map((v) => ({ type: 'taken' as const, doseKey: v.dose.key, at: onTime ? v.dose.scheduledAt : at })));
      playConfirmSound();
      stopSpeaking();
      navigator.vibrate?.(40);
      const secs = settings?.undoSeconds ?? 10;
      setUi({
        k: 'done',
        keys: views.map((v) => v.dose.key),
        names: views.map((v) => v.med.name + (v.med.distinguishing ? ` ${v.med.distinguishing.toLowerCase()}` : '')),
        at,
        until: now + secs * 1000, // il conto alla rovescia dell'annulla parte da adesso, anche se la dose è segnata all'ora giusta
        early,
      });
    },
    [emit, now, settings?.undoSeconds],
  );

  const undo = (keys: string[]) => {
    emit(keys.map((k) => ({ type: 'undo' as const, doseKey: k, at: now })));
    setUi({ k: 'none' });
  };

  // ritorno automatico dopo la conferma
  useEffect(() => {
    if (ui.k === 'done' && now >= ui.until) setUi({ k: 'none' });
  }, [ui, now]);

  const longPress = () => setUi({ k: 'pin', digits: '', error: false });

  if (t.phase === 'boot') return <main className="pt" aria-busy="true" />;
  if (t.phase === 'pair' || !plan) return <PairScreen code={t.pair?.code ?? null} offline={t.link === 'offline'} install={installHint} />;
  if (t.stale) return <StaleScreen contact={plan.contact} />;
  if (!screen) return <main className="pt" aria-busy="true" />;

  // ─── schermate sovrapposte ───
  if (ui.k === 'pin') {
    const press = async (d: string) => {
      const digits = (ui.digits + d).slice(0, 4);
      if (digits.length < 4) return setUi({ k: 'pin', digits, error: false });
      try {
        const res = await fetch('/api/device/unpair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: digits, action: 'check' }) });
        if (res.ok) return setUi({ k: 'menu', pin: digits, confirmUnpair: false });
      } catch {
        /* senza rete non si entra */
      }
      setUi({ k: 'pin', digits: '', error: true });
    };
    return (
      <main className="pt" data-screen="pin">
        <div className="pt-center">
          <h1 style={{ fontSize: '3rem' }}>Impostazioni del familiare</h1>
          <p className="sub">Scrivi il PIN di 4 cifre.</p>
          <div className="pt-dots" aria-label={`${ui.digits.length} cifre scritte`}>
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i < ui.digits.length ? 'on' : ''} />
            ))}
          </div>
          {ui.error ? (
            <p className="sub warn" role="alert" style={{ color: 'var(--pn-allarme)' }}>
              PIN non corretto
            </p>
          ) : null}
          <div className="pt-pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <PressButton key={d} debounceMs={250} onPress={() => void press(d)}>
                {d}
              </PressButton>
            ))}
            <PressButton debounceMs={250} onPress={() => setUi({ k: 'none' })} aria-label="Esci">
              <span style={{ fontSize: '1.5rem' }}>Esci</span>
            </PressButton>
            <PressButton debounceMs={250} onPress={() => void press('0')}>
              0
            </PressButton>
            <span />
          </div>
        </div>
      </main>
    );
  }
  if (ui.k === 'menu') {
    const pin = ui.pin;
    return (
      <main className="pt" data-screen="menu">
        <div className="pt-center">
          <h1 style={{ fontSize: '3rem' }}>Impostazioni del familiare</h1>
          <div className="pt-menu">
            {ui.confirmUnpair ? (
              <>
                <p style={{ fontSize: '1.75rem' }}>Scollegare questo tablet? Dovrai collegarlo di nuovo con un codice.</p>
                <button
                  className="danger"
                  onClick={async () => {
                    await fetch('/api/device/unpair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, action: 'unpair' }) });
                    localStorage.clear();
                    location.reload();
                  }}
                >
                  Sì, scollega
                </button>
                <button onClick={() => setUi({ k: 'menu', pin, confirmUnpair: false })}>No, torna indietro</button>
              </>
            ) : (
              <>
                <button
                  onClick={async () => {
                    await unlockAudio();
                    playReminderChime(0.8);
                    setTimeout(() => speak(`Prova della voce. ${plan.patient.name}, è l’ora della medicina.`), 3500);
                  }}
                >
                  Prova il suono e la voce
                </button>
                <button onClick={() => location.reload()}>Ricarica la pagina</button>
                <button className="danger" onClick={() => setUi({ k: 'menu', pin, confirmUnpair: true })}>
                  Scollega questo tablet
                </button>
                <button onClick={() => setUi({ k: 'none' })}>Chiudi</button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (ui.k === 'done') {
    const secondsLeft = Math.max(0, Math.ceil((ui.until - now) / 1000));
    const remaining = screen.reminder ? screen.reminder.pending.length : 0;
    const nextText = screen.next
      ? `La prossima è ${listLabel(screen.next.doses.map((d) => d.med.name))} alle ${screen.next.localTime}, ${inWords(screen.next.at, now)}.`
      : null;
    return (
      <DoneScreen
        plan={plan}
        now={now}
        names={ui.names}
        at={ui.at}
        remaining={remaining}
        nextText={nextText}
        secondsLeft={secondsLeft}
        early={ui.early}
        onUndo={() => undo(ui.keys)}
        onOk={() => setUi({ k: 'none' })}
        touch={touch}
      />
    );
  }

  if (ui.k === 'when') {
    const many = ui.views.length > 1;
    return (
      <SimpleChoice
        title="Quando?"
        now={now}
        tz={tz}
        body={`Quando ${many ? 'le' : 'l’'}hai ${many ? 'prese' : 'presa'}?`}
        actions={
          <>
            <PressButton className="pt-ghost is-white" debounceMs={touch.debounceMs} hold={touch.hold} onPress={() => goDone(ui.views, false, true)} data-testid="when-ontime" style={{ minHeight: '9rem', fontSize: '2rem', fontWeight: 700 }}>
              All’ora giusta, alle {ui.at}
            </PressButton>
            <PressButton className="pt-ghost is-white" debounceMs={touch.debounceMs} hold={touch.hold} onPress={() => goDone(ui.views, false)} data-testid="when-now" style={{ minHeight: '9rem', fontSize: '2rem', fontWeight: 700 }}>
              L’ho {many ? 'prese' : 'presa'} adesso
            </PressButton>
            <PressButton className="pt-ghost is-soft" debounceMs={touch.debounceMs} onPress={() => setUi({ k: 'none' })} data-testid="when-back">
              Torna indietro
            </PressButton>
          </>
        }
      />
    );
  }

  if (ui.k === 'pick' && screen.reminder) {
    return (
      <PickScreen
        group={screen.reminder.group}
        now={now}
        tz={tz}
        touch={touch}
        onTake={(v) => goDone([v], false)}
        onBack={() => setUi({ k: 'none' })}
        onSkipAll={() => setUi({ k: 'skip1', keys: screen.reminder!.pending.map((p) => p.dose.key), names: screen.reminder!.pending.map((p) => p.med.name) })}
      />
    );
  }

  if (ui.k === 'skip1') {
    const many = ui.keys.length > 1;
    return (
      <SimpleChoice
        title="Un momento"
        now={now}
        tz={tz}
        body={`Non prendi ${listLabel(ui.names)}?`}
        actions={
          <div className="pt-row2">
            <PressButton className="pt-ghost" debounceMs={touch.debounceMs} onPress={() => setUi({ k: 'none' })} data-testid="skip-back">
              Torna indietro
            </PressButton>
            <PressButton className="pt-ghost is-soft" debounceMs={touch.debounceMs} onPress={() => setUi({ k: 'skip2', keys: ui.keys, names: ui.names })} data-testid="skip-confirm">
              Sì, {many ? 'non le prendo' : 'non la prendo'}
            </PressButton>
          </div>
        }
      />
    );
  }

  if (ui.k === 'skip2') {
    return (
      <SimpleChoice
        title="Perché?"
        now={now}
        tz={tz}
        actions={
          <>
            {REASONS.map((r) => (
              <PressButton
                key={r.id}
                className="pt-ghost"
                debounceMs={touch.debounceMs}
                data-testid={`reason-${r.id}`}
                onPress={() => {
                  emit(ui.keys.map((k) => ({ type: 'not_taken' as const, doseKey: k, at: now, reason: r.id })));
                  setUi({ k: 'none' });
                }}
              >
                {r.label}
              </PressButton>
            ))}
            <PressButton className="pt-ghost is-soft" debounceMs={touch.debounceMs} onPress={() => setUi({ k: 'none' })}>
              Torna indietro
            </PressButton>
          </>
        }
      />
    );
  }

  if (ui.k === 'forgotten') {
    const many = ui.keys.length > 1;
    const text =
      ui.mode === 'asap'
        ? `Prendi ${many ? 'le medicine' : 'la medicina'} adesso, appena puoi.`
        : ui.mode === 'skip'
          ? `Salta questa dose e prendi la prossima. Non prenderne due insieme.`
          : `Non prenderla da sola: chiedi a ${plan.contact ?? 'un familiare'} cosa fare.`;
    return (
      <SimpleChoice
        title="Va bene"
        tone="rubino"
        now={now}
        tz={tz}
        body={text}
        actions={
          <div className="pt-row2 is-single">
            {ui.mode === 'asap' ? (
              <PressButton
                className="pt-ghost is-white"
                debounceMs={touch.debounceMs}
                data-testid="forgotten-take"
                onPress={() => {
                  const vs = (screen.missed?.doses ?? []).filter((d) => ui.keys.includes(d.dose.key));
                  if (vs.length) goDone(vs, false);
                  else setUi({ k: 'none' });
                }}
              >
                Adesso l’ho presa
              </PressButton>
            ) : null}
            <PressButton className="pt-ghost" debounceMs={touch.debounceMs} data-testid="forgotten-ok" onPress={() => setUi({ k: 'none' })}>
              Ho capito
            </PressButton>
          </div>
        }
      />
    );
  }

  if (ui.k === 'early') {
    return (
      <SimpleChoice
        title="Ancora presto"
        now={now}
        tz={tz}
        body={ui.text}
        actions={
          <div className="pt-row2 is-single">
            <PressButton className="pt-ghost is-white" debounceMs={touch.debounceMs} data-testid="early-ok" onPress={() => setUi({ k: 'none' })} style={{ color: '#A63F19' }}>
              Va bene
            </PressButton>
          </div>
        }
      />
    );
  }

  // ─── schermate guidate dallo stato ───
  if (screen.mode === 'reminder' && screen.reminder) {
    const r = screen.reminder;
    return (
      <ReminderScreen
        plan={plan}
        screen={screen}
        now={now}
        touch={touch}
        onTakeAll={() => (r.minutesLate >= LATE_ASK_MIN ? setUi({ k: 'when', views: r.pending, at: formatLocalTime(r.group.at, tz) }) : goDone(r.pending, false))}
        onSnooze={() => {
          const cfg = reminderConfigFor({ critical: r.group.critical }, plan.patient.settings);
          emit(r.pending.map((p) => ({ type: 'snoozed' as const, doseKey: p.dose.key, at: now, until: now + cfg.snoozeMin * 60_000 })));
        }}
        onSkip={() => setUi({ k: 'skip1', keys: r.pending.map((p) => p.dose.key), names: r.pending.map((p) => p.med.name) })}
        onPick={() => setUi({ k: 'pick', groupId: r.group.id })}
      />
    );
  }

  if (screen.mode === 'missed' && screen.missed) {
    const g = screen.missed;
    const open = g.doses.filter((d) => d.state.status === 'missed');
    return (
      <MissedScreen
        plan={plan}
        group={g}
        now={now}
        touch={touch}
        onYes={() => setUi({ k: 'when', views: open, at: formatLocalTime(g.at, tz) })}
        onNo={() => {
          // «No»: si registra come non presa e si mostra l'indicazione scelta dal familiare (docs/03 C8).
          const mode = open.some((d) => d.dose.ifForgotten === 'asap') ? 'asap' : open.every((d) => d.dose.ifForgotten === 'skip') ? 'skip' : 'ask';
          if (mode !== 'asap') emit(open.map((d) => ({ type: 'not_taken' as const, doseKey: d.dose.key, at: now, reason: 'forgot' })));
          setUi({ k: 'forgotten', keys: open.map((d) => d.dose.key), names: open.map((d) => d.med.name), mode });
        }}
      />
    );
  }

  // Sul telefono, a riposo: una volta sola si propone di attivare gli avvisi (o si spiega come sbloccarli).
  if ((notif === 'ask' || notif === 'denied' || notif === 'install') && !notifLater) {
    return (
      <NotifyScreen
        state={notif}
        busy={notifBusy}
        onEnable={async () => {
          setNotifBusy(true);
          setNotif(await enableNotifications());
          setNotifBusy(false);
        }}
        onLater={() => {
          try {
            localStorage.setItem('pn_notif_later', String(Date.now() + 86400_000));
          } catch {
            /* non importa */
          }
          setNotifLater(true);
        }}
      />
    );
  }

  // Riposo: «Buongiorno» al mattino se serve; altrimenti la giornata.
  const hour = Number(formatLocalTime(now, tz).slice(0, 2));
  if (plan.wake.needed && !t.wakeDone && hour >= 4 && hour < 12) {
    return (
      <WakeScreen
        plan={plan}
        now={now}
        touch={touch}
        onLogoLongPress={longPress}
        onWake={() => {
          void unlockAudio();
          emit([{ type: 'wake', at: now }]);
        }}
      />
    );
  }

  const today = patientDay(now, tz);
  const tomorrowViews = buildViews(plan.doses.filter((d) => d.day === addDays(today, 1)), plan.medications, [], now, plan.patient.settings);
  const tomorrowGroup = groupDoses(tomorrowViews, plan.patient.settings.groupWindowMin, tz)[0];

  return (
    <IdleScreen
      plan={plan}
      screen={screen}
      now={now}
      linkOk={t.link === 'ok'}
      audioBlocked={audioBlocked}
      tomorrowFirst={tomorrowGroup ? { time: tomorrowGroup.localTime, names: tomorrowGroup.doses.map((d) => d.med.name) } : null}
      onLogoLongPress={longPress}
      touch={touch}
      onEarly={() => {
        const next: GroupView | undefined = screen.next;
        if (!next) return;
        const ok = next.doses.every((d) => canTakeEarly(d.dose, now, plan.patient.settings));
        if (ok) {
          goDone(next.doses.filter((d) => d.state.status !== 'taken'), true);
        } else {
          const names = listLabel(next.doses.map((d) => d.med.name));
          setUi({ k: 'early', text: `È troppo presto: ${names} ${next.doses.length > 1 ? 'sono' : 'è'} alle ${next.localTime}, ${inWords(next.at, now)}. Ti avviso io quando è ora.` });
        }
      }}
    />
  );
}
