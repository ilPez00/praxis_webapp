import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError } from '../utils/appErrors';
import { CreateActionRecordInput, ActionDomain, ActionMode } from '../models/ActionRecord';
import { goalMaturityService } from '../services/GoalMaturityService';

const VALID_DOMAINS: ActionDomain[] = ['FABRICATE', 'STUDY', 'CONSTRUCT', 'BOND', 'HEAL'];
const VALID_MODES:   ActionMode[]   = ['LIFT', 'WALK', 'WORK', 'LEARN', 'CODE', 'CREATE', 'REST'];

/** POST /api/actions — log a completed action record. */
export const createAction = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new BadRequestError('Not authenticated');

  const input = req.body as CreateActionRecordInput;

  if (!VALID_DOMAINS.includes(input.domain))
    throw new BadRequestError(`Invalid domain. Must be one of: ${VALID_DOMAINS.join(', ')}`);
  if (!VALID_MODES.includes(input.mode))
    throw new BadRequestError(`Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`);
  if (!input.action_text?.trim())
    throw new BadRequestError('action_text is required');
  if (typeof input.duration_min !== 'number' || input.duration_min < 0)
    throw new BadRequestError('duration_min must be a non-negative number');
  if (input.grade !== undefined && (input.grade < 0 || input.grade > 1))
    throw new BadRequestError('grade must be between 0.0 and 1.0');

  const { data, error } = await supabase
    .from('action_records')
    .insert({
      user_id:          userId,
      action_id:        input.action_id,
      timestamp:        input.timestamp ?? new Date().toISOString(),
      domain:           input.domain,
      mode:             input.mode,
      scope:            input.scope ?? 'PERSONAL',
      duration_min:     input.duration_min,
      trigger:          input.trigger ?? 'SELF',
      action_text:      input.action_text.trim(),
      grade:            input.grade,
      grade_rationale:  input.grade_rationale,
      tags:             input.tags ?? [],
      goal_id:          input.goal_id ?? null,
      external_signals: input.external_signals ?? [],
      outcome_type:     input.outcome_type ?? null,
      collaborators:    input.collaborators ?? [],
      location:         input.location ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Fire-and-forget: run maturity loops for linked goal
  if (data?.goal_id) {
    goalMaturityService.evaluateAfterAction(userId, data.goal_id, data.id).catch(() => {});
  }

  res.status(201).json({ action: data });
});

/** GET /api/actions — list user's action records, newest first. */
export const listActions = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new BadRequestError('Not authenticated');

  const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const domain = req.query.domain as string | undefined;
  const mode   = req.query.mode   as string | undefined;

  let query = supabase
    .from('action_records')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (domain) query = query.eq('domain', domain.toUpperCase());
  if (mode)   query = query.eq('mode',   mode.toUpperCase());

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  res.json({ actions: data, total: count, limit, offset });
});

/** GET /api/actions/maturity — goal maturity state for all user's goals. */
export const goalMaturity = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new BadRequestError('Not authenticated');

  const { data, error } = await supabase
    .from('goal_maturity')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  res.json({ maturity: data });
});

/** GET /api/actions/stats — grade trends and domain distribution. */
export const actionStats = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new BadRequestError('Not authenticated');

  const { data, error } = await supabase
    .from('action_records')
    .select('domain, mode, grade, duration_min, timestamp')
    .eq('user_id', userId)
    .not('grade', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  // Domain distribution
  const byDomain = (data ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.domain] = (acc[r.domain] ?? 0) + 1;
    return acc;
  }, {});

  // Average grade per domain
  const gradeByDomain = (data ?? []).reduce((acc: Record<string, number[]>, r: any) => {
    if (r.grade != null) (acc[r.domain] = acc[r.domain] ?? []).push(r.grade);
    return acc;
  }, {});
  const avgGrade = Object.fromEntries(
    Object.entries(gradeByDomain).map(([d, gs]) => [d, gs.reduce((a, b) => a + b, 0) / gs.length])
  );

  const totalMin = (data ?? []).reduce((s: number, r: any) => s + (r.duration_min ?? 0), 0);

  res.json({ byDomain, avgGrade, totalMin, count: (data ?? []).length });
});
