/*
 * Service worker del tablet (docs/06): l'app si apre anche senza rete.
 * - /_next/static, font e immagini: prima la copia locale (sono file con nome legato al contenuto);
 * - pagina /t: prima la rete, e se manca la rete l'ultima copia;
 * - /api: mai in cache (il tablet tiene da sé l'ultimo piano delle dosi).
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
