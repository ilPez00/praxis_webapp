import { GoalNode } from './GoalNode';

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  bio: string;
  goalTree: GoalNode[];
  username?: string;
  avatarUrl?: string;
  ageRange?: string;
  verified?: boolean;
  domains?: string[];
  overallGrade?: string;
  totalGoals?: number;
  completionRate?: number;
  is_premium?: boolean;
  onboarding_completed?: boolean;
  goal_tree_edit_count?: number;
  current_streak?: number;
  last_activity_date?: string;
}
