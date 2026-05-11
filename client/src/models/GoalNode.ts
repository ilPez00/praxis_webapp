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
      newWeight *= 0.8;
      break;
    case FeedbackGrade.TRIED_BUT_FAILED:
      newWeight *= 0.95;
      break;
    case FeedbackGrade.MEDIOCRE:
      newWeight *= 1.1;
      break;
    case FeedbackGrade.DISTRACTED:
      newWeight *= 1.2;
      break;
    case FeedbackGrade.TOTAL_NOOB:
      newWeight *= 1.5;
      break;
    case FeedbackGrade.LEARNED:
      newWeight *= 0.9;
      break;
    case FeedbackGrade.ADAPTED:
      newWeight *= 1.05;
      break;
    case FeedbackGrade.NOT_APPLICABLE:
      break;
  }
  return { ...goalNode, weight: newWeight };
}
