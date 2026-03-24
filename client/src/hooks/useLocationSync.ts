import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';

export function useLocationSync() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    // Check suppression flag (user might have dismissed it or we want to avoid spamming)
    if (sessionStorage.getItem('praxis_suppress_auto_geo') === 'true') return;

    const syncLocation = async () => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

      // Throttle: only update once per session or every hour
      const lastUpdate = sessionStorage.getItem('praxis_last_geo_sync');
      const now = Date.now();
      if (lastUpdate && now - parseInt(lastUpdate) < 3600000) return;

      const performSync = () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              await supabase
                .from('profiles')
                .update({ latitude, longitude })
                .eq('id', user.id);
              sessionStorage.setItem('praxis_last_geo_sync', now.toString());
              console.debug('[GeoSync] Updated coordinates.');
            } catch (err) {
              console.warn('[GeoSync] Non-fatal DB error:', err);
            }
          },
          (err) => {
            console.warn('[GeoSync] Location error:', err.message);
            // If denied, don't ask again this session to avoid annoying the user
            if (err.code === err.PERMISSION_DENIED) {
              sessionStorage.setItem('praxis_suppress_auto_geo', 'true');
            }
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
      };

      // Best practice: Check if we already have permission before triggering the prompt
      // This avoids the "double prompt" or "prompt on every load" feel in some browsers
      if ('permissions' in navigator && (navigator as any).permissions.query) {
        try {
          const result = await (navigator as any).permissions.query({ name: 'geolocation' });
          if (result.state === 'granted') {
            performSync();
          } else if (result.state === 'prompt') {
            // Only prompt if they haven't been asked in a while, or just don't auto-prompt at all
            // for "prompt" state to be extremely conservative.
            // Let's only auto-sync if already granted.
            console.debug('[GeoSync] Permission state is \"prompt\". Skipping auto-request to avoid intrusion.');
          }
        } catch (e) {
          // Fallback for browsers where permissions query fails
          // performSync(); // Removed to be safe
        }
      } else {
        // Legacy fallback - only sync if we haven't synced yet this session
        // performSync(); // Removed to be safe
      }
    };

    syncLocation();
  }, [user?.id]);
}

