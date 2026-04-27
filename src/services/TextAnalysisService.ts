import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const EMBEDDING_MODEL = 'text-embedding-004';
const MAX_CORPUS_CHARS = 5000;
const MAX_DIARY_ENTRIES = 20;
const MAX_NOTEBOOK_ENTRIES = 20;

export class TextAnalysisService {
  private apiKeys: string[];

  constructor() {
    const key = process.env.GEMINI_API_KEY || '';
    this.apiKeys = key.split(',').filter(Boolean);
  }

  async buildTextCorpus(userId: string): Promise<{ text: string; sources: string[]; count: number }> {
    const sources: string[] = [];
    const parts: string[] = [];

    // 1. Bio
    const { data: profile } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', userId)
      .single();

    if (profile?.bio) {
      sources.push('bio');
      parts.push(`[Bio]\n${profile.bio}`);
    }

    // 2. Diary entries (non-private, last 20)
    const { data: diaryEntries } = await supabase
      .from('diary_entries')
      .select('content, mood, tags')
      .eq('user_id', userId)
      .eq('is_private', false)
      .not('content', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(MAX_DIARY_ENTRIES);

    if (diaryEntries && diaryEntries.length > 0) {
      sources.push('diary');
      const diaryText = diaryEntries
        .map(e => {
          const mood = e.mood ? ` (mood: ${e.mood})` : '';
          const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : '';
          return `${e.content}${mood}${tags}`;
        })
        .join('\n---\n');
      parts.push(`[Diary entries]\n${diaryText}`);
    }

    // 3. Notebook entries (non-private, last 20)
    const { data: notebookEntries } = await supabase
      .from('notebook_entries')
      .select('content, title, mood, tags')
      .eq('user_id', userId)
      .eq('is_private', false)
      .not('content', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(MAX_NOTEBOOK_ENTRIES);

    if (notebookEntries && notebookEntries.length > 0) {
      sources.push('notebook');
      const notebookText = notebookEntries
        .map(e => {
          const title = e.title ? `## ${e.title}\n` : '';
          const mood = e.mood ? ` (mood: ${e.mood})` : '';
          const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : '';
          return `${title}${e.content}${mood}${tags}`;
        })
        .join('\n---\n');
      parts.push(`[Notebook entries]\n${notebookText}`);
    }

    let text = parts.join('\n\n');

    // Truncate to max corpus size
    if (text.length > MAX_CORPUS_CHARS) {
      text = text.slice(0, MAX_CORPUS_CHARS);
    }

    const diaryCount = diaryEntries?.length ?? 0;
    const notebookCount = notebookEntries?.length ?? 0;
    return { text, sources, count: diaryCount + notebookCount };
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text.trim()) return null;

    for (const key of this.apiKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
          }),
        });

        if (!response.ok) {
          logger.warn(`[TextAnalysis] Embedding API error ${response.status} for key ${key.slice(0, 6)}`);
          continue;
        }

        const data = await response.json();
        return data.embedding?.values ?? null;
      } catch (err: any) {
        logger.warn(`[TextAnalysis] Embedding request failed for key ${key.slice(0, 6)}: ${err.message}`);
      }
    }

    return null;
  }

  async generateAndStoreEmbedding(userId: string): Promise<boolean> {
    const { text, sources, count } = await this.buildTextCorpus(userId);
    if (!text.trim()) {
      logger.info(`[TextAnalysis] No text corpus for user ${userId}, skipping`);
      return false;
    }

    const embedding = await this.generateEmbedding(text);
    if (!embedding) {
      logger.warn(`[TextAnalysis] Failed to generate embedding for user ${userId}`);
      return false;
    }

    const embeddingStr = `[${embedding.join(',')}]`;

    const { error } = await supabase.from('profile_embeddings').upsert(
      {
        user_id: userId,
        embedding: embeddingStr,
        text_sources: sources,
        entry_count: count,
        metadata: { char_count: text.length },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      logger.error(`[TextAnalysis] Failed to store embedding for user ${userId}: ${error.message}`);
      return false;
    }

    logger.info(`[TextAnalysis] Stored embedding for user ${userId} (sources: ${sources.join(',')}, chars: ${text.length})`);
    return true;
  }

  async refreshAllActiveUsers(): Promise<{ processed: number; failed: number }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activeUsers, error } = await supabase
      .from('profiles')
      .select('id')
      .gte('last_activity_date', sevenDaysAgo)
      .limit(200);

    if (error || !activeUsers) {
      logger.error(`[TextAnalysis] Failed to query active users: ${error?.message}`);
      return { processed: 0, failed: 0 };
    }

    logger.info(`[TextAnalysis] Refreshing embeddings for ${activeUsers.length} active users`);

    let processed = 0;
    let failed = 0;

    // Process in batches of 10 to avoid rate limiting
    for (let i = 0; i < activeUsers.length; i += 10) {
      const batch = activeUsers.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(u => this.generateAndStoreEmbedding(u.id))
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) processed++;
        else failed++;
      }

      if (i + 10 < activeUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`[TextAnalysis] Refresh complete: ${processed} succeeded, ${failed} failed`);
    return { processed, failed };
  }
}
