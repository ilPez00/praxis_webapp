/**
 * StructuredTrackerWriter
 * Maps a tracker type + raw `data` payload into inserts on the matching
 * per-category table (tracker_lifts, tracker_meals, tracker_cardio, …).
 * Lets Axiom + notebook export read typed rows instead of JSONB blobs.
 *
 * Supports two payload shapes:
 *   - single entry: { exercise: 'Bench', sets: 3, reps: 8, weight: 80 }
 *   - multi-row  : { items: [{ name, sets, reps, weight }, …] }
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

type Ctx = {
  userId: string;
  trackerId: string;
  trackerEntryId: string;
  nodeId?: string | null;
  loggedAt?: string;
};

const num = (v: any): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const int = (v: any): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

const str = (v: any): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
};

function rowsFrom(data: any): any[] {
  if (data && Array.isArray(data.items) && data.items.length > 0) return data.items;
  return [data];
}

async function insertRows(table: string, rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) {
    logger.warn(`[StructuredTracker] ${table} insert failed: ${error.message}`);
  }
}

const SUPPORTED_TYPES = new Set([
  'lift', 'meal', 'cardio', 'steps', 'sleep', 'meditation',
  'study', 'books', 'budget', 'expenses', 'investments',
  'music', 'journal', 'gaming',
]);

export function isStructuredType(type: string): boolean {
  return SUPPORTED_TYPES.has(type);
}

export async function writeStructured(
  type: string,
  data: Record<string, any>,
  ctx: Ctx,
): Promise<void> {
  const base = {
    user_id: ctx.userId,
    tracker_id: ctx.trackerId,
    tracker_entry_id: ctx.trackerEntryId,
    node_id: ctx.nodeId ?? null,
    logged_at: ctx.loggedAt ?? new Date().toISOString(),
  };

  const items = rowsFrom(data);

  switch (type) {
    case 'lift': {
      const rows = items.map((it: any) => ({
        ...base,
        exercise: str(it.exercise ?? it.name),
        sets:     int(it.sets),
        reps:     int(it.reps),
        weight_kg: num(it.weight ?? it.weight_kg),
        notes:    str(it.notes),
      }));
      return insertRows('tracker_lifts', rows);
    }

    case 'meal': {
      const rows = items.map((it: any) => ({
        ...base,
        meal_slot: str(it.meal ?? it.meal_slot),
        food:      str(it.food ?? it.name),
        grams:     num(it.grams ?? it.value),
        calories:  num(it.calories ?? it.kcal),
        protein_g: num(it.protein_g ?? it.protein),
        carbs_g:   num(it.carbs_g ?? it.carbs),
        fat_g:     num(it.fat_g ?? it.fat),
        notes:     str(it.notes),
      }));
      return insertRows('tracker_meals', rows);
    }

    case 'cardio': {
      const rows = items.map((it: any) => ({
        ...base,
        activity:     str(it.activity ?? it.name),
        duration_min: num(it.duration ?? it.duration_min),
        distance_km:  num(it.distance ?? it.distance_km),
        notes:        str(it.notes),
      }));
      return insertRows('tracker_cardio', rows);
    }

    case 'steps': {
      const rows = items.map((it: any) => ({
        ...base,
        steps:      int(it.steps ?? it.value),
        daily_goal: int(it.goal ?? it.daily_goal),
        source:     str(it.source),
      }));
      return insertRows('tracker_steps', rows);
    }

    case 'sleep': {
      const rows = items.map((it: any) => ({
        ...base,
        duration_h: num(it.duration ?? it.hours ?? it.duration_h),
        quality:    str(it.quality),
        notes:      str(it.notes),
      }));
      return insertRows('tracker_sleep', rows);
    }

    case 'meditation': {
      const rows = items.map((it: any) => ({
        ...base,
        duration_min: num(it.duration ?? it.duration_min),
        type:         str(it.type),
        feeling:      str(it.feeling),
        notes:        str(it.notes),
      }));
      return insertRows('tracker_meditation', rows);
    }

    case 'study': {
      const rows = items.map((it: any) => ({
        ...base,
        subject:      str(it.subject ?? it.name),
        duration_min: num(it.duration ?? it.duration_min),
        topic:        str(it.topic),
        notes:        str(it.notes),
      }));
      return insertRows('tracker_study', rows);
    }

    case 'books': {
      const rows = items.map((it: any) => ({
        ...base,
        title:       str(it.title ?? it.name),
        author:      str(it.author),
        pages_read:  int(it.pages_read ?? it.pages),
        total_pages: int(it.total_pages),
        rating:      num(it.rating),
        notes:       str(it.notes),
      }));
      return insertRows('tracker_books', rows);
    }

    case 'budget':
    case 'expenses': {
      const rows = items.map((it: any) => ({
        ...base,
        tx_type:    str(it.type ?? it.tx_type),
        category:   str(it.category ?? it.name),
        merchant:   str(it.merchant ?? it.description),
        amount_eur: num(it.amount ?? it.amount_eur),
        notes:      str(it.notes),
      }));
      return insertRows('tracker_expenses', rows);
    }

    case 'investments': {
      const rows = items.map((it: any) => ({
        ...base,
        action:    str(it.action),
        asset:     str(it.asset ?? it.name),
        quantity:  num(it.quantity),
        price_eur: num(it.price ?? it.price_eur),
        notes:     str(it.notes),
      }));
      return insertRows('tracker_investments', rows);
    }

    case 'music': {
      const rows = items.map((it: any) => ({
        ...base,
        instrument:   str(it.instrument),
        piece:        str(it.piece ?? it.name),
        duration_min: num(it.duration_min ?? it.duration),
        focus:        str(it.focus),
        notes:        str(it.notes),
      }));
      return insertRows('tracker_music', rows);
    }

    case 'journal': {
      const rows = items.map((it: any) => ({
        ...base,
        mood:      str(it.mood),
        entry:     str(it.entry ?? it.note ?? it.name),
        gratitude: str(it.gratitude),
      }));
      return insertRows('tracker_journal', rows);
    }

    case 'gaming': {
      const rows = items.map((it: any) => ({
        ...base,
        game:         str(it.game ?? it.name),
        duration_min: num(it.duration ?? it.duration_min),
        platform:     str(it.platform),
        mode:         str(it.mode),
        notes:        str(it.notes),
      }));
      return insertRows('tracker_gaming', rows);
    }

    default:
      return;
  }
}
