/**
 * StructuredTrackerReader — test pure summarizer functions + summaryToPromptText.
 * The summarizers are pure functions that take row arrays and return summaries.
 * fetchRows / getStructuredSummary mock Supabase — tested via integration.
 */
import { summaryToPromptText } from '../../services/StructuredTrackerReader';

describe('summaryToPromptText', () => {
  it('returns fallback for empty summary', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      recent: {},
    });
    expect(text).toBe('(no structured tracker activity in window)');
  });

  it('renders lifts section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      lifts: { row_count: 5, total_volume_kg: 5000, top_exercises: [{ exercise: 'Bench', volume_kg: 2000, sets: 12 }] },
      recent: {},
    });
    expect(text).toContain('Lifts: 5 sets');
    expect(text).toContain('total volume 5000kg');
    expect(text).toContain('Bench 2000kg');
  });

  it('renders meals section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      meals: { row_count: 3, total_kcal: 2400, total_protein_g: 120, total_carbs_g: 200, total_fat_g: 80, by_slot: {} },
      recent: {},
    });
    expect(text).toContain('Meals: 3 logs');
    expect(text).toContain('2400 kcal');
    expect(text).toContain('P 120g / C 200g / F 80g');
  });

  it('renders cardio section with pace', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      cardio: { row_count: 2, total_duration_min: 60, total_distance_km: 10, avg_pace_min_per_km: 6.0 },
      recent: {},
    });
    expect(text).toContain('Cardio: 2 sessions');
    expect(text).toContain('60 min');
    expect(text).toContain('10 km');
    expect(text).toContain('avg pace 6 min/km');
  });

  it('renders cardio without pace', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      cardio: { row_count: 1, total_duration_min: 30, total_distance_km: 5, avg_pace_min_per_km: null },
      recent: {},
    });
    expect(text).toContain('Cardio: 1 sessions');
    expect(text).not.toContain('avg pace');
  });

  it('renders steps section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      steps: { day_count: 3, total_steps: 25000, avg_steps_per_day: 8333, goal_hit_days: 1 },
      recent: {},
    });
    expect(text).toContain('Steps: 25000 over 3 days');
    expect(text).toContain('avg 8333/day');
    expect(text).toContain('1 goal-hit days');
  });

  it('renders sleep section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      sleep: { night_count: 5, avg_duration_h: 7.5, quality_histogram: { good: 3, fair: 2 } },
      recent: {},
    });
    expect(text).toContain('Sleep: 5 nights');
    expect(text).toContain('avg 7.5h');
  });

  it('renders meditation section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      meditation: { row_count: 4, total_duration_min: 120 },
      recent: {},
    });
    expect(text).toContain('Meditation: 4 sessions');
    expect(text).toContain('120 min');
  });

  it('renders study section with subjects', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      study: { row_count: 3, total_duration_min: 180, by_subject: { Math: 90, Physics: 90 } },
      recent: {},
    });
    expect(text).toContain('Study: 180 min total');
    expect(text).toContain('Math 90min');
    expect(text).toContain('Physics 90min');
  });

  it('renders books section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      books: { row_count: 2, total_pages_read: 150, titles: ['Book A', 'Book B'] },
      recent: {},
    });
    expect(text).toContain('Books: 150 pages');
    expect(text).toContain('Book A, Book B');
  });

  it('renders expenses section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      expenses: { row_count: 5, total_expense_eur: 150.50, total_income_eur: 3000, by_category: {} },
      recent: {},
    });
    expect(text).toContain('Expenses: −€150.5 / +€3000');
  });

  it('renders investments section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      investments: { row_count: 2, total_invested_eur: 10000, by_asset: {} },
      recent: {},
    });
    expect(text).toContain('Investments: €10000 deployed');
  });

  it('renders music section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      music: { row_count: 3, total_duration_min: 90 },
      recent: {},
    });
    expect(text).toContain('Music: 90 min');
  });

  it('renders gaming section', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      gaming: { row_count: 2, total_duration_min: 120 },
      recent: {},
    });
    expect(text).toContain('Gaming: 120 min');
  });

  it('renders journal section with mood histogram', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      journal: { row_count: 4, mood_histogram: { happy: 2, sad: 1, neutral: 1 } },
      recent: {},
    });
    expect(text).toContain('Journal: 4 entries');
    expect(text).toContain('happy×2');
    expect(text).toContain('sad×1');
  });

  it('renders multiple sections on separate lines', () => {
    const text = summaryToPromptText({
      since: '2026-01-01',
      lifts: { row_count: 1, total_volume_kg: 100, top_exercises: [] },
      sleep: { night_count: 1, avg_duration_h: 8, quality_histogram: {} },
      recent: {},
    });
    const lines = text.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Lifts');
    expect(lines[1]).toContain('Sleep');
  });
});
