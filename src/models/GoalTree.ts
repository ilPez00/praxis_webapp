import { GoalNode } from './GoalNode';

export interface GoalTree {
  id: string;
  userId: string;
  nodes: GoalNode[];
  rootNodes: GoalNode[];
}
