import { GoalNode } from './GoalNode';

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  bio: string;
  goalTree: GoalNode[];
  // Other user-related fields can be added here
}
