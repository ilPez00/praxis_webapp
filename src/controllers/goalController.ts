import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';
import { createAchievementFromGoal } from './achievementController';
import { EmbeddingService } from '../services/EmbeddingService';
import logger from '../utils/logger';
import { catchAsync, AppError, NotFoundError, ForbiddenError, BadRequestError, InternalServerError } from '../utils/appErrors';
import { bumpDomainProficiency } from '../utils/proficiency';

const embeddingService = new EmbeddingService();

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];
const MILESTONE_MESSAGES: Record<number, string> = {
  25: "Making moves — 25% through",
  50: "Halfway there on",
  75: "75% done with",
  100: "Just completed",
};

/**
 * Fire-and-forget: creates a feed post when a goal node crosses a milestone threshold.
 * Uses marketplace_transactions to track which milestones have already been posted.
 */
async function autoPostMilestone(
  userId: string,
  nodeId: string,
  nodeName: string,
  domain: string,
  oldProgress: number,
  newProgress: number,
): Promise<void> {
  const oldPct = Math.round(oldProgress * 100);
  const newPct = Math.round(newProgress * 100);
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (oldPct < threshold && newPct >= threshold) {
      // Check if already posted for this milestone
      const { data: existing } = await supabase
        .from('marketplace_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('item_type', 'milestone_post')
        .contains('metadata', { node_id: nodeId, milestone: threshold })
        .maybeSingle();
      if (existing) continue;

      const verb = threshold === 100 ? 'completed' : `${threshold}% through`;
      const body = `${MILESTONE_MESSAGES[threshold]} "${nodeName}" ${threshold < 100 ? '— still going!' : ''}`.trim();

      await supabase.from('posts').insert({
        user_id: userId,
        body,
        context: userId,
        metadata: { milestone: true, node_id: nodeId, threshold, domain },
      });
      await supabase.from('marketplace_transactions').insert({
        user_id: userId,
        item_type: 'milestone_post',
        cost: 0,
        metadata: { node_id: nodeId, milestone: threshold },
      });
      logger.info(`Milestone post created: user=${userId} node=${nodeName} @${threshold}%`);
    }
  }
}

/**
 * @description Computes the new streak values based on last activity date.
 * Rules:
 *   - If last activity was today: no change (already counted)
 *   - If last activity was yesterday: increment streak
 *   - If last activity was > 1 day ago (or never): reset to 1
 */
const computeStreakUpdate = (
  lastActivityDate: string | null | undefined,
  currentStreak: number
): { current_streak: number; last_activity_date: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  if (!lastActivityDate) {
    return { current_streak: 1, last_activity_date: todayStr };
  }

  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

  if (diffDays === 0) {
    // Already logged today — keep streak unchanged
    return { current_streak: currentStreak, last_activity_date: todayStr };
  } else if (diffDays === 1) {
    // Consecutive day — extend streak
    return { current_streak: currentStreak + 1, last_activity_date: todayStr };
  } else {
    // Streak broken — reset to 1
    return { current_streak: 1, last_activity_date: todayStr };
  }
};

/**
 * @description Helper function to fetch user profile details (name and avatar URL).
 * Used for denormalizing user info when creating achievements.
 * @param userId - The ID of the user whose profile to fetch.
 * @returns An object containing user's name and avatarUrl.
 */
const getUserProfileDetails = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, avatar_url') // Select name and avatar_url from the profiles table
    .eq('id', userId)
    .single(); // Expect a single matching profile

  if (error) {
    // Non-fatal: achievement creation is a nice-to-have; don't block goal tree save
    logger.warn('Could not fetch user profile for achievement (non-fatal):', error.message);
    return { name: 'Unknown User', avatar_url: null };
  }
  // Return fetched profile or default values if profile is null or error occurs
  return profile || { name: 'Unknown User', avatar_url: null };
};

/**
 * @description HTTP endpoint to retrieve a user's entire goal tree.
 * @param req - The Express request object, with userId in params.
 * @param res - The Express response object.
 */
