import {
  getSuggestionsForDomain,
  getGeneralSuggestions,
  getSuggestionsByCategory,
  getSuggestionOfTheDay,
} from '../../utils/loggingSuggestions';
import { Domain } from '../../models/Domain';

describe('getSuggestionsForDomain', () => {
  it('returns top 5 suggestions sorted by priority', () => {
    const suggestions = getSuggestionsForDomain(Domain.FITNESS);
    expect(suggestions).toHaveLength(5);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].priority).toBeGreaterThanOrEqual(suggestions[i].priority);
    }
  });

  it('returns general suggestions for unknown domain', () => {
    const suggestions = getSuggestionsForDomain('UnknownDomain');
    expect(suggestions).toHaveLength(5);
  });

  it('each suggestion has required fields', () => {
    const suggestions = getSuggestionsForDomain(Domain.CAREER);
    for (const s of suggestions) {
      expect(s.id).toBeTruthy();
      expect(s.text).toBeTruthy();
      expect(['reflection', 'action', 'obstacle', 'milestone', 'mood', 'learning']).toContain(s.category);
      expect(typeof s.priority).toBe('number');
    }
  });
});

describe('getGeneralSuggestions', () => {
  it('returns top 6 general suggestions', () => {
    const suggestions = getGeneralSuggestions();
    expect(suggestions).toHaveLength(6);
  });

  it('returns suggestions sorted by priority descending', () => {
    const suggestions = getGeneralSuggestions();
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].priority).toBeGreaterThanOrEqual(suggestions[i].priority);
    }
  });
});

describe('getSuggestionsByCategory', () => {
  it('filters by category and returns top 3', () => {
    const suggestions = getSuggestionsByCategory(Domain.FITNESS, 'action');
    expect(suggestions.length).toBeLessThanOrEqual(3);
    for (const s of suggestions) {
      expect(s.category).toBe('action');
    }
  });

  it('returns empty array for category with no matches', () => {
    const suggestions = getSuggestionsByCategory(Domain.FITNESS, 'mood');
    expect(suggestions).toHaveLength(0);
  });

  it('filters general suggestions for unknown domain', () => {
    const suggestions = getSuggestionsByCategory('Unknown', 'reflection');
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.category).toBe('reflection');
    }
  });
});

describe('getSuggestionOfTheDay', () => {
  it('returns a suggestion when domain provided', () => {
    const suggestion = getSuggestionOfTheDay(Domain.FITNESS);
    expect(suggestion).toBeTruthy();
    expect(suggestion.id).toBeTruthy();
  });

  it('returns a general suggestion when no domain', () => {
    const suggestion = getSuggestionOfTheDay();
    expect(suggestion).toBeTruthy();
  });

  it('returns deterministic result for same day', () => {
    const s1 = getSuggestionOfTheDay(Domain.FITNESS);
    const s2 = getSuggestionOfTheDay(Domain.FITNESS);
    expect(s1.id).toBe(s2.id);
  });
});
