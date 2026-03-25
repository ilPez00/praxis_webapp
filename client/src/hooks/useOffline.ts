/**
 * useOffline Hook
 * Detects online/offline status and provides sync utilities
 */

import { useState, useEffect } from 'react';
import { offlineSyncManager } from './offlineSyncManager';

interface OfflineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

/**
 * Hook to detect online/offline status and manage offline sync
 */
export function useOffline() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
  });

  useEffect(() => {
    // Update status
    const updateStatus = async () => {
      const newStatus = await offlineSyncManager.getSyncStatus();
      setStatus(newStatus);
    };

    // Initial update
    updateStatus();

    // Subscribe to changes
    const unsubscribe = offlineSyncManager.subscribe(() => {
      updateStatus();
    });

    // Listen to browser online/offline events
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    // Status
    isOnline: status.isOnline,
    isOffline: !status.isOnline,
    isSyncing: status.isSyncing,
    hasPendingSync: status.pendingCount > 0,
    pendingCount: status.pendingCount,

    // Actions
    saveForLater: offlineSyncManager.saveForLater.bind(offlineSyncManager),
    forceSync: offlineSyncManager.forceSync.bind(offlineSyncManager),
  };
}

/**
 * HOC to inject offline status into components
 */
export function withOffline<P extends object>(
  WrappedComponent: React.ComponentType<P & ReturnType<typeof useOffline>>
) {
  return function WithOffline(props: Omit<P, keyof ReturnType<typeof useOffline>>) {
    const offline = useOffline();
    return <WrappedComponent {...(props as P)} {...offline} />;
  };
}
