'use client';

import { useState } from 'react';
import { byGender } from '@pinnuli/core';
import { Logo } from '@/components/icons';
import { api, Field, GenderSelect } from '../../app/ui';

export default function InviteForm({ token, label, patient, inviter, gender: invitedGender }: { token: string; label: string; patient: string; inviter: string; gender: 'f' | 'm' | 'x' }) {
  const [name, setName] = useState(label);
  const [gender, setGender] = useState(invitedGender);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/invite', { token, name, email, password, gender });
      window.location.href = '/app';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="cg cg-login">
      <form onSubmit={submit} noValidate>
        <div className="cg-brand">
          <Logo size="3rem" />
          pìnnuli
        </div>
        <h1 style={{ fontSize: '1.5rem' }}>
          {inviter ? `${inviter} ti invita` : byGender(gender, { f: 'Sei stata invitata', m: 'Sei stato invitato', x: 'Hai un invito' })}
          {patient ? ` a seguire ${patient}` : ''}
        </h1>
        <p className="cg-muted">Crea il tuo accesso: vedrai le medicine in tempo reale e riceverai gli avvisi se una dose non viene confermata.</p>
        <Field label="Il tuo nome" htmlFor="name">
          <input id="name" type="text" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Come ti scriviamo" hint="Serve solo a scrivere le frasi nella forma giusta, per esempio «avvisata» o «avvisato»." htmlFor="gender">
          <GenderSelect id="gender" value={gender} onChange={setGender} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Scegli una password" hint="Almeno 8 caratteri." htmlFor="password">
          <input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error ? (
          <p className="cg-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="cg-btn primary block" type="submit" disabled={busy}>
          {busy ? 'Un momento…' : 'Crea il mio accesso'}
        </button>
      </form>
    </main>
  );
}
