import React from 'react';
import { GoalNode } from '../models/GoalNode';

interface GoalNodeDisplayProps {
  node: GoalNode;
  onEdit: (node: GoalNode) => void;
  onAddSubGoal: (parentId: string) => void;
}

const GoalNodeDisplay: React.FC<GoalNodeDisplayProps> = ({ node, onEdit, onAddSubGoal }) => {
  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', margin: '10px' }}>
      <h4>{node.name}</h4>
      <p>Domain: {node.domain}</p>
      <p>Progress: {node.progress}</p>
      <p>Weight: {node.weight}</p>
      <button onClick={() => onEdit(node)}>Edit</button>
      <button onClick={() => onAddSubGoal(node.id)}>Add Sub-Goal</button>
    </div>
  );
};

export default GoalNodeDisplay;
