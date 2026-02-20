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
    // embedding-001: 768-dimensional dense vector, suitable for semantic similarity.
    this.embeddingModel = this.genAI.getGenerativeModel({ model: "embedding-001" });
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
      const result = await this.embeddingModel.embedContent({
        content: { parts: [{ text }] },
        taskType: "SEMANTIC_SIMILARITY",
      });
      return result.embedding.values;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
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