export const getGoalTree = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params; // Extract user ID from request parameters

  // Query Supabase for the goal tree associated with the userId
  const { data, error } = await supabase
    .from('goal_trees')
    .select('*') // Select all columns of the goal tree
    .eq('userId', userId)
    .single(); // Expect a single goal tree per user

  // Handle errors, excluding 'PGRST116' which indicates no rows found (expected for new users)
  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching goal tree:', error.message);
    throw new InternalServerError('Failed to fetch goal tree data.');
  }

  // Respond with the fetched goal tree or a 404 if not found
  if (data) {
    // Also return domain_proficiency from profile so the frontend can display it
    const { data: profile } = await supabase
      .from('profiles')
      .select('domain_proficiency')
      .eq('id', userId)
      .single();
    res.json({ ...data, domain_proficiency: (profile?.domain_proficiency as Record<string, number>) ?? {} });
  } else {
    throw new NotFoundError('Goal tree not found');
  }
});

/**
 * @description HTTP endpoint to create or update a user's goal tree.
 * This function also checks for newly completed goals and triggers achievement creation.
 * @param req - The Express request object, containing userId, nodes, and rootNodes in the body.
 * @param res - The Express response object.
 */
export const createOrUpdateGoalTree = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId, nodes, rootNodes } = req.body;

  // Fetch user's premium status and edit count
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    logger.error('Error fetching user profile for premium status:', profileError.message);
    throw new InternalServerError('Failed to retrieve user premium status.');
  }

  const isPremium = profile?.is_premium || false;
  // goal_tree_edit_count may be null if the column hasn't been added yet — treat as 0
  const editCount: number = profile?.goal_tree_edit_count ?? 0;
  const rootGoalLimit = 3;
  const safeRootNodes = rootNodes || [];

  const isAdmin = profile?.is_admin || false;

  // Count extra goal slots purchased via marketplace (200 PP each)
  const { count: extraSlots } = await supabase
    .from('marketplace_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('item_type', 'goal_slot');

  const effectiveLimit = rootGoalLimit + (extraSlots ?? 0);

  // Enforce root goal limit for non-premium, non-admin users
  if (!isPremium && !isAdmin && safeRootNodes.length > effectiveLimit) {
    throw new ForbiddenError(
      `You are limited to ${effectiveLimit} primary goals. Purchase an Extra Goal Slot (200 PP) or upgrade to premium.`
    );
  }

  // --- Achievement Creation Logic ---
  // When any goal's progress reaches >= 1.0 (100%) and it wasn't completed before,
  // createAchievementFromGoal() is automatically called. This creates a public
  // achievement entry visible to the whole community on the dashboard.
  // The check compares the incoming `nodes` against the existing tree's nodes;
  // newly completed goals (progress was < 1 or node didn't exist before) trigger creation.
  let existingNodes: GoalNode[] = [];
  // Fetch the user's existing goal tree to compare against new changes
  const { data: existingTreeData, error: fetchExistingTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .single();

  if (fetchExistingTreeError && fetchExistingTreeError.code !== 'PGRST116') {
    logger.error('Error fetching existing goal tree for achievement check:', fetchExistingTreeError.message);
    // Don't throw a critical error here, as a new user won't have an existing tree
  } else if (existingTreeData) {
    existingNodes = existingTreeData.nodes; // Store existing nodes for comparison
  }

  // Fetch user profile details to be used in achievement creation (denormalized data)
  const userProfile = await getUserProfileDetails(userId);

  // Fetch already-rewarded node IDs to prevent farming (premium users resetting progress)
  const { data: existingRewardTxns } = await supabase
    .from('marketplace_transactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('item_type', 'goal_completion');
  const alreadyRewardedNodeIds = new Set<string>(
    (existingRewardTxns || []).map((r: any) => r.metadata?.node_id as string).filter(Boolean)
  );

  // Iterate through the new set of goal nodes to identify newly completed goals
  const SINGLE_SAVE_PP_CAP = 500; // prevent bulk-completion exploits
  let totalCompletionPoints = 0;
  const newlyRewardedNodes: { node_id: string; node_name: string; points: number }[] = [];

  for (const newNode of nodes) {
    if (totalCompletionPoints >= SINGLE_SAVE_PP_CAP) break;
    // Check if a goal's progress has reached 100%
    if (newNode.progress >= 1 && !alreadyRewardedNodeIds.has(newNode.id)) {
      // Find the corresponding old node to see its previous progress
      const oldNode = existingNodes.find(n => n.id === newNode.id);
      // If the goal is newly completed (wasn't completed before or didn't exist)
      if (!oldNode || oldNode.progress < 1) {
        // Trigger the creation of an achievement for this completed goal
        await createAchievementFromGoal(newNode, userId, userProfile.name, userProfile.avatar_url || undefined);
        // Award +50 PP × node weight (normalize weight to 0-1 range)
        const normalizedWeight = (newNode.weight ?? 0.5) > 1 ? (newNode.weight ?? 0.5) / 100 : (newNode.weight ?? 0.5);
        const nodePoints = Math.min(
          Math.max(5, Math.round(50 * normalizedWeight)),
          SINGLE_SAVE_PP_CAP - totalCompletionPoints
        );
        totalCompletionPoints += nodePoints;
        newlyRewardedNodes.push({ node_id: newNode.id, node_name: newNode.name, points: nodePoints });
      }
    }
  }
  // Award completion points + log each node to prevent double-awarding (best-effort)
  if (totalCompletionPoints > 0) {
    const currentPoints = profile?.praxis_points ?? 0;
    await supabase
      .from('profiles')
      .update({ praxis_points: currentPoints + totalCompletionPoints })
      .eq('id', userId);
    for (const reward of newlyRewardedNodes) {
      await supabase.from('marketplace_transactions').insert({
        user_id: userId,
        item_type: 'goal_completion',
        cost: 0,
        metadata: { node_id: reward.node_id, node_name: reward.node_name, points_awarded: reward.points },
      });
    }
    logger.info(`Awarded ${totalCompletionPoints} PP to ${userId} for ${newlyRewardedNodes.length} goal completion(s)`);
  }
  // Award domain proficiency for newly completed root-level goals (+1% per completion)
  for (const reward of newlyRewardedNodes) {
    const completedNode = nodes.find((n: any) => n.id === reward.node_id);
    const domain: string | undefined = completedNode?.domain;
    if (domain) {
      bumpDomainProficiency(userId, domain, 1.0).catch(() => {});
    }
  }

  // Auto-post milestone progress to feed (fire-and-forget)
  for (const newNode of nodes) {
    const oldNode = existingNodes.find((n: any) => n.id === newNode.id);
    const oldProgress = oldNode?.progress ?? 0;
    if (newNode.progress !== oldProgress) {
      autoPostMilestone(userId, newNode.id, newNode.name, newNode.domain || '', oldProgress, newNode.progress).catch(() => {});
    }
  }
  // --- End Achievement Creation Logic ---


  // Check if a goal tree already exists for the user
  const { data: existingTree, error: fetchError } = await supabase
    .from('goal_trees')
    .select('id')
    .eq('userId', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    logger.error('Error fetching existing goal tree for update/create:', fetchError.message);
    throw new InternalServerError('Failed to check for existing goal tree.');
  }

  if (existingTree) {
    // Bulk PUT is only allowed for the very first save (editCount === 0).
    // After that, use per-node PATCH/POST/DELETE endpoints.
    if (editCount > 0) {
      throw new ForbiddenError('Use per-node editing after initial setup.');
    }

    // Re-edit gate: non-premium, non-admin users only get one free re-edit after their initial setup.
    // editCount === 0 → free re-edit (initial setup doesn't count against the limit)
    // editCount >= 1 → must be premium or admin
    if (!isPremium && !isAdmin && editCount >= 1) {
      throw new ForbiddenError('You have used your free goal tree edit. Upgrade to Premium to make further changes.');
    }

    // If a tree exists, update it with the new nodes and root nodes
    const { data, error } = await supabase
      .from('goal_trees')
      .update({ nodes, rootNodes: safeRootNodes })
      .eq('userId', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating goal tree:', error.message);
      throw new InternalServerError('Failed to update goal tree.');
    }

    // Increment edit count + update streak (best-effort — non-fatal if columns missing)
    // Only count edits AFTER onboarding is complete — during onboarding, edits are free.
    try {
      const streakUpdate = computeStreakUpdate(profile?.last_activity_date, profile?.current_streak ?? 0);
      const countUpdate = profile?.onboarding_completed ? { goal_tree_edit_count: editCount + 1 } : {};
      await supabase
        .from('profiles')
        .update({
          ...countUpdate,
          ...streakUpdate,
        })
        .eq('id', userId);
    } catch (incrementErr) {
      logger.warn('Could not update goal_tree_edit_count/streak (columns may not exist yet):', incrementErr);
    }

    // Fire-and-forget: generate + store embeddings for semantic matching
    embeddingService.generateAndStoreEmbeddings(userId, safeRootNodes).catch((e) =>
      logger.error('Embedding generation failed (non-fatal):', e)
    );

    res.json(data); // Respond with the updated goal tree
  } else {
    // If no tree exists, create a new one
    const { data, error } = await supabase
      .from('goal_trees')
      .insert([{ userId, nodes, rootNodes: safeRootNodes }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating goal tree:', error.message);
      throw new InternalServerError('Failed to create goal tree.');
    }

    // Update streak on initial save too (best-effort)
    try {
      const streakUpdate = computeStreakUpdate(profile?.last_activity_date, profile?.current_streak ?? 0);
      await supabase.from('profiles').update(streakUpdate).eq('id', userId);
    } catch (streakErr) {
      logger.warn('Could not update streak on initial save:', streakErr);
    }

    // Fire-and-forget: generate + store embeddings for semantic matching
    embeddingService.generateAndStoreEmbeddings(userId, safeRootNodes).catch((e) =>
      logger.error('Embedding generation failed (non-fatal):', e)
    );

    res.status(201).json(data); // Respond with the newly created goal tree
  }
});

/**
 * PATCH /goals/:userId/node/:nodeId/progress
 * Update a single goal node's progress without triggering the edit-count gate.
 * Awards PP + domain proficiency if the node newly hits 100%.
 */
export const updateNodeProgress = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, nodeId } = req.params;
  const requesterId = (req as any).user?.id;
  if (requesterId !== userId) throw new ForbiddenError('You can only update your own goals.');

  const progress = Number(req.body.progress);
  if (isNaN(progress) || progress < 0 || progress > 100) {
    throw new NotFoundError('progress must be a number 0–100.');
  }

  // Fetch current tree
  const { data: tree, error: treeErr } = await supabase
    .from('goal_trees')
    .select('nodes, "rootNodes"')
    .eq('"userId"', userId)
    .single();

  if (treeErr || !tree) throw new NotFoundError('Goal tree not found.');

  const nodes: GoalNode[] = Array.isArray(tree.nodes) ? tree.nodes : [];
  const rootNodes: GoalNode[] = Array.isArray(tree['rootNodes']) ? tree['rootNodes'] : [];

  // Find the node and update its progress
  let wasComplete = false;
  let targetDomain = '';
  const updatedNodes = nodes.map((n: GoalNode) => {
    if (n.id !== nodeId) return n;
    wasComplete = n.progress >= 1;
    targetDomain = n.domain || '';
    return { ...n, progress: progress / 100 };
  });
  const updatedRootNodes = rootNodes.map((n: GoalNode) =>
    n.id !== nodeId ? n : { ...n, progress: progress / 100 }
  );

  if (updatedNodes.length === nodes.length && !updatedNodes.find(n => n.id === nodeId)) {
    throw new NotFoundError('Goal node not found in tree.');
  }

  const { error: updateErr } = await supabase
    .from('goal_trees')
    .update({ nodes: updatedNodes, 'rootNodes': updatedRootNodes })
    .eq('"userId"', userId);

  if (updateErr) throw new InternalServerError(`Failed to update node: ${updateErr.message}`);

  // ── Log to Tracker (for Calendar/Analytics) ──
  // Ensures that updating goal progress counts as an activity dot on the calendar.
  try {
    const { data: tracker } = await supabase
      .from('trackers')
      .upsert({ user_id: userId, type: 'progress' }, { onConflict: 'user_id,type' })
      .select('id')
      .single();

    if (tracker) {
      const node = updatedNodes.find(n => n.id === nodeId);
      await supabase.from('tracker_entries').insert({
        tracker_id: tracker.id,
        user_id: userId,
        data: { 
          node_id: nodeId, 
          node_name: node?.name || 'Goal', 
          progress_pct: progress,
          domain: targetDomain 
        }
      });
    }
  } catch (err) {
    logger.warn('Failed to log progress to tracker (non-fatal):', err);
  }

  // Award PP + proficiency + achievement if newly completed (0→100%)
  const oldNode = nodes.find(n => n.id === nodeId);
  const oldProgress = oldNode?.progress ?? 0;
  if (!wasComplete && progress === 100) {
    const node = updatedNodes.find(n => n.id === nodeId);
    const { data: profile } = await supabase
      .from('profiles').select('praxis_points, name, avatar_url').eq('id', userId).single();
    if (profile && node) {
      const weight = node?.weight ?? 1;
      const ppAward = Math.round(50 * weight);
      await supabase.from('profiles')
        .update({ praxis_points: (profile.praxis_points ?? 0) + ppAward })
        .eq('id', userId);
      if (targetDomain) bumpDomainProficiency(userId as string, targetDomain, 1.0).catch(() => {});
      // Auto-create achievement + community feed post (fire-and-forget)
      createAchievementFromGoal(node, userId as string, profile.name, profile.avatar_url ?? undefined).catch(() => {});
      
      // ── GRANT REWARD: Free Edit ──
      // Completion grants a fresh edit session by resetting the count
      await supabase.from('profiles')
        .update({ goal_tree_edit_count: 0 })
        .eq('id', userId);
      logger.info(`Granted free edit to ${userId} for completing node ${nodeId}`);
    }
  }

  // Auto-post milestone to feed (fire-and-forget)
  const updatedNode = updatedNodes.find(n => n.id === nodeId);
  if (updatedNode) {
    autoPostMilestone(String(userId), String(nodeId), updatedNode.name, targetDomain, oldProgress, progress / 100).catch(() => {});
  }

  res.json({ success: true, nodeId, progress });
});

