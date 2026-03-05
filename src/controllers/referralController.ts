import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import {
  catchAsync,
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from '../utils/appErrors';

const REFERRAL_REWARD = 100; // PP awarded to both referrer and claimer

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET /referrals/my-code — get or generate referral code for authenticated user
export const getMyCode = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code, referral_claims(count)')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.code) {
    const claimsArr = (existing as any).referral_claims;
    const count = Array.isArray(claimsArr) && claimsArr.length > 0 ? (claimsArr[0].count ?? 0) : 0;
    return res.json({ code: existing.code, referralCount: count });
  }

  // Generate a unique code — retry up to 3 times on collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from('referral_codes').insert({ user_id: userId, code });
    if (!error) return res.json({ code, referralCount: 0 });
    if (error.code !== '23505') throw new InternalServerError(error.message);
  }

  throw new InternalServerError('Could not generate a unique referral code. Please try again.');
});

// POST /referrals/claim — claim a referral code, award PP to both parties
export const claimCode = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { code } = req.body as { code?: string };
  if (!code?.trim()) throw new BadRequestError('code is required.');

  const { data: refCode } = await supabase
    .from('referral_codes')
    .select('user_id')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();

  if (!refCode) throw new NotFoundError('Invalid referral code.');
  if (refCode.user_id === userId) throw new BadRequestError('You cannot use your own referral code.');

  const { data: existing } = await supabase
    .from('referral_claims')
    .select('id')
    .eq('claimer_id', userId)
    .maybeSingle();
  if (existing) throw new BadRequestError('You have already used a referral code.');

  const { error: claimErr } = await supabase
    .from('referral_claims')
    .insert({ claimer_id: userId, referrer_id: refCode.user_id });
  if (claimErr) {
    if (claimErr.code === '23505') throw new BadRequestError('You have already used a referral code.');
    throw new InternalServerError(claimErr.message);
  }

  // Award PP: fetch current points then increment for both users
  const [claimerRes, referrerRes] = await Promise.all([
    supabase.from('profiles').select('praxis_points').eq('id', userId).single(),
    supabase.from('profiles').select('praxis_points').eq('id', refCode.user_id).single(),
  ]);

  const claimerPts: number = claimerRes.data?.praxis_points ?? 0;
  const referrerPts: number = referrerRes.data?.praxis_points ?? 0;

  await Promise.allSettled([
    supabase
      .from('profiles')
      .update({ praxis_points: claimerPts + REFERRAL_REWARD })
      .eq('id', userId),
    supabase
      .from('profiles')
      .update({ praxis_points: referrerPts + REFERRAL_REWARD })
      .eq('id', refCode.user_id),
  ]);

  logger.info(
    `[Referral] ${userId} claimed code from ${refCode.user_id} — +${REFERRAL_REWARD} PP each`,
  );

  return res.json({
    success: true,
    reward: REFERRAL_REWARD,
    message: `+${REFERRAL_REWARD} PP awarded to you and your referrer!`,
  });
});
