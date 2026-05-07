import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import crypto from 'crypto';

/**
 * NotebookResumeService — periodic snapshot cache for NotebookLM queries.
 * Stores compressed snapshots so the LLM doesn't re-read the entire notebook
 * on every scan. Designed for cost reduction (fewer NotebookLM API calls).
 */
export class NotebookResumeService {
  /**
   * Save a snapshot of notebook query results for a user.
   * Uses a hash of the context + timestamp to detect stale entries.
   */
  static async saveSnapshot(
    userId: string,
    contextHash: string,
    data: any,
    ttlMinutes: number = 60,
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
      const { error } = await supabase.from('notebook_resumes').upsert({
        user_id: userId,
        context_hash: contextHash,
        data: data,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,context_hash' });

      if (error) logger.warn(`[NotebookResume] Save failed for ${userId}: ${error.message}`);
    } catch (err: any) {
      logger.warn(`[NotebookResume] Save error: ${err.message}`);
    }
  }

  /**
   * Load a cached snapshot if it exists and hasn't expired.
   * Returns null if no valid snapshot found.
   */
  static async loadSnapshot(
    userId: string,
    contextHash: string,
  ): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('notebook_resumes')
        .select('data, expires_at')
        .eq('user_id', userId)
        .eq('context_hash', contextHash)
        .single();

      if (error || !data) return null;

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        await supabase.from('notebook_resumes').delete().eq('user_id', userId).eq('context_hash', contextHash);
        return null;
      }

      return data.data;
    } catch (err: any) {
      logger.warn(`[NotebookResume] Load error: ${err.message}`);
      return null;
    }
  }

  /**
   * Generate a stable hash from an array of notebook IDs and a context seed.
   * This lets us detect if the notebook set has changed.
   */
  static hashNotebookSet(notebookIds: string[], contextSeed: string = ''): string {
    const sorted = [...notebookIds].sort().join(',');
    return crypto.createHash('md5').update(`${sorted}|${contextSeed}`).digest('hex');
  }

  /**
   * Generate a stable hash from a context string (for prompt caching).
   */
  static hashContext(context: string): string {
    return crypto.createHash('md5').update(context.slice(0, 1000)).digest('hex');
  }
}
