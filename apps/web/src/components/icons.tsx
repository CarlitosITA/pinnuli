import type { InstructionIcon } from '@pinnuli/core';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Check({ size = 48, stroke = 6 }: { size?: number | string; stroke?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M10 25 L20 35 L38 13" {...base} strokeWidth={stroke} />
    </svg>
  );
}

export function Clock({ size = 36 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="19" {...base} />
      <path d="M24 13 V24 L31 29" {...base} />
    </svg>
  );
}

export function Bell({ size = 48 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M24 6 a12 12 0 0 1 12 12 v10 l4 6 H8 l4 -6 V18 a12 12 0 0 1 12 -12z" fill="currentColor" />
      <path d="M19 38 a5 5 0 0 0 10 0" fill="currentColor" />
    </svg>
  );
}

export function Alert({ size = 48 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M24 6 L44 40 H4 Z" {...base} />
      <path d="M24 19 V29 M24 34 V35" {...base} strokeWidth={5} />
    </svg>
  );
}

/** Cerchio di stato: presa, da confermare, in ritardo, in programma. Sempre con la parola accanto. */
export function StatusDot({ kind, size = 36 }: { kind: 'taken' | 'next' | 'late' | 'future' | 'skipped'; size?: number | string }) {
  if (kind === 'taken') {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill="var(--pn-ok)" />
        <path d="M14 25 L21 32 L34 17" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'next' || kind === 'late') {
    const fill = kind === 'late' ? 'var(--pn-allarme)' : 'var(--pn-accento)';
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill={fill} />
        {kind === 'late' ? (
          <path d="M24 13 V27 M24 33 V34" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
        ) : (
          <path d="M24 12 V24 L32 29" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    );
  }
  if (kind === 'skipped') {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--pn-testo-2)" strokeWidth="4" />
        <path d="M15 24 H33" stroke="var(--pn-testo-2)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--pn-testo-2)" strokeWidth="4" strokeDasharray="6 6" />
    </svg>
  );
}

/** Pittogrammi delle istruzioni (docs/08 § 8.4). Il testo accompagna sempre l'icona. */
export function InstructionGlyph({ icon, size = 44 }: { icon: InstructionIcon; size?: number | string }) {
  const p = { viewBox: '0 0 48 48', width: size, height: size, 'aria-hidden': true } as const;
  switch (icon) {
    case 'digiuno':
      return (
        <svg {...p}>
          <circle cx="24" cy="26" r="15" {...base} />
          <circle cx="24" cy="26" r="7" {...base} strokeWidth={3} />
          <path d="M6 42 L42 6" {...base} />
        </svg>
      );
    case 'pieno':
      return (
        <svg {...p}>
          <circle cx="24" cy="26" r="15" {...base} />
          <path d="M16 26 q4 -6 8 0 t8 0" {...base} strokeWidth={3} />
          <path d="M8 8 v10 M12 8 v10 M16 8 v10 M12 18 v8" {...base} strokeWidth={3} />
        </svg>
      );
    case 'acqua':
      return (
        <svg {...p}>
          <path d="M12 8 H36 L33 42 H15 Z" {...base} />
          <path d="M14 22 q5 -4 10 0 t10 0" {...base} strokeWidth={3} />
        </svg>
      );
    case 'sciogliere':
      return (
        <svg {...p}>
          <path d="M10 14 H34 L31 44 H13 Z" {...base} />
          <rect x="30" y="4" width="10" height="16" rx="2" {...base} strokeWidth={3} />
          <path d="M14 28 q4 -3 8 0 t8 0" {...base} strokeWidth={3} />
        </svg>
      );
    case 'urinare':
      return (
        <svg {...p}>
          <path d="M14 6 H34 V20 H14 Z" {...base} strokeWidth={3} />
          <path d="M12 20 H36 a2 2 0 0 1 2 2 c0 10 -6 16 -14 16 s-14 -6 -14 -16 a2 2 0 0 1 2 -2z" {...base} strokeWidth={3} />
          <path d="M18 42 H30" {...base} />
        </svg>
      );
    case 'non-masticare':
      return (
        <svg {...p}>
          <path d="M12 10 c-6 0 -6 10 -2 16 c2 4 2 14 6 14 c3 0 2 -8 8 -8 s5 8 8 8 c4 0 4 -10 6 -14 c4 -6 4 -16 -2 -16 c-6 0 -6 4 -12 4 s-6 -4 -12 -4z" {...base} strokeWidth={3} />
          <path d="M6 42 L42 6" {...base} />
        </svg>
      );
    case 'spezzare':
      return (
        <svg {...p}>
          <path d="M6 24 a18 18 0 0 1 36 0" {...base} />
          <path d="M6 28 h14 M28 28 h14" {...base} />
          <path d="M24 12 L22 22 L26 28 L24 40" {...base} strokeWidth={3} />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="24" cy="24" r="16" {...base} />
        </svg>
      );
  }
}

export function Logo({ size = 44 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="var(--pn-accento)" />
      <path d="M29 52 L44 67 L72 37" fill="none" stroke="var(--pn-sfondo)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
