import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

/**
 * ConnectionTrackerService
 * Automatically logs "Connection" tracker entries for users who have active 
 * messaging streaks (exchanged messages over a week).
 */
export class ConnectionTrackerService {
  public static start() {
    // Run daily at 00:30 (shortly after AxiomScan)
    cron.schedule('30 0 * * *', async () => {
      logger.info('[ConnectionTracker] Starting daily sync...');
      try {
        await this.syncActiveConnections();
      } catch (err: any) {
        logger.error('[ConnectionTracker] Sync failed:', err.message);
      }
    });
    logger.info('[ConnectionTracker] Daily cron job scheduled.');
  }

  public static async syncActiveConnections() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Identify all active message participants in the last 7 days
    // Logic: find pairs (u1, u2) who have BOTH sent messages to each other within the window.
    // This is a "connection" event.
    
    // Fetch all message metadata from the last 7 days
    const { data: messages, error } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, timestamp')
      .gte('timestamp', sevenDaysAgo.toISOString())
      .is('room_id', null); // Only DMs

    if (error) throw error;
    if (!messages || messages.length === 0) return;

    // Build a map of bidirectional exchanges
    const interactions = new Map<string, Set<string>>();
    for (const msg of messages) {
      if (!msg.receiver_id) continue;
      const key = [msg.sender_id, msg.receiver_id].sort().join(':');
      if (!interactions.has(key)) interactions.set(key, new Set());
      interactions.get(key)!.add(msg.sender_id);
    }

    let logCount = 0;
    for (const [key, participants] of interactions.entries()) {
      // If both users sent at least one message, it's a mutual connection
      if (participants.size === 2) {
        const [u1, u2] = key.split(':');
        await this.logConnection(u1, u2);
        await this.logConnection(u2, u1);
        logCount += 2;
      }
    }

    logger.info(`[ConnectionTracker] Logged ${logCount} connection entries across all users.`);
  }

  private static async logConnection(userId: string, targetId: string) {
    try {
      // Get or create tracker
      const { data: tracker } = await supabase
        .from('trackers')
        .upsert({ user_id: userId, type: 'connection' }, { onConflict: 'user_id,type' })
        .select('id')
        .single();

      if (!tracker) return;

      // Check if already logged today to prevent duplicates
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from('tracker_entries')
        .select('id')
        .eq('tracker_id', tracker.id)
        .eq('user_id', userId)
        .contains('data', { target_id: targetId })
        .gte('logged_at', today)
        .maybeSingle();

      if (existing) return;

      // Log the entry
      await supabase.from('tracker_entries').insert({
        tracker_id: tracker.id,
        user_id: userId,
        data: { target_id: targetId, type: 'active_chat', window: '7d' }
      });
    } catch (err: any) {
      logger.warn(`[ConnectionTracker] Failed to log connection for ${userId}: ${err.message}`);
    }
  }
}
