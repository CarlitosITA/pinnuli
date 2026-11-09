import type { MedicationForm } from '@pinnuli/core';

/**
 * Disegno del farmaco: forma + colore coerenti (docs/08 § 8.4), usato quando manca la foto.
 * La mezza compressa è disegnata come mezza compressa.
 */
export function Pill({
  form,
  color,
  half = false,
  size = 120,
  label,
}: {
  form: MedicationForm | string;
  color: string;
  half?: boolean;
  size?: number | string;
  label?: string;
}) {
  const stroke = shade(color);
  const common = label
    ? { viewBox: '0 0 120 120', width: size, height: size, role: 'img' as const, 'aria-label': label }
    : { viewBox: '0 0 120 120', width: size, height: size, 'aria-hidden': true as const };
  switch (form) {
    case 'capsula':
      return (
        <svg {...common}>
          <g transform="rotate(-35 60 60)">
            <rect x="14" y="36" width="92" height="48" rx="24" fill={color} stroke={stroke} strokeWidth="4" />
            <path d="M60 36 V84" stroke={stroke} strokeWidth="4" />
          </g>
        </svg>
      );
    case 'bustina':
      return (
        <svg {...common}>
          <rect x="22" y="14" width="76" height="92" rx="6" fill={color} stroke={stroke} strokeWidth="4" />
          <path d="M22 26 H98 M22 94 H98" stroke={stroke} strokeWidth="4" strokeDasharray="6 5" />
        </svg>
      );
    case 'flaconcino':
      return (
        <svg {...common}>
          <rect x="44" y="12" width="32" height="18" rx="4" fill={stroke} />
          <rect x="34" y="30" width="52" height="80" rx="12" fill={color} stroke={stroke} strokeWidth="4" />
        </svg>
      );
    case 'gocce':
    case 'sciroppo':
      return (
        <svg {...common}>
          <path d="M60 12 C60 12 24 54 24 78 a36 36 0 0 0 72 0 C96 54 60 12 60 12z" fill={color} stroke={stroke} strokeWidth="4" />
        </svg>
      );
    case 'cerotto':
      return (
        <svg {...common}>
          <rect x="12" y="34" width="96" height="52" rx="26" fill={color} stroke={stroke} strokeWidth="4" />
          <rect x="44" y="46" width="32" height="28" rx="6" fill="#FFFFFF" opacity=".7" />
        </svg>
      );
    case 'inalatore':
      return (
        <svg {...common}>
          <rect x="34" y="12" width="40" height="64" rx="8" fill={color} stroke={stroke} strokeWidth="4" />
          <path d="M34 76 H100 a8 8 0 0 1 8 8 v12 H34z" fill={color} stroke={stroke} strokeWidth="4" />
        </svg>
      );
    case 'iniezione':
      return (
        <svg {...common}>
          <rect x="30" y="38" width="62" height="26" rx="4" fill={color} stroke={stroke} strokeWidth="4" />
          <path d="M92 51 H112 M30 51 H12 M12 40 V62" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    default: {
      // compressa (e "altro")
      if (half) {
        return (
          <svg {...common}>
            <path d="M12 64 a48 48 0 0 1 96 0 z" fill={color} stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
            <path d="M12 64 H108" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
      }
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="50" fill={color} stroke={stroke} strokeWidth="4" />
          <path d="M20 60 H100" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    }
  }
}

/** Contorno più scuro del colore di riempimento, per tenere le forme bianche leggibili sul bianco. */
function shade(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#6B625A';
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => Math.max(0, Math.round(parseInt(h, 16) * 0.62)));
  return `rgb(${r},${g},${b})`;
}
