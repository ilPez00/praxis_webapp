// Suicidal Service Worker - VERSION 2026.03.12.v1
// Immediately unregisters itself and clears all caches to resolve refresh loops

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      // Force all clients to reload to pick up the unregistration
      clients.forEach(client => client.navigate(client.url));
    })
  );
});

// Fallback to network for everything
self.addEventListener('fetch', (event) => {
  // Check if we are already unregistering
  event.respondWith(fetch(event.request));
});
