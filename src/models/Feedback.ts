import { FeedbackGrade } from './FeedbackGrade';

export interface Feedback {
  id: string;
  giverId: string;
  receiverId: string;
  goalNodeId: string; // The ID of the goal node the feedback is for
  grade: FeedbackGrade;
  comment?: string;
  createdAt: Date;
}
