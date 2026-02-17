import { GoogleGenerativeAI } from '@google/generative-ai';

export class EmbeddingService {
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any; // Type for the embedding model

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // 'embedding-001' is a common choice for text embeddings.
    this.embeddingModel = this.genAI.getGenerativeModel({ model: "embedding-001" });
  }

  /**
   * Generates a text embedding for the given text using the Gemini API.
   * @param text The text to embed.
   * @returns A promise that resolves to an array of numbers representing the embedding.
   */
  public async getEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent({
        content: { parts: [{ text }] },
        taskType: "SEMANTIC_SIMILARITY",
      });
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
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
