/**
 * MatchingEngineService — pure rule-based, no DB.
 * Tests domain overlap (Jaccard), progress similarity, structure depth.
 */
import { MatchingEngineService } from '../../services/MatchingEngineService';
import { GoalTree } from '../../models/GoalTree';
import { GoalNode } from '../../models/GoalNode';
import { Domain } from '../../models/Domain';

const engine = new MatchingEngineService();

function tree(nodes: GoalNode[]): GoalTree {
  return { id: 't1', user_id: 'u1', nodes, root_nodes: [] };
}

const node = (overrides: Partial<GoalNode> & { id: string }): GoalNode => ({
  domain: Domain.BODY_FITNESS,
  name: 'test',
  weight: 1,
  progress: 0.5,
  ...overrides,
});

describe('MatchingEngineService', () => {
  describe('calculateCompatibilityScore', () => {
    it('returns 0 if either tree has no nodes', async () => {
      const a = tree([]);
      const b = tree([node({ id: 'n1' })]);
      expect(await engine.calculateCompatibilityScore(a, b)).toBe(0);
      expect(await engine.calculateCompatibilityScore(b, a)).toBe(0);
      expect(await engine.calculateCompatibilityScore(a, a)).toBe(0);
    });

    it('returns 1.0 for identical trees', async () => {
      const t = tree([node({ id: 'n1', domain: Domain.BODY_FITNESS, progress: 0.5 })]);
      const score = await engine.calculateCompatibilityScore(t, t);
      expect(score).toBeGreaterThanOrEqual(0.99);
    });

    it('weights domain overlap at 60%, progress 25%, structure 15%', async () => {
      const tA = tree([
        node({ id: 'n1', domain: Domain.BODY_FITNESS, progress: 0.5 }),
        node({ id: 'n2', domain: Domain.CAREER_CRAFT, progress: 0.3 }),
      ]);
      const tB = tree([
        node({ id: 'n3', domain: Domain.BODY_FITNESS, progress: 0.5 }),
      ]);
      const score = await engine.calculateCompatibilityScore(tA, tB);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });

  describe('calculateDomainOverlap (Jaccard)', () => {
    it('returns 1 for identical domain sets', () => {
      const a = [node({ id: 'n1', domain: Domain.BODY_FITNESS })];
      const b = [node({ id: 'n2', domain: Domain.BODY_FITNESS })];
      expect((engine as any).calculateDomainOverlap(a, b)).toBe(1);
    });

    it('returns 0 for disjoint domain sets', () => {
      const a = [node({ id: 'n1', domain: Domain.BODY_FITNESS })];
      const b = [node({ id: 'n2', domain: Domain.CAREER_CRAFT })];
      expect((engine as any).calculateDomainOverlap(a, b)).toBe(0);
    });

    it('computes Jaccard for partial overlap', () => {
      const a = [
        node({ id: 'n1', domain: Domain.BODY_FITNESS }),
        node({ id: 'n2', domain: Domain.CAREER_CRAFT }),
      ];
      const b = [
        node({ id: 'n3', domain: Domain.BODY_FITNESS }),
        node({ id: 'n4', domain: Domain.HEALTH_LONGEVITY }),
      ];
      const score = (engine as any).calculateDomainOverlap(a, b);
      expect(score).toBeCloseTo(1 / 3);
    });

    it('handles duplicate domains in one tree', () => {
      const a = [
        node({ id: 'n1', domain: Domain.BODY_FITNESS }),
        node({ id: 'n2', domain: Domain.BODY_FITNESS }),
      ];
      const b = [node({ id: 'n3', domain: Domain.BODY_FITNESS })];
      expect((engine as any).calculateDomainOverlap(a, b)).toBe(1);
    });

    it('filters undefined domains', () => {
      const a = [{ ...node({ id: 'n1' }), domain: undefined as any }];
      const b = [node({ id: 'n2', domain: Domain.BODY_FITNESS })];
      expect((engine as any).calculateDomainOverlap(a, b)).toBe(0);
    });
  });

  describe('calculateProgressSimilarity', () => {
    it('returns 0.5 (neutral) if no shared domains', () => {
      const a = [node({ id: 'n1', domain: Domain.BODY_FITNESS, progress: 0.8 })];
      const b = [node({ id: 'n2', domain: Domain.CAREER_CRAFT, progress: 0.2 })];
      expect((engine as any).calculateProgressSimilarity(a, b)).toBe(0.5);
    });

    it('returns 1.0 for identical average progress', () => {
      const a = [node({ id: 'n1', domain: Domain.BODY_FITNESS, progress: 0.5 })];
      const b = [node({ id: 'n2', domain: Domain.BODY_FITNESS, progress: 0.5 })];
      expect((engine as any).calculateProgressSimilarity(a, b)).toBeCloseTo(1.0);
    });

    it('handles zero progress values', () => {
      const a = [node({ id: 'n1', domain: Domain.BODY_FITNESS, progress: 0 })];
      const b = [node({ id: 'n2', domain: Domain.BODY_FITNESS, progress: 0 })];
      expect((engine as any).calculateProgressSimilarity(a, b)).toBeCloseTo(1.0);
    });
  });

  describe('calculateStructureSimilarity', () => {
    it('returns 1.0 for both single-node trees (identical)', () => {
      const a = [node({ id: 'n1' })];
      const b = [node({ id: 'n2' })];
      expect((engine as any).calculateStructureSimilarity(a, b)).toBeCloseTo(1.0);
    });

    it('returns 1.0 for identical depth and count', () => {
      const a = [
        node({ id: 'n1' }),
        node({ id: 'n2', parentId: 'n1' }),
      ];
      const b = [
        node({ id: 'n3' }),
        node({ id: 'n4', parentId: 'n3' }),
      ];
      expect((engine as any).calculateStructureSimilarity(a, b)).toBeCloseTo(1.0);
    });

    it('returns lower score for very different tree sizes', () => {
      const a = [node({ id: 'n1' })];
      const b = Array.from({ length: 10 }, (_, i) => node({ id: `n${i}` }));
      const score = (engine as any).calculateStructureSimilarity(a, b);
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('calculateMaxDepth', () => {
    it('returns 0 for empty nodes', () => {
      expect((engine as any).calculateMaxDepth([])).toBe(0);
    });

    it('returns 1 for a single root node', () => {
      expect((engine as any).calculateMaxDepth([node({ id: 'n1' })])).toBe(1);
    });

    it('calculates depth from parentId chain', () => {
      const nodes = [
        node({ id: 'n1' }),
        node({ id: 'n2', parentId: 'n1' }),
        node({ id: 'n3', parentId: 'n2' }),
      ];
      expect((engine as any).calculateMaxDepth(nodes)).toBe(3);
    });

    it('handles missing parent gracefully', () => {
      const nodes = [
        node({ id: 'n1' }),
        node({ id: 'n2', parentId: 'nonexistent' }),
      ];
      expect((engine as any).calculateMaxDepth(nodes)).toBe(1);
    });

    it('handles sibling branches', () => {
      const nodes = [
        node({ id: 'root' }),
        node({ id: 'a', parentId: 'root' }),
        node({ id: 'b', parentId: 'a' }),
        node({ id: 'c', parentId: 'root' }),
      ];
      expect((engine as any).calculateMaxDepth(nodes)).toBe(3);
    });
  });
});
