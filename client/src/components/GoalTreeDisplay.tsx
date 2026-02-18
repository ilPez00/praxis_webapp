import React from 'react';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import GoalNodeDisplay from './GoalNodeDisplay';
import { Box } from '@mui/material'; // Import Box from Material-UI

interface GoalTreeDisplayProps {
  goalTree: GoalTree;
  onEdit: (node: GoalNode) => void;
  onAddSubGoal: (parentId: string) => void;
  onDelete: (nodeId: string) => void; // Add onDelete prop
}

export const GoalTreeDisplay: React.FC<GoalTreeDisplayProps> = ({ goalTree, onEdit, onAddSubGoal, onDelete }) => {
  const renderGoalNode = (node: GoalNode) => (
    <Box key={node.id} sx={{ ml: node.parentId ? 2 : 0 }}> {/* Use sx prop for Material-UI styling */}
      <GoalNodeDisplay node={node} onEdit={onEdit} onAddSubGoal={onAddSubGoal} onDelete={onDelete} />
      {goalTree.nodes
        .filter((n) => n.parentId === node.id)
        .map((n) => renderGoalNode(n))}
    </Box>
  );

  return (
    <Box sx={{ mt: 4 }}> {/* Main container for the goal tree display */}
      {goalTree.rootNodes.map((node) => renderGoalNode(node))}
    </Box>
  );
};
