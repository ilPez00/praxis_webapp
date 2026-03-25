import { useEffect, useRef, useCallback } from 'react';

export interface EntryLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

/**
 * Eagerly caches the user's current geolocation (if permission is already granted).
 * Returns a getter that provides the last-known location synchronously — no async
 * wait at log time. Returns null if location is unavailable or permission denied.
 */
export function useCurrentLocation() {
  const locationRef = useRef<EntryLocation | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const fetchPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locationRef.current = {
            lat: parseFloat(pos.coords.latitude.toFixed(5)),
            lng: parseFloat(pos.coords.longitude.toFixed(5)),
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
          };
        },
        () => { /* permission denied or error — leave null */ },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    };

    // Only auto-fetch if permission is already granted (no prompt)
    if ('permissions' in navigator && (navigator as any).permissions?.query) {
      (navigator as any).permissions.query({ name: 'geolocation' })
        .then((result: { state: string }) => {
          if (result.state === 'granted') fetchPosition();
        })
        .catch(() => { /* permissions API not supported */ });
    }
  }, []);

  const getLocation = useCallback((): EntryLocation | null => locationRef.current, []);

  return getLocation;
}
