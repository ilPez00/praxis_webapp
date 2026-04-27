import { getAxiomQuote } from '../../utils/axiomQuotes';

describe('getAxiomQuote', () => {
  it('returns a string', () => {
    const quote = getAxiomQuote(1);
    expect(typeof quote).toBe('string');
    expect(quote.length).toBeGreaterThan(0);
  });

  it('returns new pool quote for streak 0', () => {
    const quote = getAxiomQuote(0);
    expect(quote).toContain('Day');
  });

  it('returns new pool quote for streak 1', () => {
    const quote = getAxiomQuote(1);
    expect(quote).toContain('Day');
  });

  it('returns active pool quote for streak 3-13', () => {
    const quote = getAxiomQuote(5);
    const matches = ['show up', 'visible', 'compounded'].some(s => quote.toLowerCase().includes(s));
    expect(matches).toBe(true);
  });

  it('returns veteran pool quote for streak 14-29', () => {
    const quote = getAxiomQuote(14);
    const matches = ['weeks', 'consistency', 'streak'].some(s => quote.toLowerCase().includes(s));
    expect(matches).toBe(true);
  });

  it('returns elite pool quote for streak 30+', () => {
    const quote = getAxiomQuote(30);
    expect(quote).toContain('days');
  });

  it('returns elite pool quote for streak 100', () => {
    const quote = getAxiomQuote(100);
    expect(quote).toContain('days');
  });

  it('returns deterministic results for same streak on same day', () => {
    const q1 = getAxiomQuote(5);
    const q2 = getAxiomQuote(5);
    expect(q1).toBe(q2);
  });
});
