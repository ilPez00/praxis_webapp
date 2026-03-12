const CACHE_NAME = 'praxis-cache-v3'; // Incremented version to v3
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event - cleanup old caches and claim clients immediately
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
    }).then(() => {
      console.log('[SW] Activated and claiming clients.');
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. Navigation requests: Network-first, fallback to cached index.html
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network is ok, return it
          if (response.ok) return response;
          // If it's a 404/500, still try cache as last resort
          return caches.match('/index.html') || response;
        })
        .catch(() => {
          // Network failure (offline), return cached index
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 2. API requests: Bypass cache entirely
  if (url.pathname.startsWith('/api')) {
    return; // Let the browser handle it normally
  }

  // 3. Static assets: Cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Optional: you could cache new successful asset requests here
        return networkResponse;
      });
    })
  );
});
