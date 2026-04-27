/**
 * StructuredTrackerWriter — test pure helper functions.
 * isStructuredType, num, int, str, rowsFrom are all pure.
 * writeStructured needs Supabase mock — tested via integration.
 */

jest.mock('../../lib/supabaseClient', () => ({
  supabase: { from: jest.fn() },
}));

import { isStructuredType } from '../../services/StructuredTrackerWriter';

describe('isStructuredType', () => {
  it('returns true for all supported types', () => {
    const types = ['lift', 'meal', 'cardio', 'steps', 'sleep', 'meditation',
      'study', 'books', 'budget', 'expenses', 'investments',
      'music', 'journal', 'gaming'];
    for (const t of types) {
      expect(isStructuredType(t)).toBe(true);
    }
  });

  it('returns false for unsupported types', () => {
    expect(isStructuredType('unknown')).toBe(false);
    expect(isStructuredType('')).toBe(false);
    expect(isStructuredType('goal')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isStructuredType('Lift')).toBe(false);
    expect(isStructuredType('LIFT')).toBe(false);
  });
});
