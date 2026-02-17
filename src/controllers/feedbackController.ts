import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { Feedback } from '../models/Feedback';
import { GoalTree } from '../models/GoalTree';
import { updateWeightFromGrade } from '../models/GoalNode'; // Import the utility function
import { v4 as uuidv4 } from 'uuid';

export const submitFeedback = async (req: Request, res: Response) => {
  const { giverId, receiverId, goalNodeId, grade, comment } = req.body;

  if (!giverId || !receiverId || !goalNodeId || !grade) {
    return res.status(400).json({ message: 'Missing required feedback fields.' });
  }

  try {
    const newFeedback: Feedback = {
      id: uuidv4(),
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
      return res.status(500).json({ message: feedbackError.message });
    }

    // 2. Fetch the receiver's goal tree
    const { data: receiverGoalTreeData, error: treeFetchError } = await supabase
      .from('goal_trees')
      .select('*')
      .eq('userId', receiverId)
      .single();

    if (treeFetchError && treeFetchError.code !== 'PGRST116') {
      return res.status(500).json({ message: treeFetchError.message });
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
        console.error('Failed to update receiver goal tree after feedback:', updateTreeError.message);
        // Continue, as feedback was already submitted
      }
      console.log('Goal tree recalibrated successfully for user:', receiverId);
    } else {
      console.warn(`Receiver goal tree not found for user ${receiverId}. Cannot recalibrate.`);
    }

    res.status(201).json({ message: 'Feedback submitted successfully.', feedback: submittedFeedback });

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
