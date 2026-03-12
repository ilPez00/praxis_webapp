import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';

export function useLocationSync() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    try {
      // Throttle: only update once per session or every hour
      const lastUpdate = sessionStorage.getItem('praxis_last_geo_sync');
      const now = Date.now();
      if (lastUpdate && now - parseInt(lastUpdate) < 3600000) return;

      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              await supabase
                .from('profiles')
                .update({ latitude, longitude })
                .eq('id', user.id);
              sessionStorage.setItem('praxis_last_geo_sync', now.toString());
              console.log('[GeoSync] Updated coordinates.');
            } catch (err) {
              console.warn('[GeoSync] Non-fatal DB error:', err);
            }
          },
          (err) => {
            console.warn('[GeoSync] Permission or signal error:', err.message);
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }
    } catch (err) {
      console.warn('[GeoSync] Global geo failure (non-fatal):', err);
    }
  }, [user?.id]);
}
