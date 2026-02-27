import React, { useState } from 'react';
import { GoalTree } from '../../../models/GoalTree';
import { GoalNode } from '../../../models/GoalNode';
import GoalNodeDisplay from './GoalNodeDisplay';
import { Box } from '@mui/material';

interface GoalTreeDisplayProps {
  goalTree: GoalTree;
  onEdit: (node: GoalNode) => void;
  onAddSubGoal: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
}

export const GoalTreeDisplay: React.FC<GoalTreeDisplayProps> = ({ goalTree, onEdit, onAddSubGoal, onDelete }) => {
  const [collapsedNodes, setCollapsedNodes] = useState<string[]>([]);

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  };

  const renderGoalNode = (node: GoalNode) => {
    const isCollapsed = collapsedNodes.includes(node.id);
    return (
      <Box key={node.id} sx={{ ml: node.parentId ? 2 : 0 }}>
        <GoalNodeDisplay
          node={node}
          onEdit={onEdit}
          onAddSubGoal={onAddSubGoal}
          onDelete={onDelete}
          isCollapsed={isCollapsed}
          onToggle={toggleNode}
          hasChildren={(goalTree.nodes ?? []).some(n => n.parentId === node.id)}
        />
        {!isCollapsed &&
          (goalTree.nodes ?? [])
            .filter((n) => n.parentId === node.id)
            .map((n) => renderGoalNode(n))}
      </Box>
    );
  };

  return (
    <Box sx={{ mt: 4 }}>
      {(goalTree.rootNodes ?? []).map((node) => renderGoalNode(node))}
    </Box>
  );
};
