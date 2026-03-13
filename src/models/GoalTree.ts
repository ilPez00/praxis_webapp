import { GoalNode } from './GoalNode';

export interface GoalTree {
  id: string;
  user_id: string;
  nodes: GoalNode[];
  root_nodes: any[];
}

