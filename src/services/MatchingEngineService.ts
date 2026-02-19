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
   * Calculates the compatibility score S_AB between two users' goal trees.
   * Implements Algorithm 1 from the Praxis whitepaper §3.3.
   *
   * Normalization formula (§3.3):
   *   S_AB = Σ(sim(i,j) * W_i * W_j) / Σ(W_i * W_j)
   *
   * where sim(i,j) = semanticSimilarity(i,j) * (1 - |progress_i - progress_j|)
   * The progress factor ensures we match users at similar stages of their goals.
   * Only nodes sharing the same domain are compared (cross-domain is ignored).
   *
   * @param userATree The goal tree of user A.
   * @param userBTree The goal tree of user B.
   * @returns The normalized compatibility score S_AB in [0, 1].
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

    // Helper to calculate AI_sim using Gemini Embeddings, incorporating more goal details and progress similarity
    const aiSim = async (nodeA: GoalNode, nodeB: GoalNode): Promise<number> => {
      // Construct a richer text representation for each goal node to feed into the embedding model.
      // Include name, custom details, and category.
      const textA = `${nodeA.name}. ${nodeA.customDetails || ''} ${nodeA.category ? `Category: ${nodeA.category}.` : ''}`.trim();
      const textB = `${nodeB.name}. ${nodeB.customDetails || ''} ${nodeB.category ? `Category: ${nodeB.category}.` : ''}`.trim();

      const embeddingA = await getCachedEmbedding(textA);
      const embeddingB = await getCachedEmbedding(textB);

      // Calculate cosine similarity for the semantic content of the goals
      const semanticSimilarity = EmbeddingService.calculateCosineSimilarity(embeddingA, embeddingB);

      // Incorporate progress similarity.
      // Goals with similar progress (closer to 0 difference) should have a higher progress factor (closer to 1).
      // Goals with very different progress (closer to 1 difference) should have a lower progress factor (closer to 0).
      const progressDifference = Math.abs(nodeA.progress - nodeB.progress); // Range 0 to 1
      const progressSimilarityFactor = 1 - progressDifference; // Range 0 to 1

      // Combine semantic similarity and progress similarity.
      // The progress similarity factor acts as a modifier to the semantic similarity.
      // If goals are semantically very similar, but their progress is far apart, their overall similarity should be reduced.
      return Math.max(0, semanticSimilarity) * progressSimilarityFactor;
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
