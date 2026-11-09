import type { Metadata, Viewport } from 'next';
import './tablet.css';
import TabletApp from './TabletApp';

export const metadata: Metadata = {
  title: 'Pìnnuli — le tue compresse, all’ora giusta',
  manifest: '/t.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Pìnnuli', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#A63F19',
};

export default function Page() {
  return <TabletApp />;
}