// ─── Per-node CRUD with higher PP gate ────────────────────────────────────────

const NODE_CREATE_COST = 500;
const NODE_EDIT_COST = 100;

/**
 * POST /goals/:userId/node
 * Create a new goal node. Costs 500 PP.
 */
export const createGoalNode = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;
  const requesterId = req.user?.id;
  if (requesterId !== userId) throw new ForbiddenError('You can only modify your own goals.');

  const { name, description, domain, targetDate, completionMetric, parentId } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new BadRequestError('name is required.');
  }

  // 1. Check balance
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('praxis_points, goal_tree_edit_count')
    .eq('id', userId)
    .single();
  if (profileErr || !profile) throw new InternalServerError('Failed to fetch user profile.');

  const currentPoints: number = profile.praxis_points ?? 0;
  if (currentPoints < NODE_CREATE_COST) {
    throw new AppError(`Insufficient Praxis Points. Creating a node costs ${NODE_CREATE_COST} PP (you have ${currentPoints}).`, 402);
  }

  // 2. Load existing tree
  const { data: tree, error: treeErr } = await supabase
    .from('goal_trees')
    .select('nodes, "rootNodes"')
    .eq('userId', userId)
    .single();
  if (treeErr || !tree) throw new NotFoundError('Goal tree not found. Create your initial tree first.');

  const nodes: GoalNode[] = Array.isArray(tree.nodes) ? tree.nodes : [];
  const rootNodes: GoalNode[] = Array.isArray(tree['rootNodes']) ? tree['rootNodes'] : [];

  // Validate parentId if supplied
  if (parentId && !nodes.find((n: GoalNode) => n.id === parentId)) {
    throw new BadRequestError('parentId does not match any existing node.');
  }

  // 3. Build new node
  const newNode: GoalNode & Record<string, any> = {
    id: crypto.randomUUID(),
    name: name.trim(),
    customDetails: description ?? undefined,
    domain: domain ?? 'General',
    targetDate: targetDate ?? undefined,
    completionMetric: completionMetric ?? undefined,
    parentId: parentId ?? undefined,
    progress: 0,
    weight: 1,
    created_at: new Date().toISOString(),
  };

  const updatedNodes = [...nodes, newNode];
  // Root nodes = nodes with no parentId; append if this is a root node
  const updatedRootNodes = parentId ? rootNodes : [...rootNodes, newNode];

  // 4. Save updated nodes + rootNodes
  const { error: saveErr } = await supabase
    .from('goal_trees')
    .update({ nodes: updatedNodes, 'rootNodes': updatedRootNodes })
    .eq('userId', userId);
  if (saveErr) throw new InternalServerError(`Failed to save new node: ${saveErr.message}`);

  // 5. Increment edit count + deduct PP
  const editCount: number = profile.goal_tree_edit_count ?? 0;
  const { error: profileUpdateErr } = await supabase
    .from('profiles')
    .update({
      praxis_points: currentPoints - NODE_CREATE_COST,
      goal_tree_edit_count: editCount + 1,
    })
    .eq('id', userId);
  if (profileUpdateErr) throw new InternalServerError('Failed to deduct PP.');

  const newBalance = currentPoints - NODE_CREATE_COST;
  res.status(201).json({ node: newNode, newBalance });
});

