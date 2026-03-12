// Increment this version number whenever you want to force all users to clear their cache and reload
const CURRENT_VERSION = '2026.03.11.v1';

export function enforceFreshContent() {
  if (typeof window === 'undefined') return;

  const storedVersion = localStorage.getItem('praxis_app_version');

  if (storedVersion !== CURRENT_VERSION) {
    console.log(`[VersionControl] Version mismatch: ${storedVersion} -> ${CURRENT_VERSION}. Forcing refresh...`);
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Set new version
    localStorage.setItem('praxis_app_version', CURRENT_VERSION);

    // Hard reload (true forces reload from server, though deprecated in some browsers, location.reload() + cache clear is effective)
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}
