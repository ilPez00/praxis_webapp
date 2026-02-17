import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';
import { useParams } from 'react-router-dom';
import { GoalTreeDisplay } from '../components/GoalTreeDisplay';

const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalDomain, setNewGoalDomain] = useState<Domain>(Domain.CAREER);

  const [editingGoal, setEditingGoal] = useState<GoalNode | null>(null);
  const [editedGoalName, setEditedGoalName] = useState('');
  const [editedGoalDomain, setEditedGoalDomain] = useState<Domain>(Domain.CAREER);

  const [addingSubGoalTo, setAddingSubGoalTo] = useState<string | null>(null);
  const [newSubGoalName, setNewSubGoalName] = useState('');
  const [newSubGoalDomain, setNewSubGoalDomain] = useState<Domain>(Domain.CAREER);


  useEffect(() => {
    const fetchGoalTree = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/goals/${id}`);
        setGoalTree(response.data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setGoalTree({ id: 'new', userId: id || '', nodes: [], rootNodes: [] });
        } else {
          setError('Failed to fetch goal tree.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchGoalTree();
    }
  }, [id]);

  const handleAddGoal = async () => {
    if (!id || !newGoalName.trim()) {
      alert('Goal name cannot be empty.');
      return;
    }

    const newGoal: GoalNode = {
      id: Math.random().toString(36).substring(7),
      name: newGoalName,
      domain: newGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: undefined, // Root goal
    };

    const updatedNodes = goalTree ? [...goalTree.nodes, newGoal] : [newGoal];
    const updatedRootNodes = goalTree ? [...goalTree.rootNodes, newGoal] : [newGoal];

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data);
      setNewGoalName('');
    } catch (err) {
      setError('Failed to add new goal.');
      console.error(err);
    }
  };

  const handleEdit = (node: GoalNode) => {
    setEditingGoal(node);
    setEditedGoalName(node.name);
    setEditedGoalDomain(node.domain);
  };

  const handleSaveEdit = async () => {
    if (!editingGoal || !editedGoalName.trim()) {
      alert('Edited goal name cannot be empty.');
      return;
    }

    const updatedNodes = goalTree?.nodes.map((node) =>
      node.id === editingGoal.id ? { ...node, name: editedGoalName, domain: editedGoalDomain } : node
    ) || [];

    const updatedRootNodes = goalTree?.rootNodes.map((node) =>
      node.id === editingGoal.id ? { ...node, name: editedGoalName, domain: editedGoalDomain } : node
    ) || [];

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data);
      setEditingGoal(null); // Exit editing mode
      setEditedGoalName('');
    } catch (err) {
      setError('Failed to save edited goal.');
      console.error(err);
    }
  };

  const handleAddSubGoal = (parentId: string) => {
    setAddingSubGoalTo(parentId);
    setNewSubGoalName('');
    setNewSubGoalDomain(Domain.CAREER);
  };

  const handleSaveSubGoal = async () => {
    if (!id || !addingSubGoalTo || !newSubGoalName.trim()) {
      alert('Sub-goal name cannot be empty.');
      return;
    }

    const newSubGoal: GoalNode = {
      id: Math.random().toString(36).substring(7),
      name: newSubGoalName,
      domain: newSubGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: addingSubGoalTo,
    };

    const updatedNodes = goalTree ? [...goalTree.nodes, newSubGoal] : [newSubGoal];
    // Sub-goals are not root nodes, so rootNodes remain unchanged

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: goalTree?.rootNodes || [], // rootNodes remain the same
      });
      setGoalTree(response.data);
      setAddingSubGoalTo(null); // Exit adding sub-goal mode
      setNewSubGoalName('');
    } catch (err) {
      setError('Failed to add sub-goal.');
      console.error(err);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!goalTree) {
    return <div>No goal tree found. Start by adding a new goal!</div>;
  }

  return (
    <div>
      <h1>Goal Tree for User {id}</h1>

      <div>
        <input
          type="text"
          placeholder="New Goal Name"
          value={newGoalName}
          onChange={(e) => setNewGoalName(e.target.value)}
        />
        <select value={newGoalDomain} onChange={(e) => setNewGoalDomain(e.target.value as Domain)}>
          {Object.values(Domain).map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        <button onClick={handleAddGoal}>Add Goal</button>
      </div>

      {editingGoal && (
        <div>
          <h2>Edit Goal</h2>
          <input
            type="text"
            value={editedGoalName}
            onChange={(e) => setEditedGoalName(e.target.value)}
          />
          <select value={editedGoalDomain} onChange={(e) => setEditedGoalDomain(e.target.value as Domain)}>
            {Object.values(Domain).map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
          <button onClick={handleSaveEdit}>Save</button>
          <button onClick={() => setEditingGoal(null)}>Cancel</button>
        </div>
      )}

      {addingSubGoalTo && (
        <div>
          <h2>Add Sub-Goal to {goalTree?.nodes.find(node => node.id === addingSubGoalTo)?.name}</h2>
          <input
            type="text"
            placeholder="New Sub-Goal Name"
            value={newSubGoalName}
            onChange={(e) => setNewSubGoalName(e.target.value)}
          />
          <select value={newSubGoalDomain} onChange={(e) => setNewSubGoalDomain(e.target.value as Domain)}>
            {Object.values(Domain).map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
          <button onClick={handleSaveSubGoal}>Add Sub-Goal</button>
          <button onClick={() => setAddingSubGoalTo(null)}>Cancel</button>
        </div>
      )}

      {goalTree.rootNodes.length > 0 ? (
        <GoalTreeDisplay goalTree={goalTree} onEdit={handleEdit} onAddSubGoal={handleAddSubGoal} />
      ) : (
        <div>No goals in your tree yet. Add one above!</div>
      )}
    </div>
  );
};

export default GoalTreePage;
