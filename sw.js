/* RunLines service worker — offline app shell, live script fetches. */
const CACHE = 'runlines-shell-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache cross-origin requests (e.g. raw.githubusercontent.com scripts).
  // These must always hit the network so lines stay live.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: serve cached shell, fall back to network, then index.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(cached =>
        cached || fetch(req).catch(() => caches.match('/'))
      )
    );
    return;
  }

  // Same-origin assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
