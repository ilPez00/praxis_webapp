import { Domain } from './Domain';
import { FeedbackGrade } from './FeedbackGrade';

export interface GoalNode {
  id: string;
  domain: Domain;
  name: string;
  weight: number;
  progress: number;
  parentId?: string;
}

export function updateWeightFromGrade(goalNode: GoalNode, grade: FeedbackGrade): GoalNode {
  let newWeight = goalNode.weight;
  switch (grade) {
    case FeedbackGrade.SUCCEEDED:
      newWeight *= 0.8; // Easier
      break;
    case FeedbackGrade.DISTRACTED:
      newWeight *= 1.2; // Harder
      break;
    case FeedbackGrade.LEARNED:
      newWeight *= 0.9; // Slightly easier due to new understanding
      break;
    case FeedbackGrade.ADAPTED:
      newWeight *= 1.05; // Slightly harder due to adaptation
      break;
    case FeedbackGrade.NOT_APPLICABLE:
      // No change
      break;
  }
  return { ...goalNode, weight: newWeight };
}
