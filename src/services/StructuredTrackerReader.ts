/**
 * StructuredTrackerReader
 * Reads per-category tracker tables and returns compact aggregates + recent
 * rows. Used by Axiom services and the notebook export so they spend tokens
 * on summaries rather than raw JSONB dumps.
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface StructuredSummary {
  since: string;
  lifts?:         { row_count: number; total_volume_kg: number; top_exercises: Array<{ exercise: string; volume_kg: number; sets: number }>; };
  meals?:         { row_count: number; total_kcal: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number; by_slot: Record<string, number>; };
  cardio?:        { row_count: number; total_duration_min: number; total_distance_km: number; avg_pace_min_per_km: number | null; };
  steps?:         { day_count: number; total_steps: number; avg_steps_per_day: number; goal_hit_days: number; };
  sleep?:         { night_count: number; avg_duration_h: number; quality_histogram: Record<string, number>; };
  meditation?:    { row_count: number; total_duration_min: number; };
  study?:         { row_count: number; total_duration_min: number; by_subject: Record<string, number>; };
  books?:         { row_count: number; total_pages_read: number; titles: string[]; };
  expenses?:      { row_count: number; total_expense_eur: number; total_income_eur: number; by_category: Record<string, number>; };
  investments?:   { row_count: number; total_invested_eur: number; by_asset: Record<string, number>; };
  music?:         { row_count: number; total_duration_min: number; };
  journal?:       { row_count: number; mood_histogram: Record<string, number>; };
  gaming?:        { row_count: number; total_duration_min: number; };
  /** Raw rows kept small so callers can cite specifics if needed. */
  recent: {
    lifts?: any[]; meals?: any[]; cardio?: any[]; steps?: any[]; sleep?: any[];
    meditation?: any[]; study?: any[]; books?: any[]; expenses?: any[];
    investments?: any[]; music?: any[]; journal?: any[]; gaming?: any[];
  };
}

const TABLE_MAP = {
  lifts:       { table: 'tracker_lifts',       cols: 'exercise, sets, reps, weight_kg, volume_kg, notes, logged_at' },
  meals:       { table: 'tracker_meals',       cols: 'meal_slot, food, grams, calories, protein_g, carbs_g, fat_g, notes, logged_at' },
  cardio:      { table: 'tracker_cardio',      cols: 'activity, duration_min, distance_km, pace_min_per_km, notes, logged_at' },
  steps:       { table: 'tracker_steps',       cols: 'steps, daily_goal, source, logged_at' },
  sleep:       { table: 'tracker_sleep',       cols: 'duration_h, quality, notes, logged_at' },
  meditation:  { table: 'tracker_meditation',  cols: 'duration_min, type, feeling, notes, logged_at' },
  study:       { table: 'tracker_study',       cols: 'subject, duration_min, topic, notes, logged_at' },
  books:       { table: 'tracker_books',       cols: 'title, author, pages_read, total_pages, rating, notes, logged_at' },
  expenses:    { table: 'tracker_expenses',    cols: 'tx_type, category, merchant, amount_eur, notes, logged_at' },
  investments: { table: 'tracker_investments', cols: 'action, asset, quantity, price_eur, total_eur, notes, logged_at' },
  music:       { table: 'tracker_music',       cols: 'instrument, piece, duration_min, focus, notes, logged_at' },
  journal:     { table: 'tracker_journal',     cols: 'mood, entry, gratitude, logged_at' },
  gaming:      { table: 'tracker_gaming',      cols: 'game, duration_min, platform, mode, notes, logged_at' },
} as const;

type Key = keyof typeof TABLE_MAP;

const num = (v: any): number => (typeof v === 'number' && Number.isFinite(v) ? v : parseFloat(v) || 0);

async function fetchRows(table: string, cols: string, userId: string, since: string): Promise<any[]> {
  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq('user_id', userId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false });
  if (error) {
    if (!/schema cache|42P01|does not exist/.test(error.message)) {
      logger.warn(`[StructuredReader] ${table} read failed: ${error.message}`);
    }
    return [];
  }
  return data ?? [];
}

function summarizeLifts(rows: any[]) {
  const byEx: Record<string, { volume_kg: number; sets: number }> = {};
  let totalVolume = 0;
  for (const r of rows) {
    const v = num(r.volume_kg);
    totalVolume += v;
    const ex = r.exercise || 'Unknown';
    (byEx[ex] ||= { volume_kg: 0, sets: 0 });
    byEx[ex].volume_kg += v;
    byEx[ex].sets += num(r.sets);
  }
  const top = Object.entries(byEx)
    .map(([exercise, v]) => ({ exercise, volume_kg: Math.round(v.volume_kg), sets: v.sets }))
    .sort((a, b) => b.volume_kg - a.volume_kg)
    .slice(0, 5);
  return { row_count: rows.length, total_volume_kg: Math.round(totalVolume), top_exercises: top };
}

