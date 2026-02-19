import React, { useState } from 'react';
import axios from 'axios';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';

interface InitialGoalSetupProps {
  userId: string;
  onGoalsCreated: () => void;
}

const InitialGoalSetup: React.FC<InitialGoalSetupProps> = ({ userId, onGoalsCreated }) => {
  const [currentGoalName, setCurrentGoalName] = useState('');
  const [currentGoalDomain, setCurrentGoalDomain] = useState<Domain>(Domain.CAREER);
  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddGoalToList = () => {
    if (!currentGoalName.trim()) {
      alert('Goal name cannot be empty.');
      return;
    }

    const newGoal: GoalNode = {
      id: Math.random().toString(36).substring(7), // Simple unique ID
      name: currentGoalName,
      domain: currentGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: undefined, // These are always root goals for initial setup
    };

    setGoals([...goals, newGoal]);
    setCurrentGoalName(''); // Clear input
  };

  const handleSaveInitialGoals = async () => {
    if (goals.length === 0) {
      alert('Please add at least one goal.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await axios.post(`http://localhost:3001/goals`, {
        userId: userId,
        nodes: goals,
        rootNodes: goals, // All initial goals are root goals
      });
      onGoalsCreated(); // Notify parent component (OnboardingPage)
    } catch (err) {
      setError('Failed to save initial goals.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="initial-goal-setup">
      <h2>Let's set your initial goals!</h2>
      <p>Add a few main areas you want to focus on.</p>

      <div>
        <input
          type="text"
          placeholder="e.g., Learn React, Run a Marathon"
          value={currentGoalName}
          onChange={(e) => setCurrentGoalName(e.target.value)}
        />
        <select value={currentGoalDomain} onChange={(e) => setCurrentGoalDomain(e.target.value as Domain)}>
          {Object.values(Domain).map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        <button onClick={handleAddGoalToList}>Add Goal</button>
      </div>

      {goals.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Your Initial Goals:</h3>
          <ul>
            {goals.map((goal) => (
              <li key={goal.id}>{goal.name} ({goal.domain})</li>
            ))}
          </ul>
          <button onClick={handleSaveInitialGoals} disabled={loading}>
            {loading ? 'Saving...' : 'Save Goals and Continue'}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}
    </div>
  );
};

export default InitialGoalSetup;
