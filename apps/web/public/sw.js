/*
 * Service worker del tablet (docs/06): l'app si apre anche senza rete.
 * - /_next/static, font e immagini: prima la copia locale (sono file con nome legato al contenuto);
 * - pagina /t: prima la rete, e se manca la rete l'ultima copia;
 * - /api: mai in cache (il tablet tiene da sé l'ultimo piano delle dosi);
 * - notifiche push: il promemoria arriva anche a pagina chiusa; toccandolo si apre il tasto grande.
 */
const CACHE = 'pinnuli-v1';
const SHELL = ['/t', '/brand/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/icons/') || url.pathname.includes('/media/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate' && url.pathname === '/t') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/t', copy));
          }
          return res;
        })
        .catch(() => caches.match('/t')),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* testo non valido: notifica generica */
  }
  event.waitUntil(
    (async () => {
      // Se la pagina è aperta e in vista, il promemoria suona e parla da solo: niente doppione.
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;
      await self.registration.showNotification(data.title || 'Pìnnuli', {
        body: data.body || 'È l’ora della medicina. Tocca per aprire.',
        tag: data.tag || 'dose',
        renotify: true,
        requireInteraction: true,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [300, 150, 300, 150, 300],
        lang: 'it',
        data: { url: data.url || '/t' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/t';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mine = wins.find((w) => new URL(w.url).pathname === '/t');
      if (mine) return mine.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
