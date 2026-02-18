import { Domain } from './Domain';
import { FeedbackGrade } from './FeedbackGrade';

/**
 * @interface GoalNode
 * @description Represents a specific objective within a user's Goal Tree ($G_j$).
 * Aligned with the Praxis whitepaper, nodes store progress, priority weights, and hierarchical relationships.
 */
export interface GoalNode {
  /** Unique identifier for the goal node. */
  id: string;
  /** The primary life domain this goal belongs to (e.g., Career, Fitness). */
  domain: Domain;
  /** User-defined name or title for the goal. */
  name: string;
  /** User-defined priority weight ($W_j$), dynamically adjusted via peer feedback. Defaults to 1.0. */
  weight: number;
  /** Current progress toward goal completion ($P \in [0, 1]$). */
  progress: number;
  /** Optional category or sub-domain classification for better organization. */
  category?: string;
  /** Optional detailed description or notes about the goal. */
  customDetails?: string;
  /** The ID of the parent goal node, establishing a hierarchical tree structure. */
  parentId?: string;
  /** IDs of goals that must be completed before this one, representing "Progression Pathways". */
  prerequisiteGoalIds?: string[];
}

/**
 * @description Dynamically adjusts the priority weight of a goal node based on peer feedback.
 * Implements the "Tree Recalibration" logic from section 3.5 of the whitepaper.
 * @param goalNode - The current state of the goal node.
 * @param grade - The feedback grade received from an interaction partner.
 * @returns A new GoalNode instance with the updated weight.
 */
export function updateWeightFromGrade(goalNode: GoalNode, grade: FeedbackGrade): GoalNode {
  let newWeight = goalNode.weight;
  switch (grade) {
    case FeedbackGrade.SUCCEEDED:
      newWeight *= 0.8; // Task was successfully navigated; reduce priority weight as it's becoming easier.
      break;
    case FeedbackGrade.DISTRACTED:
      newWeight *= 1.2; // User was distracted; increase priority weight to refocus efforts.
      break;
    case FeedbackGrade.LEARNED:
      newWeight *= 0.9; // Significant learning occurred, making future progress slightly easier.
      break;
    case FeedbackGrade.ADAPTED:
      newWeight *= 1.05; // User adapted their approach, requiring a slight increase in focus.
      break;
    case FeedbackGrade.NOT_APPLICABLE:
      // No change in weight for non-applicable feedback.
      break;
  }
  return { ...goalNode, weight: newWeight };
}
