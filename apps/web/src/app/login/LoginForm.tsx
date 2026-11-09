'use client';

import { useState } from 'react';
import { Logo } from '@/components/icons';
import { api, Field } from '../app/ui';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/auth/login', { email, password });
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
        <h1 style={{ fontSize: '1.5rem' }}>Accedi come familiare</h1>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error ? (
          <p className="cg-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="cg-btn primary block" type="submit" disabled={busy}>
          {busy ? 'Un momento…' : 'Entra'}
        </button>
      </form>
    </main>
  );
}
