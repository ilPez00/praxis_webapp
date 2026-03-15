import { useEffect } from 'react';
import { db } from '../lib/db';
import api from '../lib/api';

/**
 * Hook to periodically sync pending offline data with the server.
 */
export const useOfflineSync = () => {
  useEffect(() => {
    const syncPending = async () => {
      // Find all pending entries
      const pending = await db.journalEntries
        .where('sync_status')
        .equals('pending')
        .toArray();

      if (pending.length === 0) return;

      console.log(`[OfflineSync] Attempting to sync ${pending.length} entries...`);

      for (const entry of pending) {
        try {
          await api.post('/journal/entries', {
            nodeId: entry.node_id,
            note: entry.note,
            mood: entry.mood,
            // In a real production app, we'd want the server to accept a custom 'logged_at' 
            // but for now we sync as current. 
            // Ideal: add 'created_at' to backend to preserve offline timestamp.
          });

          // Mark as synced
          await db.journalEntries.update(entry.id!, { sync_status: 'synced' });
        } catch (err: any) {
          // If it's a 401/403, we probably need to wait for login, stop sync for now
          if (err.response?.status === 401 || err.response?.status === 403) {
            console.warn('[OfflineSync] Unauthorized, skipping sync.');
            break;
          }
          // Other errors (500, network still down) - we'll retry next time
          console.error(`[OfflineSync] Failed to sync entry ${entry.id}:`, err.message);
        }
      }
    };

    // Run on mount
    syncPending();

    // Run when coming back online
    window.addEventListener('online', syncPending);

    // Periodic check every 5 minutes
    const interval = setInterval(syncPending, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', syncPending);
      clearInterval(interval);
    };
  }, []);
};
