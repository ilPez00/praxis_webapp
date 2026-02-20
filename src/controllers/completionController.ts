import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';
import { createAchievementFromGoal } from './achievementController';
import { resolveBetsOnGoalCompletion } from './bettingController';

/**
 * POST /completions
 * Creates a peer verification request for a goal node, and sends a special
 * 'completion_request' message in the requester→verifier DM thread.
 */
export const createCompletionRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { requesterId, verifierId, goalNodeId, goalName } = req.body;

  if (!requesterId || !verifierId || !goalNodeId || !goalName) {
    throw new BadRequestError('requesterId, verifierId, goalNodeId, and goalName are required.');
  }

  const { data: request, error } = await supabase
    .from('completion_requests')
    .insert({
      requester_id: requesterId,
      verifier_id: verifierId,
      goal_node_id: goalNodeId,
      goal_name: goalName,
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
    content: `I'm claiming completion of my goal: "${goalName}". Can you verify it?`,
    message_type: 'completion_request',
    metadata: { requestId: request.id, goalNodeId, goalName },
  });

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
    .select('*')
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
    // Update the requester's goal tree: set the matching node's progress to 1.0
    const { data: tree } = await supabase
      .from('goal_trees')
      .select('nodes')
      .eq('userId', request.requester_id)
      .single();

    if (tree?.nodes) {
      const updatedNodes = (tree.nodes as any[]).map((node: any) =>
        node.id === request.goal_node_id ? { ...node, progress: 1.0 } : node
      );
      await supabase
        .from('goal_trees')
        .update({ nodes: updatedNodes })
        .eq('userId', request.requester_id);

      // Resolve any active bets on this goal (non-fatal)
      await resolveBetsOnGoalCompletion(request.requester_id, request.goal_node_id);

      // Auto-create achievement in the community feed for the completed goal
      const completedNode = (tree.nodes as any[]).find((n: any) => n.id === request.goal_node_id);
      if (completedNode) {
        const { data: requesterProfile } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', request.requester_id)
          .single();
        await createAchievementFromGoal(
          completedNode,
          request.requester_id,
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
    .select('*')
    .eq('verifier_id', userId as string)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new InternalServerError('Failed to fetch pending requests.');
  res.json(data || []);
});