/**
 * PATCH /goals/:userId/node/:nodeId
 * Edit fields on an existing goal node. Costs 100 PP.
 */
export const updateGoalNode = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, nodeId } = req.params;
  const requesterId = req.user?.id;
  if (requesterId !== userId) throw new ForbiddenError('You can only modify your own goals.');

  const { name, description, domain, targetDate, completionMetric } = req.body;

  // 1. Check balance
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('praxis_points, goal_tree_edit_count')
    .eq('id', userId)
    .single();
  if (profileErr || !profile) throw new InternalServerError('Failed to fetch user profile.');

  const currentPoints: number = profile.praxis_points ?? 0;
  if (currentPoints < NODE_EDIT_COST) {
    throw new AppError(`Insufficient Praxis Points. Editing a node costs ${NODE_EDIT_COST} PP (you have ${currentPoints}).`, 402);
  }

  // 2. Load existing tree
  const { data: tree, error: treeErr } = await supabase
    .from('goal_trees')
    .select('nodes, "rootNodes"')
    .eq('userId', userId)
    .single();
  if (treeErr || !tree) throw new NotFoundError('Goal tree not found.');

  const nodes: GoalNode[] = Array.isArray(tree.nodes) ? tree.nodes : [];
  const rootNodes: GoalNode[] = Array.isArray(tree['rootNodes']) ? tree['rootNodes'] : [];

  // 3. Find and merge
  const idx = nodes.findIndex((n: GoalNode) => n.id === nodeId);
  if (idx === -1) throw new NotFoundError('Goal node not found in tree.');

  const existing = nodes[idx];
  const patch: Record<string, any> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined) patch.customDetails = description;
  if (domain !== undefined) patch.domain = domain;
  if (targetDate !== undefined) patch.targetDate = targetDate;
  if (completionMetric !== undefined) patch.completionMetric = completionMetric;

  const updatedNode = { ...existing, ...patch };
  const updatedNodes = [...nodes];
  updatedNodes[idx] = updatedNode;

  // Also keep rootNodes in sync
  const updatedRootNodes = rootNodes.map((n: GoalNode) => n.id === nodeId ? updatedNode : n);

  // 4. Save
  const { error: saveErr } = await supabase
    .from('goal_trees')
    .update({ nodes: updatedNodes, 'rootNodes': updatedRootNodes })
    .eq('userId', userId);
  if (saveErr) throw new InternalServerError(`Failed to save node update: ${saveErr.message}`);

  // 5. Increment edit count + deduct PP
  const editCount: number = profile.goal_tree_edit_count ?? 0;
  const { error: profileUpdateErr } = await supabase
    .from('profiles')
    .update({
      praxis_points: currentPoints - NODE_EDIT_COST,
      goal_tree_edit_count: editCount + 1,
    })
    .eq('id', userId);
  if (profileUpdateErr) throw new InternalServerError('Failed to deduct PP.');

  const newBalance = currentPoints - NODE_EDIT_COST;
  res.json({ node: updatedNode, newBalance });
});

