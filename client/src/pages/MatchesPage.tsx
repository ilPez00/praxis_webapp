import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/MatchesPage.css';
import { useUser } from '../hooks/useUser';

interface Match {
    userId: string;
    score: number;
}

const MatchesPage: React.FC = () => {
    const { user } = useUser();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        const fetchMatches = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/matches/${user.id}`);
                setMatches(response.data);
            } catch (err) {
                setError('Failed to fetch matches.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, [user]);

    if (loading) {
        return <div className="matches-page">Loading matches...</div>;
    }

    if (error) {
        return <div className="matches-page">{error}</div>;
    }

    return (
        <div className="matches-page">
            <div className="matches-header">
                <h1>Your Matches</h1>
            </div>

            <div className="matches-list">
                {matches.length === 0 ? (
                    <p className="empty-state">No matches yet — keep building your goals!</p>
                ) : (
                    matches.map(match => (
                        <div key={match.userId} className="match-card" onClick={() => user && navigate(`/chat/${user.id}/${match.userId}`)}>
                            <div className="match-avatar-placeholder">{match.userId.charAt(0)}</div>
                            <div className="match-info">
                                <div className="match-name-row">
                                    <h3>User: {match.userId.substring(0, 8)}...</h3>
                                    <span className="compatibility-badge">{Math.round(match.score * 100)}% Match</span>
                                </div>
                                <p className="bio-snippet">Compatible on shared goals.</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MatchesPage;