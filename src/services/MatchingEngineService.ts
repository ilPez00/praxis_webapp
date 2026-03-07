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
   * Token-level Jaccard similarity between two goal nodes' text (name + description).
   * Stopwords are removed; tokens shorter than 3 chars are ignored.
   */
  private textTokenSimilarity(a: GoalNode, b: GoalNode): number {
    const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'is', 'my', 'i', 'be', 'on', 'at', 'by', 'it', 'as', 'do', 'so']);
    const tokenize = (node: GoalNode): Set<string> => {
      const text = `${node.name} ${(node as any).customDetails || ''}`.toLowerCase();
      const tokens = text.split(/\W+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
      return new Set(tokens);
    };
    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const t of Array.from(setA)) if (setB.has(t)) intersection++;
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Fallback compatibility score combining:
   *   - Domain-level Jaccard overlap (structural signal)
   *   - Within-domain token text similarity on goal names/descriptions
   *   - Progress alignment (users at similar stages match better)
   *
   * score = 0.45 × domainOverlap + 0.35 × textSim + 0.20 × progressAlignment
   *
   * Used when GEMINI_API_KEY is unset or when the Gemini API call fails.
   */
  private domainOverlapFallback(nodesA: GoalNode[], nodesB: GoalNode[]): number {
    const domainsA = new Map<string, GoalNode[]>();
    const domainsB = new Map<string, GoalNode[]>();

    for (const node of nodesA) {
      const list = domainsA.get(node.domain) ?? [];
      list.push(node);
      domainsA.set(node.domain, list);
    }
    for (const node of nodesB) {
      const list = domainsB.get(node.domain) ?? [];
      list.push(node);
      domainsB.set(node.domain, list);
    }

    const maxDomains = Math.max(domainsA.size, domainsB.size);
    if (maxDomains === 0) return 0;

    // Domain overlap (Jaccard)
    const sharedDomains = Array.from(domainsA.keys()).filter(d => domainsB.has(d));
    const domainOverlap = sharedDomains.length / maxDomains;

    if (sharedDomains.length === 0) return 0;

    // Within-domain text similarity + progress alignment across all node pairs in shared domains
    let textSimSum = 0;
    let progressSimSum = 0;
    let totalWeight = 0;

    for (const domain of sharedDomains) {
      const nodesOfA = domainsA.get(domain)!;
      const nodesOfB = domainsB.get(domain)!;
      for (const nA of nodesOfA) {
        for (const nB of nodesOfB) {
          const w = (nA.weight ?? 1) * (nB.weight ?? 1);
          textSimSum += this.textTokenSimilarity(nA, nB) * w;
          progressSimSum += (1 - Math.abs((nA.progress ?? 0) - (nB.progress ?? 0))) * w;
          totalWeight += w;
        }
      }
    }

    const textSim = totalWeight > 0 ? textSimSum / totalWeight : 0;
    const progressSim = totalWeight > 0 ? progressSimSum / totalWeight : 0;

    return domainOverlap * 0.45 + textSim * 0.35 + progressSim * 0.20;
  }

  // TODO: Add methods for finding potential matches given a user's goal tree
}
