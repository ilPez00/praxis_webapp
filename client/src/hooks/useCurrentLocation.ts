import { useEffect, useRef, useCallback } from 'react';

export interface EntryLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface UseCurrentLocationOptions {
  enabled?: boolean; // If false, never fetch location
}

/**
 * Caches the user's current geolocation when enabled.
 * Returns a getter that provides the last-known location synchronously.
 * 
 * @param options.enabled - Whether location tracking is enabled (default: true)
 * @returns Function to get cached location, or null if disabled/unavailable
 */
export function useCurrentLocation(options: UseCurrentLocationOptions = {}) {
  const { enabled = true } = options;
  const locationRef = useRef<EntryLocation | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Never fetch if disabled
    if (!enabled) return;
    
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    
    // Only fetch once
    if (initializedRef.current) return;

    const fetchPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locationRef.current = {
            lat: parseFloat(pos.coords.latitude.toFixed(5)),
            lng: parseFloat(pos.coords.longitude.toFixed(5)),
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
          };
          initializedRef.current = true;
        },
        () => { /* permission denied or error — leave null */ },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    };

    // If enabled, always try to get location (will prompt if needed)
    fetchPosition();

    // Also check permissions for future auto-fetches
    if ('permissions' in navigator && (navigator as any).permissions?.query) {
      (navigator as any).permissions.query({ name: 'geolocation' })
        .then((result: { state: string }) => {
          if (result.state === 'granted' && !initializedRef.current) {
            fetchPosition();
          }
        })
        .catch(() => { /* permissions API not supported */ });
    }
  }, [enabled]);

  const getLocation = useCallback((): EntryLocation | null => {
    // Always return null if disabled
    if (!enabled) return null;
    return locationRef.current;
  }, [enabled]);

  return getLocation;
}