/**
 * DELETE /goals/:userId/node/:nodeId
 * Delete a goal node and all its descendants. FREE (no PP cost).
 */
export const deleteGoalNode = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, nodeId } = req.params;
  const targetNodeId = String(nodeId);
  const requesterId = req.user?.id;
  if (requesterId !== userId) throw new ForbiddenError('You can only modify your own goals.');

  // 1. Load existing tree
  const { data: tree, error: treeErr } = await supabase
    .from('goal_trees')
    .select('nodes, "rootNodes"')
    .eq('userId', userId)
    .single();
  if (treeErr || !tree) throw new NotFoundError('Goal tree not found.');

  const nodes: GoalNode[] = Array.isArray(tree.nodes) ? tree.nodes : [];
  const rootNodes: GoalNode[] = Array.isArray(tree['rootNodes']) ? tree['rootNodes'] : [];

  if (!nodes.find((n: GoalNode) => n.id === targetNodeId)) {
    throw new NotFoundError('Goal node not found in tree.');
  }

  // 2. Collect all descendant IDs recursively
  const toDelete = new Set<string>();
  toDelete.add(targetNodeId);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        changed = true;
      }
    }
  }

  const updatedNodes = nodes.filter((n: GoalNode) => !toDelete.has(n.id));
  const updatedRootNodes = rootNodes.filter((n: GoalNode) => !toDelete.has(n.id));

  // 3. Save
  const { error: saveErr } = await supabase
    .from('goal_trees')
    .update({ nodes: updatedNodes, 'rootNodes': updatedRootNodes })
    .eq('userId', userId);
  if (saveErr) throw new InternalServerError(`Failed to delete node: ${saveErr.message}`);

  res.json({ message: 'Node deleted.', deletedCount: toDelete.size });
});
