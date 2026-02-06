import React from 'react';
import { GoalNode } from '../models/GoalNode';
import GoalNodeDisplay from './GoalNodeDisplay'; // Import the new component

interface GoalTreeDisplayProps {
  goals: GoalNode[];
  userId: string;
  onGoalUpdated?: (updatedGoal: GoalNode) => void;
  onGoalDeleted?: (deletedGoalId: string) => void;
}

const GoalTreeDisplay: React.FC<GoalTreeDisplayProps> = ({ goals, userId, onGoalUpdated, onGoalDeleted }) => {
  return (
    <div>
      {goals.map((goal) => (
        <GoalNodeDisplay
          key={goal.id}
          goal={goal}
          userId={userId}
          onGoalUpdated={onGoalUpdated}
          onGoalDeleted={onGoalDeleted}
        />
      ))}
    </div>
  );
};

export default GoalTreeDisplay;