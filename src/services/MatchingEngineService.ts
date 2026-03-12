import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';
import { EmbeddingService } from './EmbeddingService';

export class MatchingEngineService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Calculates compatibility score.
   * Optimized to prioritize speed and structural overlap.
   */
  public async calculateCompatibilityScore(userATree: GoalTree, userBTree: GoalTree): Promise<number> {
    const nodesA = userATree.nodes || [];
    const nodesB = userBTree.nodes || [];

    if (nodesA.length === 0 || nodesB.length === 0) return 0;

    // Use fast domain-overlap logic by default for live matching fallback
    // The vector search handles the heavy 'semantic' matching
    return this.domainOverlapFallback(nodesA, nodesB);
  }

  /**
   * Optimized Fallback logic: O(N + M) instead of O(N*M)
   */
  private domainOverlapFallback(nodesA: GoalNode[], nodesB: GoalNode[]): number {
    const domainsA = new Set(nodesA.map(n => n.domain).filter(Boolean));
    const domainsB = new Set(nodesB.map(n => n.domain).filter(Boolean));

    const intersection = new Set([...domainsA].filter(x => domainsB.has(x)));
    const union = new Set([...domainsA, ...domainsB]);

    if (union.size === 0) return 0;
    const jaccard = intersection.size / union.size;

    // Add a small bonus for progress alignment in shared domains
    let progressSim = 0;
    if (intersection.size > 0) {
      const avgA = nodesA.reduce((s, n) => s + (n.progress || 0), 0) / nodesA.length;
      const avgB = nodesB.reduce((s, n) => s + (n.progress || 0), 0) / nodesB.length;
      progressSim = 1 - Math.abs(avgA - avgB);
    }

    return (jaccard * 0.8) + (progressSim * 0.2);
  }
}
