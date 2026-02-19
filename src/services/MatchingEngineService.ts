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
    if (!userATree.nodes || userATree.nodes.length === 0 || !userBTree.nodes || userBTree.nodes.length === 0) {
      return 0; // No goals, no compatibility
    }

    // If Gemini embeddings are unavailable, use the domain-overlap fallback (§3.3 approximation).
    if (!this.embeddingService.available) {
      return this.domainOverlapFallback(userATree.nodes, userBTree.nodes);
    }

    try {
      return await this.embeddingCompatibilityScore(userATree.nodes, userBTree.nodes);
    } catch (err) {
      // If the Gemini API call fails mid-request (rate limit, network error, etc.),
      // degrade gracefully to the domain-overlap fallback rather than propagating the error.
      return this.domainOverlapFallback(userATree.nodes, userBTree.nodes);
    }
  }

  /**
   * Full Gemini-embedding-based compatibility score.
   * Implements S_AB = Σ(sim(i,j) * W_i * W_j) / Σ(W_i * W_j) from whitepaper §3.3.
   */
  private async embeddingCompatibilityScore(nodesA: GoalNode[], nodesB: GoalNode[]): Promise<number> {
    let sAB = 0;
    let totalWeightProduct = 0;

    // Cache embeddings to avoid redundant API calls within a single match calculation
    const embeddingCache = new Map<string, number[]>();
    const getCachedEmbedding = async (text: string): Promise<number[]> => {
      if (embeddingCache.has(text)) return embeddingCache.get(text)!;
      const embedding = await this.embeddingService.getEmbedding(text);
      embeddingCache.set(text, embedding);
      return embedding;
    };

    const aiSim = async (nodeA: GoalNode, nodeB: GoalNode): Promise<number> => {
      const textA = `${nodeA.name}. ${nodeA.customDetails || ''} ${nodeA.category ? `Category: ${nodeA.category}.` : ''}`.trim();
      const textB = `${nodeB.name}. ${nodeB.customDetails || ''} ${nodeB.category ? `Category: ${nodeB.category}.` : ''}`.trim();
      const [embeddingA, embeddingB] = await Promise.all([getCachedEmbedding(textA), getCachedEmbedding(textB)]);
      const semanticSimilarity = EmbeddingService.calculateCosineSimilarity(embeddingA, embeddingB);
      const progressSimilarityFactor = 1 - Math.abs(nodeA.progress - nodeB.progress);
      return Math.max(0, semanticSimilarity) * progressSimilarityFactor;
    };

    for (const nodeA of nodesA) {
      for (const nodeB of nodesB) {
        if (nodeA.domain === nodeB.domain) {
          const sim = await aiSim(nodeA, nodeB);
          const weightProduct = nodeA.weight * nodeB.weight;
          sAB += sim * weightProduct;
          totalWeightProduct += weightProduct;
        }
      }
    }

    return totalWeightProduct > 0 ? sAB / totalWeightProduct : 0;
  }

  /**
   * Fallback compatibility score based on domain overlap and progress alignment.
   * Used when GEMINI_API_KEY is unset or when the Gemini API call fails.
   *
   * score = (shared_domain_count / max_domains) × 0.7
   *       + (1 - avg_progress_diff_across_shared_domains) × 0.3
   *
   * This is a rough approximation that captures topical alignment without semantics.
   */
  private domainOverlapFallback(nodesA: GoalNode[], nodesB: GoalNode[]): number {
    const domainsA = new Map<string, number>(); // domain → average progress
    const domainsB = new Map<string, number>();

    for (const node of nodesA) {
      const existing = domainsA.get(node.domain) ?? 0;
      domainsA.set(node.domain, (existing + node.progress) / 2);
    }
    for (const node of nodesB) {
      const existing = domainsB.get(node.domain) ?? 0;
      domainsB.set(node.domain, (existing + node.progress) / 2);
    }

    const maxDomains = Math.max(domainsA.size, domainsB.size);
    if (maxDomains === 0) return 0;

    let sharedCount = 0;
    let totalProgressDiff = 0;

    for (const [domain, progressA] of domainsA) {
      if (domainsB.has(domain)) {
        sharedCount++;
        totalProgressDiff += Math.abs(progressA - domainsB.get(domain)!);
      }
    }

    if (sharedCount === 0) return 0;

    const overlapScore = sharedCount / maxDomains;
    const avgProgressDiff = totalProgressDiff / sharedCount;
    const progressScore = 1 - avgProgressDiff;

    return overlapScore * 0.7 + progressScore * 0.3;
  }

  // TODO: Add methods for finding potential matches given a user's goal tree
}
