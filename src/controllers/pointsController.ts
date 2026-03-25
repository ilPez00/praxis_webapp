import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError, NotFoundError } from '../utils/appErrors';

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

export const getCatalogue = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.json(
    Object.entries(SPEND_CATALOGUE).map(([id, item]) => ({ id, ...item }))
  );
};

export const getBalance = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

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

export const spendPoints = catchAsync(async (req: Request, res: Response) => {
  const { item, nodeId } = req.body as { item?: string; nodeId?: string };
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!item || !SPEND_CATALOGUE[item]) {
    throw new BadRequestError(`Unknown item "${item}". Valid items: ${Object.keys(SPEND_CATALOGUE).join(', ')}`);
  }

  const { cost } = SPEND_CATALOGUE[item];

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
    if (nodeIndex === -1) throw new NotFoundError('Node not found in goal tree');
    nodes[nodeIndex] = { ...nodes[nodeIndex], status: 'suspended' };

    await supabase.from('goal_trees').update({ nodes }).eq('user_id', userId);
  }

  await supabase.from('marketplace_transactions').insert({
    user_id: userId,
    item_type: item,
    cost,
    metadata: { label: SPEND_CATALOGUE[item].label },
  });

  const { data: newBalance, error: rpcError } = await supabase.rpc('spend_points', {
    p_user_id: userId,
    p_amount: cost,
    p_boost_until: item === 'boost_visibility' ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null,
  });

  if (rpcError || newBalance === null) {
    const { data: lastTxn } = await supabase
      .from('marketplace_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('item_type', item)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (lastTxn) await supabase.from('marketplace_transactions').delete().eq('id', lastTxn.id);

    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      message: 'Transaction failed. Insufficient balance.',
      needed: cost,
    });
  }

  return res.json({
    success: true,
    item,
    spent: cost,
    balance: newBalance,
  });
});
