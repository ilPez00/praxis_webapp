import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';
import { EmbeddingService } from './EmbeddingService'; // Import the new EmbeddingService

export class MatchingEngineService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Calculates the compatibility score between two users' goal trees.
   * Based on Algorithm 1 Praxis Matching Engine from the whitepaper.
   * @param userATree The goal tree of user A.
   * @param userBTree The goal tree of user B.
   * @returns The compatibility score S_AB.
   */
  public async calculateCompatibilityScore(userATree: GoalTree, userBTree: GoalTree): Promise<number> {
    let sAB = 0;
    let totalWeightProduct = 0;

    if (!userATree.nodes || userATree.nodes.length === 0 || !userBTree.nodes || userBTree.nodes.length === 0) {
        return 0; // No goals, no compatibility
    }

    // Cache embeddings to avoid redundant API calls
    const embeddingCache = new Map<string, number[]>();

    const getCachedEmbedding = async (text: string): Promise<number[]> => {
      if (embeddingCache.has(text)) {
        return embeddingCache.get(text)!;
      }
      const embedding = await this.embeddingService.getEmbedding(text);
      embeddingCache.set(text, embedding);
      return embedding;
    };

    // Helper to calculate AI_sim using Gemini Embeddings
    const aiSim = async (nodeA: GoalNode, nodeB: GoalNode): Promise<number> => {
      // For now, compare based on goal name. Could extend to description later.
      const embeddingA = await getCachedEmbedding(nodeA.name);
      const embeddingB = await getCachedEmbedding(nodeB.name);

      return EmbeddingService.calculateCosineSimilarity(embeddingA, embeddingB);
    };

    for (const nodeA of userATree.nodes) {
      for (const nodeB of userBTree.nodes) {
        if (nodeA.domain === nodeB.domain) {
          const sim = await aiSim(nodeA, nodeB); // Await the async aiSim function
          const weightProduct = nodeA.weight * nodeB.weight;
          sAB += sim * weightProduct;
          totalWeightProduct += weightProduct;
        }
      }
    }

    return totalWeightProduct > 0 ? sAB / totalWeightProduct : 0;
  }

  // TODO: Add methods for finding potential matches given a user's goal tree
}
