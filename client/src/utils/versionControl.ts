// Version Control - Forces users to clear cache on major updates
const CURRENT_VERSION = '2026.03.11.v4'; // Increment this to force reset

export function enforceFreshContent() {
  if (typeof window === 'undefined') return;

  const storedVersion = localStorage.getItem('praxis_app_version');

  if (storedVersion !== CURRENT_VERSION) {
    console.log(`[VersionControl] Resetting to ${CURRENT_VERSION}`);
    
    // Set version immediately to prevent reload loops
    localStorage.setItem('praxis_app_version', CURRENT_VERSION);

    // 1. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }

    // 2. Clear Caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(n => caches.delete(n));
      });
    }

    // 3. Brief delay then reload
    setTimeout(() => {
      window.location.reload();
    }, 200);
  }
}

export async function nuclearReset() {
  console.log('[VersionControl] Performing manual nuclear reset...');
  
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }

  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
  }

  localStorage.clear();
  sessionStorage.clear();
  
  // Set version so we don't trigger enforceFreshContent loop
  localStorage.setItem('praxis_app_version', CURRENT_VERSION);
  
  window.location.href = window.location.origin + '/?reset=' + Date.now();
}
