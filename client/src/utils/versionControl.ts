// Increment this version number whenever you want to force all users to clear their cache and reload
// Current: v2 - Adding aggressive cache busting
const CURRENT_VERSION = '2026.03.11.v3';

export function enforceFreshContent() {
  if (typeof window === 'undefined') return;

  const storedVersion = localStorage.getItem('praxis_app_version');

  if (storedVersion !== CURRENT_VERSION) {
    console.log(`[VersionControl] Version mismatch: ${storedVersion} -> ${CURRENT_VERSION}. Forcing nuclear refresh...`);
    
    // Nuclear Reset
    try {
      // 1. Clear all caches
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) caches.delete(name);
        });
      }

      // 2. Unregister all service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }

      // 3. Clear storage (optional but safe for version mismatch)
      // We don't want to log people out unnecessarily, but if the app is crashing, it might be due to bad state.
      // For now, let's just set the version so we don't loop.
      localStorage.setItem('praxis_app_version', CURRENT_VERSION);

      // 4. Force hard reload from server
      setTimeout(() => {
        // Appending a timestamp to bypass CDN/Browser HTTP cache for the index.html
        window.location.href = window.location.origin + '?v=' + Date.now();
      }, 800);
    } catch (err) {
      console.error('[VersionControl] Reset failed:', err);
      localStorage.setItem('praxis_app_version', CURRENT_VERSION);
    }
  }
}

export async function nuclearReset() {
  console.log('[VersionControl] Manual nuclear reset initiated...');
  
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
  }

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }

  localStorage.clear();
  sessionStorage.clear();
  
  window.location.href = window.location.origin + '?reset=' + Date.now();
}
