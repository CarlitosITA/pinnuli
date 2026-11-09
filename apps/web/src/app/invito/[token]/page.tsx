import Link from 'next/link';
import { getDb } from '@/server/db/client';
import { inviteInfo } from '@/server/members';
import { Logo } from '@/components/icons';
import '../../app/caregiver.css';
import InviteForm from './InviteForm';

export const metadata = { title: 'Invito', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await inviteInfo(getDb(), token);
  if (!info) {
    return (
      <main className="cg cg-login">
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '26rem' }}>
          <div className="cg-brand">
            <Logo size="3rem" />
            pìnnuli
          </div>
          <h1 style={{ fontSize: '1.5rem' }}>Questo invito non è più valido</h1>
          <p>Il link è già stato usato oppure è scaduto. Chiedi a chi ti ha invitato di crearne uno nuovo.</p>
          <Link className="cg-btn block" href="/login">
            Ho già un account
          </Link>
        </div>
      </main>
    );
  }
  return <InviteForm token={token} label={info.label} patient={info.patient} inviter={info.inviter} />;
}
