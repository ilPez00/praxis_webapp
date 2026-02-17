import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/MatchesPage.css';

interface Match {
    userId: string;
    score: number;
}

const MatchesPage: React.FC = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // TODO: Get actual user ID from authentication context
    const currentUserId = '1'; // Hardcoded for now for testing

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/matches/${currentUserId}`);
                setMatches(response.data);
            } catch (err) {
                setError('Failed to fetch matches.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, [currentUserId]);

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
                {/* Filters can be re-implemented once we have more data/metadata */}
            </div>

            <div className="matches-list">
                {matches.length === 0 ? (
                    <p className="empty-state">No matches yet — keep building your goals!</p>
                ) : (
                    matches.map(match => (
                        <div key={match.userId} className="match-card" onClick={() => navigate(`/chat/${currentUserId}/${match.userId}`)}>
                            <div className="match-avatar-placeholder">{match.userId.charAt(0)}</div>
                            <div className="match-info">
                                <div className="match-name-row">
                                    <h3>User: {match.userId}</h3>
                                    <span className="compatibility-badge">{Math.round(match.score * 100)}% Match</span>
                                </div>
                                <p className="bio-snippet">Compatible on shared goals.</p>
                                {/* Additional user details would go here */}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MatchesPage;