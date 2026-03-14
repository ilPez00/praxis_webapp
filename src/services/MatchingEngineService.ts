import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';

/**
 * Minimal AI Matching Engine — pure rule-based scoring.
 * No embeddings, no API calls. Fast and deterministic.
 */
export class MatchingEngineService {
  /**
   * Calculates compatibility score using pure rule-based logic.
   * Factors: domain overlap (60%), progress similarity (25%), structure depth (15%)
   */
  public async calculateCompatibilityScore(userATree: GoalTree, userBTree: GoalTree): Promise<number> {
    const nodesA = userATree.nodes || [];
    const nodesB = userBTree.nodes || [];

    if (nodesA.length === 0 || nodesB.length === 0) return 0;

    const domainScore = this.calculateDomainOverlap(nodesA, nodesB);
    const progressScore = this.calculateProgressSimilarity(nodesA, nodesB);
    const structureScore = this.calculateStructureSimilarity(nodesA, nodesB);

    // Weighted combination
    return (domainScore * 0.6) + (progressScore * 0.25) + (structureScore * 0.15);
  }

  /**
   * Domain overlap using Jaccard similarity. O(N + M) complexity.
   */
  private calculateDomainOverlap(nodesA: GoalNode[], nodesB: GoalNode[]): number {
    const domainsA = new Set(nodesA.map((n: GoalNode) => n.domain).filter(Boolean));
    const domainsB = new Set(nodesB.map((n: GoalNode) => n.domain).filter(Boolean));

    const intersection = new Set([...domainsA].filter(x => domainsB.has(x)));
    const union = new Set([...domainsA, ...domainsB]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Progress similarity: compares average progress in shared domains.
   */
  private calculateProgressSimilarity(nodesA: GoalNode[], nodesB: GoalNode[]): number {
    const domainsA = new Set(nodesA.map((n: GoalNode) => n.domain).filter(Boolean));
    const domainsB = new Set(nodesB.map((n: GoalNode) => n.domain).filter(Boolean));
    const sharedDomains = [...domainsA].filter(x => domainsB.has(x));

    if (sharedDomains.length === 0) return 0.5; // neutral score if no shared domains

    const avgProgressA = nodesA.reduce((s, n) => s + (n.progress || 0), 0) / nodesA.length;
    const avgProgressB = nodesB.reduce((s, n) => s + (n.progress || 0), 0) / nodesB.length;

    // 1 - normalized difference gives similarity (0-1 range)
    return 1 - Math.abs(avgProgressA - avgProgressB);
  }

  /**
   * Structure similarity: compares tree depth and node count.
   * Calculates depth from parentId relationships.
   */
  private calculateStructureSimilarity(nodesA: GoalNode[], nodesB: GoalNode[]): number {
    const maxDepthA = this.calculateMaxDepth(nodesA);
    const maxDepthB = this.calculateMaxDepth(nodesB);
    const countA = nodesA.length;
    const countB = nodesB.length;

    const depthSim = maxDepthA > 0 && maxDepthB > 0
      ? 1 - Math.abs(maxDepthA - maxDepthB) / Math.max(maxDepthA, maxDepthB)
      : 0.5;

    const countSim = countA > 0 && countB > 0
      ? 1 - Math.abs(countA - countB) / Math.max(countA, countB)
      : 0.5;

    return (depthSim + countSim) / 2;
  }

  /**
   * Calculate max tree depth from node array by traversing parentId relationships.
   */
  private calculateMaxDepth(nodes: GoalNode[]): number {
    if (nodes.length === 0) return 0;
    
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let maxDepth = 1;

    for (const node of nodes) {
      let depth = 1;
      let current = node;
      while (current.parentId && nodeMap.has(current.parentId)) {
        depth++;
        const parent = nodeMap.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }
}
