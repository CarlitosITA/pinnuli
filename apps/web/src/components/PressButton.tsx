'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/**
 * Tasto pensato per chi ha il tremore (docs/05 § 5.3):
 * - l'azione scatta al rilascio del dito, anche se il dito si è spostato rimanendo sul tasto;
 * - tocchi ripetuti sullo stesso tasto entro `debounceMs` (default 800 ms) sono ignorati;
 * - un secondo dito appoggiato mentre il primo è giù viene ignorato;
 * - opzione «tieni premuto» (1 secondo, con anello di avanzamento) al posto del tocco singolo;
 * - da tastiera / lettore di schermo si attiva normalmente (Invio, Spazio, doppio tocco di TalkBack).
 */
export interface PressButtonProps {
  onPress: () => void;
  debounceMs?: number;
  hold?: boolean;
  holdMs?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
  id?: string;
}

/** Tolleranza (px) oltre il bordo del tasto in cui il rilascio vale ancora come tocco. */
const SLOP = 16;

export function PressButton({
  onPress,
  debounceMs = 800,
  hold = false,
  holdMs = 1000,
  disabled,
  className = '',
  style,
  children,
  ...rest
}: PressButtonProps) {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const active = useRef<number | null>(null);
  const lastFire = useRef(0);
  const raf = useRef<number | null>(null);
  const startedAt = useRef(0);
  const fired = useRef(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const fire = useCallback(() => {
    const now = Date.now();
    if (now - lastFire.current < debounceMs) return;
    lastFire.current = now;
    onPressRef.current();
  }, [debounceMs]);

  const stopHold = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (active.current !== null) return; // solo il primo dito
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active.current = e.pointerId;
    fired.current = false;
    setPressing(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* alcuni browser non lo supportano: si continua senza */
    }
    if (hold) {
      startedAt.current = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - startedAt.current) / holdMs);
        setProgress(p);
        if (p >= 1) {
          fired.current = true;
          raf.current = null;
          fire();
          return;
        }
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    }
  };

  const up = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    setPressing(false);
    if (hold) {
      stopHold();
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const inside = e.clientX >= r.left - SLOP && e.clientX <= r.right + SLOP && e.clientY >= r.top - SLOP && e.clientY <= r.bottom + SLOP;
    if (inside && !disabled) fire();
  };

  const cancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    setPressing(false);
    stopHold();
  };

  // Attivazione da tastiera o tecnologia assistiva: il "click" sintetico ha detail = 0.
  const click = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.detail === 0 && !hold) fire();
  };
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (hold && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      fire(); // chi usa la tastiera non può "tenere premuto": basta un Invio
    }
  };

  return (
    <button
      type="button"
      className={`pn-press ${pressing ? 'is-pressing' : ''} ${className}`}
      style={style}
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={cancel}
      onClick={click}
      onKeyDown={key}
      onContextMenu={(e) => e.preventDefault()}
      {...rest}
    >
      {hold && progress > 0 && (
        <svg className="pn-hold-ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${progress * 100.5} 100.5`}
            transform="rotate(-90 18 18)"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
