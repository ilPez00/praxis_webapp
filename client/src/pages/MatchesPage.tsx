import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Match } from '../models/Match'; // Adjust path as necessary
import { User } from '../models/User'; // Adjust path as necessary

const MatchesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map()); // To store matched user details

  useEffect(() => {
    const fetchMatches = async () => {
      if (!id) {
        setError('User ID is missing.');
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`http://localhost:3001/users/${id}/matches`);
        setMatches(response.data);

        // Fetch details for each matched user
        const fetchedUsers = new Map<string, User>();
        for (const match of response.data) {
          if (!fetchedUsers.has(match.userId)) {
            const userResponse = await axios.get(`http://localhost:3001/users/${match.userId}`);
            fetchedUsers.set(match.userId, userResponse.data);
          }
        }
        setUsersMap(fetchedUsers);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch matches.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [id]);

  const handleComputeMatches = async () => {
    if (!id) return;
    setLoading(true);
    setMessage('Computing new matches...');
    try {
      const response = await axios.post(`http://localhost:3001/users/${id}/matches/compute`);
      setMatches(response.data.matches);
      setMessage('New matches computed!');

      const fetchedUsers = new Map<string, User>();
      for (const match of response.data.matches) {
        if (!fetchedUsers.has(match.userId)) {
          const userResponse = await axios.get(`http://localhost:3001/users/${match.userId}`);
          fetchedUsers.set(match.userId, userResponse.data);
        }
      }
      setUsersMap(fetchedUsers);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to compute new matches.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading matches...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Your Matches</h1>
      <button onClick={handleComputeMatches} disabled={loading}>
        Compute New Matches
      </button>
      {message && <p>{message}</p>}

      {matches.length === 0 ? (
        <p>No matches found yet. Try computing new ones!</p>
      ) : (
        <ul>
          {matches.map((match) => {
            const matchedUser = usersMap.get(match.userId);
            return (
              <li key={match.userId}>
                <h3>{matchedUser ? matchedUser.name : 'Unknown User'}</h3>
                <p>Match Score: {(match.score * 100).toFixed(2)}%</p>
                <p>Shared Goals: {match.sharedGoals.length > 0 ? match.sharedGoals.join(', ') : 'None'}</p>
                {matchedUser && (
                  <button onClick={() => navigate(`/chat/${id}/${matchedUser.id}`)}>
                    Chat with {matchedUser.name}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MatchesPage;
