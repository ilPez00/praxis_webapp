import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError, NotFoundError } from '../utils/appErrors';

// ── Spend catalogue ───────────────────────────────────────────────────────────

const SPEND_CATALOGUE: Record<string, { cost: number; label: string }> = {
  boost_visibility:    { cost: 150, label: '24h Boosted Visibility'                      },
  goal_slot:           { cost: 200, label: 'Extra Root Goal Slot'                        },
  coaching_session:    { cost: 500, label: 'AI Coaching Session (Axiom)'                 },
  axiom_chat:          { cost:  50, label: 'Axiom Chat Message (free tier)'              },
  axiom_brief_trigger: { cost: 100, label: 'Trigger Extra Axiom Brief (free tier)'       },
  super_match:         { cost: 300, label: 'Super Match (Priority Queue)'                },
  custom_icon:         { cost: 100, label: 'Custom Goal Icon / Theme'                    },
  skip_grading:        { cost:  80, label: 'Skip Partner Grading Wait'                   },
  bet_stake:           { cost:  50, label: 'Extra Virtual Bet Stake'                     },
  suspend_goal:        { cost:  50, label: 'Suspend a Goal (pause without deleting)'     },
};

/**
 * GET /points/catalogue
 * Returns the full list of spendable items.
 */
export const getCatalogue = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=3600'); // static — 1 hr
  return res.json(
    Object.entries(SPEND_CATALOGUE).map(([id, item]) => ({ id, ...item }))
  );
};

/**
 * GET /points/balance?userId=<uuid>
 * Returns current balance + recent transaction log.
 */
export const getBalance = catchAsync(async (req: Request, res: Response) => {
  // Use authenticated user's ID — req.user is set by authenticateToken middleware
  const userId: string = (req as any).user?.id ?? (req.query.userId as string);
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points, profile_boosted_until, streak_shield')
    .eq('id', userId)
    .single();

  const { data: txns } = await supabase
    .from('marketplace_transactions')
    .select('id, item_type, cost, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  return res.json({
    balance: profile?.praxis_points ?? 0,
    boostedUntil: profile?.profile_boosted_until ?? null,
    streakShield: profile?.streak_shield ?? false,
    transactions: txns ?? [],
    catalogue: Object.entries(SPEND_CATALOGUE).map(([id, item]) => ({ id, ...item })),
  });
});

/**
 * POST /points/spend
 * Body: { userId, item }
 * Deducts points and applies the purchased effect.
 */
export const spendPoints = catchAsync(async (req: Request, res: Response) => {
  const { item, nodeId } = req.body as { item?: string; nodeId?: string };
  const userId: string = (req as any).user?.id ?? req.body.userId;
  if (!userId) return res.status(400).json({ error: 'Authentication required' });
  if (!item || !SPEND_CATALOGUE[item]) {
    throw new BadRequestError(`Unknown item "${item}". Valid items: ${Object.keys(SPEND_CATALOGUE).join(', ')}`);
  }

  const { cost } = SPEND_CATALOGUE[item];

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('praxis_points, profile_boosted_until')
    .eq('id', userId)
    .single();

  if (error || !profile) throw new NotFoundError('User profile not found');

  const currentPoints: number = profile.praxis_points ?? 0;
  if (currentPoints < cost) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      message: `You need ${cost} PP but only have ${currentPoints} PP.`,
      needed: cost,
      have: currentPoints,
    });
  }

  // Apply effect
  const updates: Record<string, unknown> = { praxis_points: currentPoints - cost };

  if (item === 'boost_visibility') {
    // Extend boost: stack on existing if active, otherwise start fresh
    const now = Date.now();
    const existing = profile.profile_boosted_until ? new Date(profile.profile_boosted_until).getTime() : now;
    const base = Math.max(existing, now);
    updates.profile_boosted_until = new Date(base + 24 * 3600 * 1000).toISOString();
  }
  if (item === 'suspend_goal') {
    if (!nodeId) throw new BadRequestError('nodeId is required for suspend_goal');

    const { data: treeRow } = await supabase
      .from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle();

    if (!treeRow?.nodes) throw new NotFoundError('Goal tree not found');
    const nodes: any[] = Array.isArray(treeRow.nodes) ? treeRow.nodes : [];
    const nodeIndex = nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) throw new BadRequestError('Node not found in goal tree');
    nodes[nodeIndex] = { ...nodes[nodeIndex], status: 'suspended' };

    await supabase.from('goal_trees').update({ nodes }).eq('user_id', userId);
  }

  // Other items (goal_slot, coaching_session, super_match, etc.) are logged but
  // their enforcement lives in the respective controllers. The transaction record
  // is the source of truth for "has the user purchased this."

  // Record transaction
  await supabase.from('marketplace_transactions').insert({
    user_id: userId,
    item_type: item,
    cost,
    metadata: { label: SPEND_CATALOGUE[item].label },
  });

  // Update profile
  await supabase.from('profiles').update(updates).eq('id', userId);

  return res.json({
    success: true,
    item,
    spent: cost,
    balance: currentPoints - cost,
    effect: updates,
  });
});
