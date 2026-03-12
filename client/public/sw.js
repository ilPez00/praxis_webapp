const CACHE_NAME = 'praxis-cache-v2026-03-11-v3'; // Bumped for new SW strategy

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategy: Bypassing SW for internal JS/CSS to let browser HTTP cache/headers handle it
// while providing a network-first fallback for offline support.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isInternal = url.origin === self.location.origin;
  const isAsset = url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

  if (event.request.mode === 'navigate' || (isInternal && isAsset)) {
    // Strictly Network-First with Cache-Busting fallback
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/index.html');
          return null;
        })
    );
    return;
  }

  // Generic Cache-First for other things (images, fonts)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then(res => {
        if (res && res.status === 200 && isInternal) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