function summarizeMeals(rows: any[]) {
  let kcal = 0, p = 0, c = 0, f = 0;
  const bySlot: Record<string, number> = {};
  for (const r of rows) {
    kcal += num(r.calories);
    p += num(r.protein_g);
    c += num(r.carbs_g);
    f += num(r.fat_g);
    if (r.meal_slot) bySlot[r.meal_slot] = (bySlot[r.meal_slot] ?? 0) + num(r.calories);
  }
  return {
    row_count: rows.length,
    total_kcal: Math.round(kcal),
    total_protein_g: Math.round(p),
    total_carbs_g: Math.round(c),
    total_fat_g: Math.round(f),
    by_slot: bySlot,
  };
}

function summarizeCardio(rows: any[]) {
  let dur = 0, dist = 0, paceCount = 0, paceSum = 0;
  for (const r of rows) {
    dur += num(r.duration_min);
    dist += num(r.distance_km);
    if (r.pace_min_per_km) { paceSum += num(r.pace_min_per_km); paceCount++; }
  }
  return {
    row_count: rows.length,
    total_duration_min: Math.round(dur),
    total_distance_km: Math.round(dist * 10) / 10,
    avg_pace_min_per_km: paceCount > 0 ? Math.round((paceSum / paceCount) * 10) / 10 : null,
  };
}

function summarizeSteps(rows: any[]) {
  const byDay: Record<string, number> = {};
  let goalHits = 0;
  for (const r of rows) {
    const day = (r.logged_at || '').slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + num(r.steps);
    if (num(r.daily_goal) > 0 && byDay[day] >= num(r.daily_goal)) goalHits++;
  }
  const total = Object.values(byDay).reduce((a, b) => a + b, 0);
  const days = Object.keys(byDay).length || 1;
  return {
    day_count: days,
    total_steps: total,
    avg_steps_per_day: Math.round(total / days),
    goal_hit_days: goalHits,
  };
}

function summarizeSleep(rows: any[]) {
  let total = 0;
  const hist: Record<string, number> = {};
  for (const r of rows) {
    total += num(r.duration_h);
    if (r.quality) hist[r.quality] = (hist[r.quality] ?? 0) + 1;
  }
  const n = rows.length || 1;
  return { night_count: rows.length, avg_duration_h: Math.round((total / n) * 10) / 10, quality_histogram: hist };
}

function summarizeDuration(rows: any[]) {
  const total = rows.reduce((a, r) => a + num(r.duration_min), 0);
  return { row_count: rows.length, total_duration_min: Math.round(total) };
}

function summarizeStudy(rows: any[]) {
  const bySubject: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    total += num(r.duration_min);
    if (r.subject) bySubject[r.subject] = (bySubject[r.subject] ?? 0) + num(r.duration_min);
  }
  return { row_count: rows.length, total_duration_min: Math.round(total), by_subject: bySubject };
}

function summarizeBooks(rows: any[]) {
  const titles = Array.from(new Set(rows.map((r: any) => r.title).filter(Boolean))).slice(0, 10);
  return {
    row_count: rows.length,
    total_pages_read: rows.reduce((a: number, r: any) => a + num(r.pages_read), 0),
    titles,
  };
}

function summarizeExpenses(rows: any[]) {
  let exp = 0, inc = 0;
  const byCat: Record<string, number> = {};
  for (const r of rows) {
    const amt = num(r.amount_eur);
    if (r.tx_type === 'Income') inc += amt;
    else exp += amt;
    if (r.category) byCat[r.category] = (byCat[r.category] ?? 0) + amt;
  }
  return {
    row_count: rows.length,
    total_expense_eur: Math.round(exp * 100) / 100,
    total_income_eur: Math.round(inc * 100) / 100,
    by_category: byCat,
  };
}

function summarizeInvestments(rows: any[]) {
  const byAsset: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const t = num(r.total_eur);
    total += t;
    if (r.asset) byAsset[r.asset] = (byAsset[r.asset] ?? 0) + t;
  }
  return {
    row_count: rows.length,
    total_invested_eur: Math.round(total * 100) / 100,
    by_asset: byAsset,
  };
}

function summarizeJournal(rows: any[]) {
  const hist: Record<string, number> = {};
  for (const r of rows) if (r.mood) hist[r.mood] = (hist[r.mood] ?? 0) + 1;
  return { row_count: rows.length, mood_histogram: hist };
}

