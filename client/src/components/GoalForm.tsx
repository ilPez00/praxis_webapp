import React, { useState } from 'react';
import axios from 'axios';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain'; // Import Domain enum

interface GoalFormProps {
  userId: string;
  parentGoalId?: string; // Optional: if adding a sub-goal
  onGoalAdded: (newGoal: GoalNode) => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ userId, parentGoalId, onGoalAdded }) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState<Domain>(Domain.HEALTH);
  const [weight, setWeight] = useState(1.0);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(`http://localhost:3001/users/${userId}/goals`, {
        name,
        domain,
        weight,
        progress: 0, // New goals start with 0 progress
        subGoals: [],
        parentGoalId: parentGoalId, // Send parent ID if it's a sub-goal
      });
      setMessage(response.data.message);
      onGoalAdded(response.data.goal); // Pass the newly added goal to the parent
      setName('');
      setWeight(1.0);
      setDomain(Domain.HEALTH);
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Failed to add goal.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>{parentGoalId ? 'Add Sub-Goal' : 'Add New Goal'}</h3>
      <p>{message}</p>
      <div>
        <label>Name:</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label>Domain:</label>
        <select value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
          {Object.values(Domain).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Weight:</label>
        <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value))} required />
      </div>
      <button type="submit">{parentGoalId ? 'Add Sub-Goal' : 'Add Goal'}</button>
    </form>
  );
};

export default GoalForm;
