import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { requireCaller } from '@/server/auth';
import './caregiver.css';
import Shell from './Shell';

export const metadata: Metadata = {
  title: 'Pìnnuli',
  manifest: '/app.webmanifest',
  robots: { index: false, follow: false },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#A63F19' };

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireCaller();
  return <Shell>{children}</Shell>;
}
