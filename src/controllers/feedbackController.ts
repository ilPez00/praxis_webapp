import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient';
import { Feedback } from '../models/Feedback';
import { GoalTree } from '../models/GoalTree';
import { updateWeightFromGrade } from '../models/GoalNode'; // Import the utility function
import logger from '../utils/logger'; // Import the logger
import { catchAsync, BadRequestError, InternalServerError, NotFoundError } from '../utils/appErrors'; // Import custom errors and catchAsync

/**
 * POST /feedback
 * Submits peer feedback and triggers automatic weight recalibration on the receiver's goal tree.
 *
 * Weight recalibration table (whitepaper §3.5):
 *   SUCCEEDED    → W_j *= 0.8  (goal is easier now, reduce priority)
 *   DISTRACTED   → W_j *= 1.2  (needs more focus, increase priority)
 *   LEARNED      → W_j *= 0.9  (skill gained, slightly reduce pressure)
 *   ADAPTED      → W_j *= 1.05 (adapted approach, slight focus increase)
 *   NOT_APPLICABLE → no change
 *
 * After recalibration the updated goal tree is persisted to Supabase.
 * If the tree update fails (unlikely), feedback is still returned as submitted —
 * the weight adjustment is considered a best-effort side-effect.
 */
export const submitFeedback = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { giverId, receiverId, goalNodeId, grade, comment } = req.body;

  if (!giverId || !receiverId || !goalNodeId || !grade) {
    throw new BadRequestError('Missing required feedback fields.');
  }

  const newFeedback: Feedback = {
    id: crypto.randomUUID(),
    giverId,
    receiverId,
    goalNodeId,
    grade,
    comment,
    createdAt: new Date(),
  };

  // 1. Store the feedback
  const { data: submittedFeedback, error: feedbackError } = await supabase
    .from('feedback')
    .insert([newFeedback])
    .select()
    .single();

  if (feedbackError) {
    logger.error('Supabase error submitting feedback:', feedbackError.message);
    throw new InternalServerError('Failed to submit feedback.');
  }

  // 2. Fetch the receiver's goal tree
  const { data: receiverGoalTreeData, error: treeFetchError } = await supabase
    .from('goal_trees')
    .select('*')
    .eq('userId', receiverId)
    .single();

  if (treeFetchError && treeFetchError.code !== 'PGRST116') {
    logger.error('Supabase error fetching receiver goal tree:', treeFetchError.message);
    throw new InternalServerError('Failed to fetch receiver goal tree.');
  }

  if (receiverGoalTreeData) {
    let receiverGoalTree: GoalTree = receiverGoalTreeData as GoalTree;

    // 3. Update the weight of the specific goalNodeId within that tree
    const updatedNodes = receiverGoalTree.nodes.map(node => {
      if (node.id === goalNodeId) {
        return updateWeightFromGrade(node, grade);
      }
      return node;
    });

    // Also update rootNodes if the goalNodeId is a root node
    const updatedRootNodes = receiverGoalTree.rootNodes.map(node => {
      if (node.id === goalNodeId) {
        return updateWeightFromGrade(node, grade);
      }
      return node;
    });


    // 4. Save the updated goal tree back to Supabase
    const { data: updatedTree, error: updateTreeError } = await supabase
      .from('goal_trees')
      .update({ nodes: updatedNodes, rootNodes: updatedRootNodes })
      .eq('userId', receiverId)
      .select()
      .single();

    if (updateTreeError) {
      logger.error('Failed to update receiver goal tree after feedback:', updateTreeError.message);
      // Continue, as feedback was already submitted
    }
    logger.info('Goal tree recalibrated successfully for user:', receiverId);
  } else {
    logger.warn(`Receiver goal tree not found for user ${receiverId}. Cannot recalibrate.`);
  }

  res.status(201).json({ message: 'Feedback submitted successfully.', feedback: submittedFeedback });
});
