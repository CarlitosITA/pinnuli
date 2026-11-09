'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const items = [
  { href: '/app', label: 'Oggi', icon: <path d="M4 12.5 L9.5 18 L20 6.5" /> },
  { href: '/app/terapia', label: 'Terapia', icon: <><rect x="4" y="9" width="16" height="7" rx="3.5" transform="rotate(-30 12 12.5)" /><path d="M10 7.5 L14 15" /></> },
  { href: '/app/storico', label: 'Storico', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { href: '/app/altro', label: 'Altro', icon: <><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></> },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="cg">
      <a href="#contenuto" className="cg-btn" style={{ position: 'absolute', left: '-999px' }} onFocus={(e) => (e.currentTarget.style.left = '0.5rem')} onBlur={(e) => (e.currentTarget.style.left = '-999px')}>
        Vai al contenuto
      </a>
      <main id="contenuto" className="cg-main" tabIndex={-1}>
        {children}
      </main>
      <nav className="cg-nav" aria-label="Sezioni">
        {items.map((it) => {
          const current = it.href === '/app' ? path === '/app' : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} aria-current={current ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {it.icon}
              </svg>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
