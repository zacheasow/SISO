/**
 * Kumon SISO Service Worker — powers offline-capable home-screen installation
 * for the Vercel-hosted parent/kiosk PWA. Strategy is network-first so live
 * data (which is handled by the app's own API calls) is never cached stale.
 */
const CACHE_NAME = 'kumon-siso-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never touch API calls — they must reach the live desktop server.
  if (url.pathname.startsWith('/api/')) return;
  // Only handle same-origin navigations and static assets.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const live = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        if (request.method === 'GET') {
          cache.put(request, live.clone());
        }
        return live;
      } catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/parent.html').catch(() => null);
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});