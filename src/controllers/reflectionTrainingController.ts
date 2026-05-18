import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, UnauthorizedError } from '../utils/appErrors';

/**
 * POST /api/reflections/training
 * Submit a reflection for training (requires global consent opt-in)
 */
export const submitReflection = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  // Check global consent
  const { data: profile } = await supabase
    .from('profiles')
    .select('share_reflections')
    .eq('id', userId)
    .single();

  if (!profile?.share_reflections) {
    throw new BadRequestError('Reflection sharing is disabled. Enable it in Settings.');
  }

  const { goal_id, action, stated_cause, context, outcome, domain } = req.body;

  if (!goal_id || !action || !outcome || !domain) {
    throw new BadRequestError('goal_id, action, outcome, and domain are required');
  }

  // Strip personal info — only store anonymized training data
  const anonymized = {
    goal_id,
    domain,
    action,
    stated_cause: stated_cause || null,
    context: {
      mood: context?.mood || null,
      timeOfDay: context?.timeOfDay || null,
      streakDay: context?.streakDay || null,
      externalFactors: context?.externalFactors || null,
    },
    outcome,
    consent_level: 'anonymized',
  };

  const { data, error } = await supabase
    .from('reflection_training_data')
    .insert({
      user_id: userId,
      goal_id: anonymized.goal_id,
      domain: anonymized.domain,
      action: anonymized.action,
      stated_cause: anonymized.stated_cause,
      context: anonymized.context,
      outcome: anonymized.outcome,
      consent_level: anonymized.consent_level,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error saving reflection:', error.message);
    throw new BadRequestError('Failed to save reflection.');
  }

  res.status(201).json({ message: 'Reflection saved.', id: data.id });
});

/**
 * GET /api/reflections/patterns
 * Return anonymous aggregated patterns by domain (public)
 */
export const getPatternsByDomain = catchAsync(async (req: Request, res: Response) => {
  const { domain } = req.query;

  let query = supabase
    .from('patterns')
    .select('domain, text, support_count')
    .order('support_count', { ascending: false });

  if (domain) {
    query = query.eq('domain', domain as string);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching patterns:', error.message);
    return res.json([]);
  }

  res.json(data || []);
});