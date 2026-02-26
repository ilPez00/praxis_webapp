import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors';

const CATALOGUE = [
  { item_type: 'streak_shield',    label: 'Streak Shield',     cost: 30,  description: 'Protect your streak from breaking for one day.' },
  { item_type: 'profile_boost',    label: 'Profile Boost 24h', cost: 50,  description: 'Boost your profile visibility for 24 hours.' },
  { item_type: 'badge_apprentice', label: 'Apprentice Badge',  cost: 20,  description: 'Display the Apprentice badge on your profile.' },
  { item_type: 'badge_achiever',   label: 'Achiever Badge',    cost: 50,  description: 'Display the Achiever badge on your profile.' },
  { item_type: 'badge_legend',     label: 'Legend Badge',      cost: 150, description: 'Display the Legend badge on your profile.' },
  { item_type: 'goal_tree_edit',   label: 'Goal Tree Edit',    cost: 100, description: 'Reset your goal tree edit counter to allow changes.' },
  { item_type: 'premium_trial',    label: '7-Day Premium',     cost: 250, description: 'Get 7 days of premium access.' },
  { item_type: 'coaching_session', label: 'Coaching Session',  cost: 0,   description: 'Book a session with a coach (points transfer to coach).' },
];

// GET /marketplace/items
export const getItems = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  res.status(200).json(CATALOGUE);
});

// POST /marketplace/purchase
// Body: { userId, itemType, coachUserId?, cost? }
export const purchase = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, itemType, coachUserId, cost: overrideCost } = req.body;

  if (!userId)   throw new BadRequestError('userId is required.');
  if (!itemType) throw new BadRequestError('itemType is required.');

  const item = CATALOGUE.find(i => i.item_type === itemType);
  if (!item) throw new BadRequestError(`Unknown item type: ${itemType}`);

  const cost = itemType === 'coaching_session' ? (Number(overrideCost) || 0) : item.cost;

  // Fetch buyer's current balance
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new BadRequestError('User not found.');

  const currentPoints = profile.praxis_points ?? 0;
  if (currentPoints < cost) {
    throw new BadRequestError(`Insufficient points. You have ${currentPoints} but need ${cost}.`);
  }

  const newBalance = currentPoints - cost;

  // Deduct points
  const { error: deductError } = await supabase
    .from('profiles')
    .update({ praxis_points: newBalance })
    .eq('id', userId);

  if (deductError) throw new InternalServerError('Failed to deduct points.');

  // Apply item effect
  switch (itemType) {
    case 'streak_shield': {
      await supabase.from('profiles').update({ streak_shield: true }).eq('id', userId);
      break;
    }
    case 'profile_boost': {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('profiles').update({ profile_boosted_until: until }).eq('id', userId);
      break;
    }
    case 'badge_apprentice': {
      await supabase.from('profiles').update({ badge: 'Apprentice' }).eq('id', userId);
      break;
    }
    case 'badge_achiever': {
      await supabase.from('profiles').update({ badge: 'Achiever' }).eq('id', userId);
      break;
    }
    case 'badge_legend': {
      await supabase.from('profiles').update({ badge: 'Legend' }).eq('id', userId);
      break;
    }
    case 'goal_tree_edit': {
      await supabase.from('profiles').update({ goal_tree_edit_count: 0 }).eq('id', userId);
      break;
    }
    case 'premium_trial': {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('profiles').update({ is_premium: true }).eq('id', userId);
      // Best-effort subscription record (table may have different schema)
      await supabase.from('user_subscriptions').insert({
        user_id: userId,
        plan: 'premium_trial',
        status: 'active',
        current_period_end: trialEnd,
      }).select();
      break;
    }
    case 'coaching_session': {
      if (!coachUserId) throw new BadRequestError('coachUserId is required for coaching sessions.');
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('praxis_points')
        .eq('id', coachUserId)
        .single();
      const coachNewBalance = (coachProfile?.praxis_points ?? 0) + cost;
      await supabase.from('profiles').update({ praxis_points: coachNewBalance }).eq('id', coachUserId);
      break;
    }
  }

  // Log transaction
  await supabase.from('marketplace_transactions').insert({
    user_id: userId,
    item_type: itemType,
    cost,
    metadata: coachUserId ? { coachUserId } : null,
  });

  return res.status(200).json({ success: true, newBalance });
});
