import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../models/User'; // Adjust path as necessary
import { GoalNode } from '../models/GoalNode'; // Adjust path as necessary
import GoalTreeDisplay from '../components/GoalTreeDisplay'; // To be created
import GoalForm from '../components/GoalForm'; // To be created

const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!id) {
        setError('User ID is missing.');
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`http://localhost:3001/users/${id}`);
        setUser(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch user profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [id]);

  const handleGoalAdded = (newGoal: GoalNode) => {
    if (user) {
      setUser({
        ...user,
        goalTree: [...user.goalTree, newGoal]
      });
      setShowGoalForm(false); // Hide form after adding
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userId'); // Clear stored user ID
    navigate('/login'); // Redirect to login page
  };


  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user data found.</div>;

  return (
    <div>
      <h1>{user.name}'s Profile</h1>
      <p>Email: {user.email}</p>
      <p>Age: {user.age}</p>
      <p>Bio: {user.bio}</p>
      <button onClick={handleLogout}>Logout</button>

      <h2>Goal Tree</h2>
      <button onClick={() => setShowGoalForm(!showGoalForm)}>
        {showGoalForm ? 'Cancel Add Goal' : 'Add New Goal'}
      </button>

      {showGoalForm && <GoalForm userId={user.id} onGoalAdded={handleGoalAdded} />}

      {user.goalTree.length > 0 ? (
        <GoalTreeDisplay goals={user.goalTree} userId={user.id} />
      ) : (
        <p>No goals defined yet. Add one!</p>
      )}
    </div>
  );
};

export default ProfilePage;
