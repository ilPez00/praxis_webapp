import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

/**
 * Manages browser push notification subscription.
 * Call `subscribe()` after user grants permission.
 */
export function usePushNotifications(userId: string | undefined) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check existing subscription on mount
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub);
      });
    });
  }, [userId]);

  const subscribe = useCallback(async () => {
    if (!userId) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      // Get VAPID public key from backend
      const { data } = await api.get('/push/vapid-key');
      if (!data?.key) {
        console.warn('[Push] No VAPID key from server');
        setLoading(false);
        return false;
      }

      // Subscribe via PushManager
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.key).buffer as ArrayBuffer,
      });

      // Send subscription to backend
      await api.post('/push/subscribe', { subscription: sub.toJSON() });
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[Push] subscribe failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('[Push] unsubscribe failed:', err);
    }
  }, []);

  return { permission, subscribed, loading, subscribe, unsubscribe };
}

// Convert base64 VAPID key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
