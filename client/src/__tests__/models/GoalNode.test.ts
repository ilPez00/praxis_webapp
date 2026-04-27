import { updateWeightFromGrade } from '../../models/GoalNode';
import { FeedbackGrade } from '../../models/FeedbackGrade';
import { Domain } from '../../models/Domain';

const baseNode = {
  id: 'node-1',
  domain: Domain.FITNESS,
  name: 'Run 5k',
  weight: 1.0,
  progress: 0.3,
};

describe('updateWeightFromGrade (client)', () => {
  it('multiplies weight by 0.8 on SUCCEEDED', () => {
    const result = updateWeightFromGrade(baseNode, FeedbackGrade.SUCCEEDED);
    expect(result.weight).toBeCloseTo(0.8);
  });

  it('multiplies weight by 1.2 on DISTRACTED', () => {
    const result = updateWeightFromGrade(baseNode, FeedbackGrade.DISTRACTED);
    expect(result.weight).toBeCloseTo(1.2);
  });

  it('multiplies weight by 0.9 on LEARNED', () => {
    const result = updateWeightFromGrade(baseNode, FeedbackGrade.LEARNED);
    expect(result.weight).toBeCloseTo(0.9);
  });

  it('multiplies weight by 1.05 on ADAPTED', () => {
    const result = updateWeightFromGrade(baseNode, FeedbackGrade.ADAPTED);
    expect(result.weight).toBeCloseTo(1.05);
  });

  it('does not change weight on NOT_APPLICABLE', () => {
    const result = updateWeightFromGrade(baseNode, FeedbackGrade.NOT_APPLICABLE);
    expect(result.weight).toBeCloseTo(1.0);
  });

  it('preserves other node fields', () => {
    const result = updateWeightFromGrade(baseNode, FeedbackGrade.SUCCEEDED);
    expect(result.id).toBe('node-1');
    expect(result.domain).toBe(Domain.FITNESS);
    expect(result.name).toBe('Run 5k');
    expect(result.progress).toBe(0.3);
  });

  it('does not mutate the original node', () => {
    const original = { ...baseNode };
    updateWeightFromGrade(baseNode, FeedbackGrade.SUCCEEDED);
    expect(baseNode.weight).toBe(1.0);
  });

  it('chains multiple grade applications', () => {
    let node = baseNode;
    node = updateWeightFromGrade(node, FeedbackGrade.SUCCEEDED);
    node = updateWeightFromGrade(node, FeedbackGrade.LEARNED);
    const expected = 1.0 * 0.8 * 0.9;
    expect(node.weight).toBeCloseTo(expected);
  });
});
