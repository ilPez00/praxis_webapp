import React from 'react';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import GoalNodeDisplay from './GoalNodeDisplay';

interface GoalTreeDisplayProps {
  goalTree: GoalTree;
  onEdit: (node: GoalNode) => void;
  onAddSubGoal: (parentId: string) => void;
}

export const GoalTreeDisplay: React.FC<GoalTreeDisplayProps> = ({ goalTree, onEdit, onAddSubGoal }) => {
  const renderGoalNode = (node: GoalNode) => (
    <div key={node.id} style={{ marginLeft: node.parentId ? 20 : 0 }}>
      <GoalNodeDisplay node={node} onEdit={onEdit} onAddSubGoal={onAddSubGoal} />
      {goalTree.nodes
        .filter((n) => n.parentId === node.id)
        .map((n) => renderGoalNode(n))}
    </div>
  );

  return (
    <div>
      {goalTree.rootNodes.map((node) => renderGoalNode(node))}
    </div>
  );
};
