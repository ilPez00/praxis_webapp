import React, { useState } from 'react';
import axios from 'axios';
import { GoalNode, updateWeightFromGrade } from '../models/GoalNode';
import { FeedbackGrade } from '../models/FeedbackGrade';
import GoalForm from './GoalForm'; // Import GoalForm

interface GoalNodeDisplayProps {
  goal: GoalNode;
  userId: string;
  onGoalUpdated?: (updatedGoal: GoalNode) => void;
  onGoalDeleted?: (deletedGoalId: string) => void;
}

const GoalNodeDisplay: React.FC<GoalNodeDisplayProps> = ({ goal, userId, onGoalUpdated, onGoalDeleted }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(goal.name);
  const [editedProgress, setEditedProgress] = useState(goal.progress);
  const [editedWeight, setEditedWeight] = useState(goal.weight);
  const [showSubGoalForm, setShowSubGoalForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackGrade, setFeedbackGrade] = useState<FeedbackGrade>(FeedbackGrade.NOT_APPLICABLE);

  const handleUpdateGoal = async () => {
    try {
      const response = await axios.put(`http://localhost:3001/users/${userId}/goals/${goal.id}`, {
        name: editedName,
        progress: editedProgress,
        weight: editedWeight,
      });
      if (onGoalUpdated) {
        onGoalUpdated(response.data.goal);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const handleDeleteGoal = async () => {
    if (window.confirm(`Are you sure you want to delete "${goal.name}" and all its subgoals?`)) {
      try {
        await axios.delete(`http://localhost:3001/users/${userId}/goals/${goal.id}`);
        if (onGoalDeleted) {
          onGoalDeleted(goal.id);
        }
      } catch (error) {
        console.error('Failed to delete goal:', error);
      }
    }
  };

  const handleSubGoalAdded = (newSubGoal: GoalNode) => {
    if (onGoalUpdated) {
      console.log('Sub-goal added:', newSubGoal);
    }
    setShowSubGoalForm(false);
  };

  const handleApplyFeedback = async () => {
    try {
      const updatedGoal = updateWeightFromGrade(goal, feedbackGrade);
      const response = await axios.put(`http://localhost:3001/users/${userId}/goals/${goal.id}`, {
        weight: updatedGoal.weight,
      });
      if (onGoalUpdated) {
        onGoalUpdated(response.data.goal);
      }
      setShowFeedbackForm(false);
    } catch (error) {
      console.error('Failed to apply feedback:', error);
    }
  };

  return (
    <div style={{ marginLeft: '20px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
      {isEditing ? (
        <div>
          <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} />
          <input type="number" value={editedProgress} onChange={(e) => setEditedProgress(parseInt(e.target.value))} />
          <input type="number" value={editedWeight} step="0.1" onChange={(e) => setEditedWeight(parseFloat(e.target.value))} />
          <button onClick={handleUpdateGoal}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <h3>{goal.name} ({goal.domain})</h3>
          <p>Progress: {goal.progress}%</p>
          <p>Weight: {goal.weight.toFixed(2)}</p>
          <button onClick={() => setIsEditing(true)}>Edit</button>
          <button onClick={handleDeleteGoal}>Delete</button>
          <button onClick={() => setShowSubGoalForm(!showSubGoalForm)}>
            {showSubGoalForm ? 'Cancel Add Sub-Goal' : 'Add Sub-Goal'}
          </button>
          <button onClick={() => setShowFeedbackForm(!showFeedbackForm)}>
            {showFeedbackForm ? 'Cancel Feedback' : 'Apply Feedback'}
          </button>

          {showSubGoalForm && (
            <GoalForm parentGoalId={goal.id} userId={userId} onGoalAdded={handleSubGoalAdded} />
          )}

          {showFeedbackForm && (
            <div>
              <select value={feedbackGrade} onChange={(e) => setFeedbackGrade(e.target.value as FeedbackGrade)}>
                {Object.values(FeedbackGrade).map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              <button onClick={handleApplyFeedback}>Apply</button>
            </div>
          )}
        </div>
      )}
      {goal.subGoals && goal.subGoals.length > 0 && (
        <div>
          <h4>Sub-Goals:</h4>
          {goal.subGoals.map((subGoal) => (
            <GoalNodeDisplay
              key={subGoal.id}
              goal={subGoal}
              userId={userId}
              onGoalUpdated={onGoalUpdated}
              onGoalDeleted={onGoalDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GoalNodeDisplay;
