/**
 * IndexedDB Helper for Offline Notebook Storage
 * Stores notebook entries locally when offline
 */

const DB_NAME = 'praxis-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'notebook-entries';

interface OfflineEntry {
  id: string;
  entry_type: string;
  title?: string;
  content: string;
  mood?: string;
  tags?: string[];
  goal_id?: string;
  domain?: string;
  source_table?: string;
  source_id?: string;
  attachments?: any[];
  metadata?: any;
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  is_private?: boolean;
  occurred_at: string;
  created_at: string;
  synced: boolean;
  sync_attempted: number;
}

class OfflineDB {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Open database connection
   */
  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineDB] Failed to open database');
        this.openPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.openPromise = null;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for notebook entries
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          
          // Indexes for querying
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('occurred_at', 'occurred_at', { unique: false });
          store.createIndex('entry_type', 'entry_type', { unique: false });
        }
      };
    });

    return this.openPromise;
  }

  /**
   * Save entry to offline storage
   */
  async saveEntry(entry: OfflineEntry): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all unsynced entries
   */
  async getUnsyncedEntries(): Promise<OfflineEntry[]> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all entries (for offline viewing)
   */
  async getAllEntries(): Promise<OfflineEntry[]> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark entry as synced
   */
  async markAsSynced(id: string): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (entry) {
          entry.synced = true;
          const putRequest = store.put(entry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete entry from offline storage
   */
  async deleteEntry(id: string): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all synced entries (keep only unsynced)
   */
  async clearSynced(): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('synced');
      const request = index.openCursor(IDBKeyRange.only(true));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get count of unsynced entries
   */
  async getUnsyncedCount(): Promise<number> {
    const entries = await this.getUnsyncedEntries();
    return entries.length;
  }

  /**
   * Increment sync attempt counter
   */
  async incrementSyncAttempt(id: string): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (entry) {
          entry.sync_attempted = (entry.sync_attempted || 0) + 1;
          const putRequest = store.put(entry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}

// Export singleton instance
export const offlineDB = new OfflineDB();

// Initialize DB on load
if (typeof indexedDB !== 'undefined') {
  offlineDB.open().catch(console.error);
}

export type { OfflineEntry };
