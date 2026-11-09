/**
 * Suoni e voce del tablet (docs/05 § 5.6).
 * - Suono del promemoria unico e sempre uguale, con frequenze tra 500 e 2000 Hz (udibili anche con presbiacusia).
 * - Suono di conferma diverso, breve e «positivo».
 * - Voce italiana a velocità ridotta (circa 0,85×). Ogni cosa detta a voce è anche scritta a schermo.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Il browser permette di suonare? Prima di un tocco molti browser tengono l'audio sospeso. */
export function audioReady(): boolean {
  const c = getCtx();
  return !!c && c.state === 'running';
}

export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
  } catch {
    /* ancora bloccato */
  }
  return c.state === 'running';
}

function tone(c: AudioContext, freq: number, start: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/**
 * Campanella del promemoria: tre note (523, 659, 784 Hz) ripetute due volte, con volume crescente.
 * `level` (0–1) è il volume di partenza; a ogni nota sale fino a 1.
 */
export function playReminderChime(level = 0.35): number {
  const c = getCtx();
  if (!c || c.state !== 'running') return 0;
  const t0 = c.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    const vol = Math.min(1, level + ((1 - level) * i) / (notes.length - 1)) * 0.55;
    tone(c, f, t0 + i * 0.42, 0.9, vol, 'sine');
    tone(c, f * 2, t0 + i * 0.42, 0.5, vol * 0.25, 'triangle');
  });
  return notes.length * 420 + 700;
}

/** Conferma: due note che salgono (659 → 880 Hz), breve. */
export function playConfirmSound() {
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + 0.02;
  tone(c, 659.25, t0, 0.22, 0.4);
  tone(c, 880, t0 + 0.16, 0.45, 0.45);
}

let voice: SpeechSynthesisVoice | null | undefined;

function italianVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const list = window.speechSynthesis?.getVoices?.() ?? [];
  if (!list.length) return null; // le voci possono arrivare dopo: non memorizzare il vuoto
  voice = list.find((v) => v.lang?.toLowerCase().startsWith('it') && v.localService) ?? list.find((v) => v.lang?.toLowerCase().startsWith('it')) ?? null;
  return voice;
}

export function speak(text: string, volume = 1) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 0.85;
    u.volume = volume;
    const v = italianVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {
    /* la voce è un aiuto in più: lo schermo dice la stessa cosa */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* niente */
  }
}
