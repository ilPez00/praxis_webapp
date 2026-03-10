import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger';
import { supabase } from '../lib/supabaseClient';

/**
 * EmbeddingService wraps the Google Gemini text embedding model for semantic similarity.
 *
 * Model used: "embedding-001" (Gemini Text Embedding, 768-dim vectors)
 * Task type: SEMANTIC_SIMILARITY — optimized for comparing goal descriptions.
 *
 * Cost note: Each getEmbedding() call makes a Gemini API request.
 * The MatchingEngineService uses an in-request cache (Map) to avoid duplicate
 * calls for the same goal text within a single match calculation. However,
 * for large user bases the full O(|A| * |B|) comparison across all user pairs
 * in matchingController.ts could be expensive. Consider pre-computing and
 * storing embeddings in the database if latency/cost becomes a concern.
 */
export class EmbeddingService {
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingModel: any = null; // Type for the embedding model

  /** Whether the Gemini API key was found and the model is ready. */
  public readonly available: boolean;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY is not set — embedding-based matching is disabled. Domain-overlap fallback will be used.');
      this.available = false;
      return;
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Explicitly using v1 to avoid experimental v1beta issues if possible
    // Note: The SDK currently defaults to v1beta for some methods, we can try to force it.
    this.embeddingModel = this.genAI.getGenerativeModel({ 
      model: "text-embedding-004"
    }, { apiVersion: 'v1' });
    this.available = true;
  }

  /**
   * Generates a text embedding for the given text using the Gemini API.
   * Throws if called when the service is unavailable (check `available` first).
   * @param text The text to embed.
   * @returns A promise that resolves to an array of numbers representing the embedding.
   */
  public async getEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModel) {
      throw new Error('EmbeddingService: Gemini model not available. Check GEMINI_API_KEY.');
    }
    try {
      // For text-embedding-004, taskType is required. 
      // RETRIEVAL_DOCUMENT is for the content being indexed.
      const result = await this.embeddingModel.embedContent({
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
      });
      return result.embedding.values;
    } catch (error: any) {
      logger.error('Error generating embedding:', error.message);
      
      // Fallback 1: try without explicit taskType (for older models or versions)
      if (error.message?.includes('task_type')) {
        try {
          const res = await this.embeddingModel.embedContent(text);
          return res.embedding.values;
        } catch {}
      }

      // Fallback 2: try embedding-001 if 004 is unavailable
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        logger.info('text-embedding-004 failed, trying embedding-001...');
        const fallbackModel = this.genAI!.getGenerativeModel({ model: "embedding-001" }, { apiVersion: 'v1' });
        try {
          const result = await fallbackModel.embedContent(text);
          return result.embedding.values;
        } catch (err2: any) {
          logger.error('Fallback embedding-001 also failed:', err2.message);
        }
      }
      throw error;
    }
  }

  /**
   * Returns the stored embedding for a given goal node from the DB cache,
   * or generates (and stores) a fresh one via Gemini if not found.
   *
   * This is the Phase-4 embedding cache: once a goal node's embedding is stored
   * in the `goal_embeddings` table it is reused on every subsequent match request,
   * avoiding redundant Gemini API calls and reducing latency + cost.
   *
   * @param goalNodeId  The goal node UUID (primary cache key).
   * @param text        The canonical text to embed (used only on a cache miss).
   */
  public async getEmbeddingWithCache(goalNodeId: string, text: string): Promise<number[]> {
    if (!this.available) {
      throw new Error('EmbeddingService: not available. Check GEMINI_API_KEY.');
    }
    // 1. Try DB cache first
    const { data } = await supabase
      .from('goal_embeddings')
      .select('embedding')
      .eq('goal_node_id', goalNodeId)
      .maybeSingle();

    if (data?.embedding) {
      logger.debug(`Embedding cache HIT for node ${goalNodeId}`);
      return data.embedding as number[];
    }

    // 2. Cache miss — call Gemini and persist
    logger.debug(`Embedding cache MISS for node ${goalNodeId} — calling Gemini`);
    const embedding = await this.getEmbedding(text);
    await supabase.from('goal_embeddings').upsert(
      { goal_node_id: goalNodeId, embedding, node_name: text, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,goal_node_id' }
    );
    return embedding;
  }

  /**
   * Generates embeddings for a list of goal nodes and upserts them into the
   * `goal_embeddings` table for later use by the pgvector RPC matcher.
   * Called fire-and-forget from goalController after every goal tree save.
   * Silently skips if the service is unavailable.
   */
  public async generateAndStoreEmbeddings(
    userId: string,
    nodes: { id: string; domain: string; name: string; customDetails?: string }[],
  ): Promise<void> {
    if (!this.available) return;
    for (const node of nodes) {
      const text = `${node.name}. ${node.customDetails || ''}`.trim();
      try {
        const embedding = await this.getEmbedding(text);
        await supabase.from('goal_embeddings').upsert({
          user_id: userId,
          goal_node_id: node.id,
          domain: node.domain,
          node_name: node.name,
          embedding,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,goal_node_id' });
      } catch (err) {
        logger.error(`Failed to store embedding for node ${node.id}:`, err);
      }
    }
  }

  /**
   * Calculates the cosine similarity between two embedding vectors.
   * @param embedding1 The first embedding vector.
   * @param embedding2 The second embedding vector.
   * @returns The cosine similarity between the two vectors.
   */
  public static calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0; // Avoid division by zero
    }

    return dotProduct / (magnitude1 * magnitude2);
  }
}
