/**
 * Notifiche push sul telefono (docs/06 § 6.8): il promemoria arriva anche a schermo spento e con la pagina chiusa.
 * Su Android funziona dal browser; su iPhone solo dopo "Aggiungi alla schermata Home" (iOS 16.4 o più recente).
 */
export type NotifState = 'checking' | 'unsupported' | 'unavailable' | 'install' | 'ask' | 'on' | 'denied';

/** Il telefono (schermo stretto o browser mobile) e non il tablet a muro. */
export function isPhoneLike(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 700px)').matches || /Android.+Mobile|iPhone|iPod/.test(navigator.userAgent);
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** iPhone aperto in Safari: finché non è sulla schermata Home, iOS non manda notifiche (e tiene i dati separati dall'app installata). */
export function needsInstall(): boolean {
  if (typeof window === 'undefined') return false;
  return isPhoneLike() && isIos() && !isInstalled();
}

function isInstalled() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function serverKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/device/push', { cache: 'no-store' });
    if (!res.ok) return null;
    const d = (await res.json()) as { enabled: boolean; publicKey: string | null };
    return d.enabled ? d.publicKey : null;
  } catch {
    return null;
  }
}

async function subscribe(key: string): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const res = await fetch('/api/device/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Stato delle notifiche di questo dispositivo. Se sono già concesse, rinnova l'iscrizione in silenzio. */
export async function notifState(): Promise<NotifState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  const capable = 'PushManager' in window && 'Notification' in window;
  if (!capable) return isIos() && !isInstalled() ? 'install' : 'unsupported';
  if (isIos() && !isInstalled()) return 'install';
  if (Notification.permission === 'denied') return 'denied';
  const key = await serverKey();
  if (!key) return 'unavailable';
  if (Notification.permission === 'granted') return (await subscribe(key)) ? 'on' : 'ask';
  return 'ask';
}

/** Da chiamare dopo un tocco: il browser chiede il permesso solo se parte da un gesto dell'utente. */
export async function enableNotifications(): Promise<NotifState> {
  const key = await serverKey();
  if (!key) return 'unavailable';
  const perm = await Notification.requestPermission();
  if (perm === 'denied') return 'denied';
  if (perm !== 'granted') return 'ask';
  return (await subscribe(key)) ? 'on' : 'ask';
}

/** Toglie dall'area notifiche i promemoria già risolti. */
export async function clearShownNotifications() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const list = (await reg?.getNotifications()) ?? [];
    list.forEach((n) => n.close());
  } catch {
    /* non importa */
  }
}
