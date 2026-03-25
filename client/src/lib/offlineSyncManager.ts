/**
 * Offline Sync Manager
 * Handles syncing offline entries when connection is restored
 */

import { offlineDB, OfflineEntry } from './offlineDB';
import api from './api';
import toast from 'react-hot-toast';

const MAX_SYNC_ATTEMPTS = 3;

class OfflineSyncManager {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Check initial state
    this.isOnline = navigator.onLine;

    // Start sync if online
    if (this.isOnline) {
      this.syncPendingEntries();
    }
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Handle online event
   */
  private async handleOnline() {
    console.log('[OfflineSync] Connection restored');
    this.isOnline = true;
    this.notifyListeners();
    
    // Sync pending entries
    await this.syncPendingEntries();
  }

  /**
   * Handle offline event
   */
  private handleOffline() {
    console.log('[OfflineSync] Connection lost');
    this.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline && navigator.onLine;
  }

  /**
   * Save entry for offline sync
   */
  async saveForLater(entry: OfflineEntry): Promise<void> {
    await offlineDB.saveEntry(entry);
    this.notifyListeners();
    
    toast.success('Saved offline - will sync when online', {
      icon: '📭',
      duration: 3000,
    });
  }

  /**
   * Sync all pending entries
   */
  async syncPendingEntries(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isCurrentlyOnline()) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const unsyncedEntries = await offlineDB.getUnsyncedEntries();
      
      if (unsyncedEntries.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[OfflineSync] Syncing ${unsyncedEntries.length} entries...`);

      let successCount = 0;
      let failedCount = 0;

      for (const entry of unsyncedEntries) {
        try {
          // Check if max attempts reached
          if ((entry.sync_attempted || 0) >= MAX_SYNC_ATTEMPTS) {
            console.warn(`[OfflineSync] Max attempts reached for entry ${entry.id}, skipping`);
            failedCount++;
            continue;
          }

          // Increment attempt counter
          await offlineDB.incrementSyncAttempt(entry.id);

          // Prepare payload (remove sync metadata)
          const { synced, sync_attempted, ...payload } = entry;

          // Send to API
          await api.post('/notebook/entries', payload);

          // Mark as synced
          await offlineDB.markAsSynced(entry.id);
          successCount++;

          console.log(`[OfflineSync] Synced entry ${entry.id}`);
        } catch (error: any) {
          failedCount++;
          console.error(`[OfflineSync] Failed to sync entry ${entry.id}:`, error.message);
          
          // Don't show error toast for every failed sync
          // User will be notified if all fail
        }
      }

      // Show summary toast
      if (successCount > 0) {
        toast.success(`Synced ${successCount} offline entr${successCount === 1 ? 'y' : 'ies'}!`, {
          icon: '📬',
          duration: 4000,
        });
      }

      if (failedCount === unsyncedEntries.length) {
        toast.error('Failed to sync offline entries. Please check connection.', {
          duration: 5000,
        });
      }

      // Clean up synced entries
      await offlineDB.clearSynced();

    } catch (error: any) {
      console.error('[OfflineSync] Sync failed:', error.message);
      toast.error('Sync failed. Will retry when connection is stable.');
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
  }> {
    const pendingCount = await offlineDB.getUnsyncedCount();
    return {
      isOnline: this.isCurrentlyOnline(),
      isSyncing: this.isSyncing,
      pendingCount,
    };
  }

  /**
   * Force sync (user triggered)
   */
  async forceSync(): Promise<void> {
    if (!this.isCurrentlyOnline()) {
      toast.error('No internet connection. Please connect to sync.');
      return;
    }

    await this.syncPendingEntries();
  }
}

// Export singleton instance
export const offlineSyncManager = new OfflineSyncManager();

// Export hook for React components
export function useOfflineSync() {
  const [status, setStatus] = React.useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
  });

  React.useEffect(() => {
    const updateStatus = async () => {
      const newStatus = await offlineSyncManager.getSyncStatus();
      setStatus(newStatus);
    };

    updateStatus();

    const unsubscribe = offlineSyncManager.subscribe(() => {
      updateStatus();
    });

    return unsubscribe;
  }, []);

  return {
    ...status,
    saveForLater: offlineSyncManager.saveForLater.bind(offlineSyncManager),
    forceSync: offlineSyncManager.forceSync.bind(offlineSyncManager),
  };
}

// Need to import React for the hook
import React from 'react';