export async function getStructuredSummary(
  userId: string,
  sinceIso: string,
  recentLimit = 20,
): Promise<StructuredSummary> {
  const results = await Promise.all(
    (Object.keys(TABLE_MAP) as Key[]).map(async (key) => {
      const { table, cols } = TABLE_MAP[key];
      const rows = await fetchRows(table, cols, userId, sinceIso);
      return [key, rows] as const;
    }),
  );

  const rowsByKey = Object.fromEntries(results) as Record<Key, any[]>;
  const recent: StructuredSummary['recent'] = {};
  for (const key of Object.keys(rowsByKey) as Key[]) {
    const rows = rowsByKey[key];
    if (rows.length > 0) recent[key] = rows.slice(0, recentLimit);
  }

  const summary: StructuredSummary = { since: sinceIso, recent };

  if (rowsByKey.lifts.length)        summary.lifts       = summarizeLifts(rowsByKey.lifts);
  if (rowsByKey.meals.length)        summary.meals       = summarizeMeals(rowsByKey.meals);
  if (rowsByKey.cardio.length)       summary.cardio      = summarizeCardio(rowsByKey.cardio);
  if (rowsByKey.steps.length)        summary.steps       = summarizeSteps(rowsByKey.steps);
  if (rowsByKey.sleep.length)        summary.sleep       = summarizeSleep(rowsByKey.sleep);
  if (rowsByKey.meditation.length)   summary.meditation  = summarizeDuration(rowsByKey.meditation);
  if (rowsByKey.study.length)        summary.study       = summarizeStudy(rowsByKey.study);
  if (rowsByKey.books.length)        summary.books       = summarizeBooks(rowsByKey.books);
  if (rowsByKey.expenses.length)     summary.expenses    = summarizeExpenses(rowsByKey.expenses);
  if (rowsByKey.investments.length)  summary.investments = summarizeInvestments(rowsByKey.investments);
  if (rowsByKey.music.length)        summary.music       = summarizeDuration(rowsByKey.music);
  if (rowsByKey.journal.length)      summary.journal     = summarizeJournal(rowsByKey.journal);
  if (rowsByKey.gaming.length)       summary.gaming      = summarizeDuration(rowsByKey.gaming);

  return summary;
}

/** Compact human-readable summary for LLM prompts. Drops empty sections. */
export function summaryToPromptText(s: StructuredSummary): string {
  const lines: string[] = [];
  if (s.lifts) {
    const top = s.lifts.top_exercises.map(e => `${e.exercise} ${e.volume_kg}kg`).join(', ');
    lines.push(`Lifts: ${s.lifts.row_count} sets, total volume ${s.lifts.total_volume_kg}kg. Top: ${top || 'n/a'}`);
  }
  if (s.meals) {
    lines.push(`Meals: ${s.meals.row_count} logs, ${s.meals.total_kcal} kcal (P ${s.meals.total_protein_g}g / C ${s.meals.total_carbs_g}g / F ${s.meals.total_fat_g}g)`);
  }
  if (s.cardio) {
    lines.push(`Cardio: ${s.cardio.row_count} sessions, ${s.cardio.total_duration_min} min, ${s.cardio.total_distance_km} km${s.cardio.avg_pace_min_per_km ? `, avg pace ${s.cardio.avg_pace_min_per_km} min/km` : ''}`);
  }
  if (s.steps) {
    lines.push(`Steps: ${s.steps.total_steps} over ${s.steps.day_count} days (avg ${s.steps.avg_steps_per_day}/day, ${s.steps.goal_hit_days} goal-hit days)`);
  }
  if (s.sleep) {
    lines.push(`Sleep: ${s.sleep.night_count} nights, avg ${s.sleep.avg_duration_h}h`);
  }
  if (s.meditation) lines.push(`Meditation: ${s.meditation.row_count} sessions, ${s.meditation.total_duration_min} min`);
  if (s.study) {
    const subj = Object.entries(s.study.by_subject).map(([k, v]) => `${k} ${v}min`).join(', ');
    lines.push(`Study: ${s.study.total_duration_min} min total. ${subj}`);
  }
  if (s.books) lines.push(`Books: ${s.books.total_pages_read} pages, titles: ${s.books.titles.join(', ')}`);
  if (s.expenses) {
    lines.push(`Expenses: −€${s.expenses.total_expense_eur} / +€${s.expenses.total_income_eur}`);
  }
  if (s.investments) lines.push(`Investments: €${s.investments.total_invested_eur} deployed`);
  if (s.music) lines.push(`Music: ${s.music.total_duration_min} min`);
  if (s.gaming) lines.push(`Gaming: ${s.gaming.total_duration_min} min`);
  if (s.journal) {
    const moods = Object.entries(s.journal.mood_histogram).map(([k, v]) => `${k}×${v}`).join(', ');
    lines.push(`Journal: ${s.journal.row_count} entries (${moods})`);
  }
  return lines.join('\n') || '(no structured tracker activity in window)';
}
