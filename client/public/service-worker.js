/**
 * Praxis Service Worker
 * Handles caching and offline functionality
 */

const CACHE_NAME = 'praxis-cache-v1';
const API_CACHE_NAME = 'praxis-api-cache-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API routes to cache (GET requests only)
const CACHEABLE_API_ROUTES = [
  '/api/notebook/entries',
  '/api/notebook/stats',
  '/api/notebook/tags',
  '/api/dashboard',
  '/api/checkins',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with stale-while-revalidate strategy
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);

  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Return cached, refresh in background (fire-and-forget)
    refetchAndCache(request, cache);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok && shouldCacheApi(request.url)) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'OFFLINE',
      message: 'You are offline. Some features may be limited.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

/**
 * Check if API URL should be cached
 */
function shouldCacheApi(url) {
  return CACHEABLE_API_ROUTES.some((route) => url.includes(route));
}

/**
 * Refetch data and update cache (background)
 */
async function refetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
  } catch (_) {
    // Ignore background refetch errors
  }
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'Praxis', body: event.data.text() };
  }

  const options = {
    body:  payload.body || '',
    icon:  payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-72x72.png',
    data:  { url: payload.url || '/' },
    vibrate: [100, 50, 100],
    tag: payload.tag || 'praxis-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Praxis', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
