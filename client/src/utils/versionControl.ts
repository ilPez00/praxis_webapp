// Version Control - Forces users to clear cache on major updates
// Consistent with index.html boot script
const CURRENT_VERSION = '2026.03.12.v3'; 

export function enforceFreshContent() {
  if (typeof window === 'undefined') return;

  try {
    const storedVersion = localStorage.getItem('praxis_app_version');
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`[VersionControl] App version mismatch detected in JS layer.`);
      // We don't reload here anymore to avoid flickering; index.html handled it.
      // But we update the key just in case.
      localStorage.setItem('praxis_app_version', CURRENT_VERSION);
    }
  } catch (err) {
    console.warn('[VersionControl] Sync warning:', err);
  }
}

export async function nuclearReset() {
  console.log('[VersionControl] Performing manual nuclear reset...');
  
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }

    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch (e) {}

  localStorage.clear();
  sessionStorage.clear();
  
  // Set version so we don't trigger mismatch loops
  localStorage.setItem('praxis_app_version', CURRENT_VERSION);
  
  window.location.href = window.location.origin + '/?reset=' + Date.now();
}
