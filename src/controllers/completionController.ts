import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';
import { createAchievementFromGoal } from './achievementController';
import { resolveBetsOnGoalCompletion } from './bettingController';
import { pushNotification } from './notificationController';

/**
 * POST /completions
 * Creates a peer verification request for a goal node, and sends a special
 * 'completion_request' message in the requester→verifier DM thread.
 */
export const createCompletionRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { requesterId, verifierId, goalNodeId, goalName, evidenceUrl } = req.body;

  if (!requesterId || !verifierId || !goalNodeId || !goalName) {
    throw new BadRequestError('requesterId, verifierId, goalNodeId, and goalName are required.');
  }
  if (!evidenceUrl) {
    throw new BadRequestError('evidenceUrl is required — attach a photo or video of the completed goal.');
  }

  // Monthly limit: same verifier→requester pair may only confirm once per calendar month
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const { data: recent } = await supabase
    .from('completion_requests')
    .select('id')
    .eq('requester_id', requesterId)
    .eq('verifier_id', verifierId)
    .gte('created_at', firstOfMonth.toISOString())
    .limit(1)
    .maybeSingle();

  if (recent) {
    throw new ForbiddenError('This verifier has already confirmed a goal for you this month. Choose a different partner or wait until next month.');
  }

  const { data: request, error } = await supabase
    .from('completion_requests')
    .insert({
      requester_id: requesterId,
      verifier_id: verifierId,
      goal_node_id: goalNodeId,
      goal_name: goalName,
      evidence_url: evidenceUrl,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating completion request:', error.message);
    throw new InternalServerError('Failed to create completion request.');
  }

  // Send a special DM so the verifier sees it in chat
  await supabase.from('messages').insert({
    sender_id: requesterId,
    receiver_id: verifierId,
    content: `I'm claiming completion of my goal: "${goalName}". Can you verify it?\n📎 Evidence: ${evidenceUrl}`,
    message_type: 'completion_request',
    metadata: { requestId: request.id, goalNodeId, goalName, evidenceUrl },
  });

  // Notify the verifier
  pushNotification({
    userId: verifierId,
    type: 'verification',
    title: 'Goal verification requested',
    body: `Someone wants you to verify: "${goalName}"`,
    link: `/communication`,
    actorId: requesterId,
  }).catch(() => {});

  res.status(201).json(request);
});

/**
 * PATCH /completions/:id/respond
 * Verifier approves or rejects the request. On approval, the requester's
 * goal node progress is set to 1.0 in their goal tree.
 */
export const respondToCompletionRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { verifierId, approved } = req.body;

  if (!verifierId || approved === undefined) {
    throw new BadRequestError('verifierId and approved (boolean) are required.');
  }

  const { data: request, error: fetchError } = await supabase
    .from('completion_requests')
    .select('id, requester_id, verifier_id, goal_node_id, goal_name, status, created_at, updated_at')
    .eq('id', id)
    .single();

  if (fetchError || !request) throw new NotFoundError('Completion request not found.');
  if (request.verifier_id !== verifierId) throw new ForbiddenError('You are not the verifier for this request.');
  if (request.status !== 'pending') throw new BadRequestError('This request has already been responded to.');

  const status = approved ? 'approved' : 'rejected';
  const { error: updateError } = await supabase
    .from('completion_requests')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) throw new InternalServerError('Failed to update completion request.');

  if (approved) {
    const requesterId = request.requester_id;

    // Update the requester's goal tree: set the matching node's progress to 1.0
    const { data: tree } = await supabase
      .from('goal_trees')
      .select('nodes')
      .eq('user_id', requesterId)
      .single();

    if (tree?.nodes) {
      const updatedNodes = (tree.nodes as any[]).map((node: any) =>
        node.id === request.goal_node_id ? { ...node, progress: 1.0 } : node
      );
      await supabase
        .from('goal_trees')
        .update({ nodes: updatedNodes })
        .eq('userId', requesterId);

      // Resolve any active bets on this goal (non-fatal)
      const { data: activeBets } = await supabase
        .from('bets')
        .select('id, user_id, goal_node_id, stake_points, status')
        .eq('user_id', requesterId)
        .eq('goal_node_id', request.goal_node_id)
        .eq('status', 'active');

      // Resolve bets first — pays 1.8× stake to requester already
      await resolveBetsOnGoalCompletion(requesterId, request.goal_node_id);

      // Verification bonus (intentionally small — bets already carry the main reward)
      // Re-read balance AFTER bet resolution so we don't overwrite it
      const { data: prof } = await supabase.from('profiles').select('praxis_points').eq('id', requesterId).single();
      if (prof) await supabase.from('profiles').update({ praxis_points: (prof.praxis_points ?? 0) + 20 }).eq('id', requesterId);

      // Verifier reward
      const { data: verProf } = await supabase.from('profiles').select('praxis_points').eq('id', verifierId).single();
      if (verProf) await supabase.from('profiles').update({ praxis_points: (verProf.praxis_points ?? 0) + 10 }).eq('id', verifierId);

      // Auto-create achievement in the community feed for the completed goal
      const completedNode = (tree.nodes as any[]).find((n: any) => n.id === request.goal_node_id);
      if (completedNode) {
        const { data: requesterProfile } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', requesterId)
          .single();
        await createAchievementFromGoal(
          completedNode,
          requesterId,
          requesterProfile?.name || 'Praxis User',
          requesterProfile?.avatar_url || undefined,
        );
      }
    }
  }

  // Send a system message back in the DM so both parties see the result
  const systemContent = approved
    ? `✅ "${request.goal_name}" verified! Goal marked complete.`
    : `❌ "${request.goal_name}" verification declined.`;

  await supabase.from('messages').insert({
    sender_id: verifierId,
    receiver_id: request.requester_id,
    content: systemContent,
    message_type: 'system',
    metadata: { requestId: id, goalNodeId: request.goal_node_id, approved },
  });

  // Notify the requester of the outcome
  pushNotification({
    userId: request.requester_id,
    type: 'verification',
    title: approved ? 'Goal verified!' : 'Verification declined',
    body: approved
      ? `"${request.goal_name}" was approved — goal marked complete.`
      : `"${request.goal_name}" was not approved this time.`,
    link: `/goal-tree`,
    actorId: verifierId,
  }).catch(() => {});

  res.json({ status, requestId: id });
});

/**
 * GET /completions/pending?userId=xxx
 * Returns pending completion_requests where the user is the verifier.
 */
export const getPendingRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.query;
  if (!userId) throw new BadRequestError('userId query param is required.');

  const { data, error } = await supabase
    .from('completion_requests')
    .select('id, requester_id, verifier_id, goal_node_id, goal_name, status, created_at, updated_at')
    .eq('verifier_id', userId as string)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new InternalServerError('Failed to fetch pending requests.');
  res.json(data || []);
});
