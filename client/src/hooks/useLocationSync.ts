import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';

export function useLocationSync() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    // Throttle: only update once per session or every hour
    const lastUpdate = sessionStorage.getItem('praxis_last_geo_sync');
    const now = Date.now();
    if (lastUpdate && now - parseInt(lastUpdate) < 3600000) return;

    if ('geolocation' in navigator) {
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
            console.error('[GeoSync] Error:', err);
          }
        },
        () => console.warn('[GeoSync] Access denied.'),
        { enableHighAccuracy: false, timeout: 10000 }
      );
    }
  }, [user?.id]);
}
