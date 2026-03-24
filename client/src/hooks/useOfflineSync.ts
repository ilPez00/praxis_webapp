import { useEffect } from 'react';
import { db } from '../lib/db';
import api from '../lib/api';
import toast from 'react-hot-toast';

/**
 * Hook to periodically sync pending offline data with the server.
 * Syncs both journal entries and tracker entries.
 */
export const useOfflineSync = () => {
  useEffect(() => {
    const syncPending = async () => {
      // Sync journal entries
      await syncJournalEntries();
      
      // Sync tracker entries
      await syncTrackerEntries();
    };

    const syncJournalEntries = async () => {
      const pending = await db.journalEntries
        .where('sync_status')
        .equals('pending')
        .toArray();

      if (pending.length === 0) return;

      console.debug(`[OfflineSync] Syncing ${pending.length} journal entries...`);

      for (const entry of pending) {
        try {
          await api.post('/journal/entries', {
            nodeId: entry.node_id,
            note: entry.note,
            mood: entry.mood,
          });

          await db.journalEntries.update(entry.id!, { sync_status: 'synced' });
          console.debug(`[OfflineSync] Journal entry ${entry.id} synced`);
        } catch (err: any) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            console.warn('[OfflineSync] Unauthorized, skipping journal sync.');
            break;
          }
          await db.journalEntries.update(entry.id!, { 
            sync_status: 'failed',
            error: err.message 
          });
          console.error(`[OfflineSync] Failed to sync journal entry ${entry.id}:`, err.message);
        }
      }
    };

    const syncTrackerEntries = async () => {
      const pending = await db.trackerEntries
        .where('sync_status')
        .equals('pending')
        .toArray();

      if (pending.length === 0) return;

      console.debug(`[OfflineSync] Syncing ${pending.length} tracker entries...`);

      let syncedCount = 0;
      for (const entry of pending) {
        try {
          await api.post('/trackers/log', {
            type: entry.tracker_type,
            data: entry.data,
            logged_at: entry.logged_at,
          });

          await db.trackerEntries.update(entry.id!, { sync_status: 'synced' });
          syncedCount++;
          console.debug(`[OfflineSync] Tracker entry ${entry.id} synced`);
        } catch (err: any) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            console.warn('[OfflineSync] Unauthorized, skipping tracker sync.');
            break;
          }
          await db.trackerEntries.update(entry.id!, { 
            sync_status: 'failed',
            error: err.message 
          });
          console.error(`[OfflineSync] Failed to sync tracker entry ${entry.id}:`, err.message);
        }
      }

      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} tracker entr${syncedCount === 1 ? 'y' : 'ies'}`);
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
