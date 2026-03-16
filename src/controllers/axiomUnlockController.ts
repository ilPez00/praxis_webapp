import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AxiomScanService } from '../services/AxiomScanService';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

/**
 * POST /axiom/unlock-daily
 * Unlock today's Axiom daily brief for 500 PP (free users only)
 */
export const unlockDailyBrief = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  // Check if user is already premium
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium, praxis_points')
    .eq('id', userId)
    .single();

  if (!profile) throw new BadRequestError('User profile not found');
  
  if (profile.is_premium) {
    return res.status(400).json({ message: 'Premium users have unlimited access' });
  }

  // Check if they have enough points
  if ((profile.praxis_points || 0) < 500) {
    return res.status(402).json({ 
      message: 'Insufficient PP. You need 500 PP to unlock daily brief.',
      currentPoints: profile.praxis_points,
      required: 500,
    });
  }

  // Check if brief already exists and is not locked
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: existingBrief } = await supabase
    .from('axiom_daily_briefs')
    .select('brief')
    .eq('user_id', userId)
    .eq('date', todayStr)
    .maybeSingle();

  if (existingBrief && !(existingBrief.brief as any).isLocked) {
    return res.status(400).json({ message: 'Daily brief already unlocked for today' });
  }

  // Deduct 500 PP
  const newPoints = (profile.praxis_points || 0) - 500;
  await supabase
    .from('profiles')
    .update({ praxis_points: newPoints })
    .eq('id', userId);

  // Generate the brief
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('name, city')
    .eq('id', userId)
    .single();

  await AxiomScanService.generateDailyBrief(
    userId,
    userProfile?.name || 'Student',
    userProfile?.city || 'Unknown',
    true
  );

  // Fetch the newly generated brief
  const { data: newBrief } = await supabase
    .from('axiom_daily_briefs')
    .select('brief')
    .eq('user_id', userId)
    .eq('date', todayStr)
    .maybeSingle();

  res.json({
    success: true,
    message: 'Daily brief unlocked!',
    newBalance: newPoints,
    brief: newBrief?.brief,
  });
});
