import Link from 'next/link';
import { Logo } from '@/components/icons';
import './app/caregiver.css';

export default function Home() {
  return (
    <main className="cg cg-login">
      <div style={{ maxWidth: '30rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="cg-brand">
          <Logo size="3.5rem" />
          pìnnuli
        </div>
        <h1 style={{ fontSize: '2.25rem' }}>Le tue compresse, all’ora giusta.</h1>
        <p>
          Pìnnuli ricorda le medicine con un promemoria a tutto schermo e un tasto grande da toccare, pensato per chi ha il tremore o vede poco.
          I familiari seguono tutto dal telefono.
        </p>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Link className="cg-btn primary block" href="/login">
            Accedi come familiare
          </Link>
          <Link className="cg-btn block" href="/t">
            Apri sul tablet del paziente
          </Link>
        </div>
      </div>
    </main>
  );
}
