import Dexie, { Table } from 'dexie';

export interface LocalJournalEntry {
  id?: string; // Local UUID or increment
  node_id: string;
  note: string;
  mood: string | null;
  logged_at: string;
  sync_status: 'synced' | 'pending' | 'failed';
  error?: string;
}

export interface LocalTrackerEntry {
  id?: number;
  tracker_id: string;
  tracker_type: string;
  data: Record<string, any>;
  logged_at: string;
  sync_status: 'synced' | 'pending' | 'failed';
  error?: string;
}

export class PraxisDatabase extends Dexie {
  journalEntries!: Table<LocalJournalEntry>;
  trackerEntries!: Table<LocalTrackerEntry>;

  constructor() {
    super('PraxisOfflineDB');
    this.version(2).stores({
      journalEntries: '++id, node_id, sync_status, logged_at',
      trackerEntries: '++id, tracker_id, sync_status, logged_at'
    });
  }
}

export const db = new PraxisDatabase();
