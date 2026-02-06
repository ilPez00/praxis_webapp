import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { GoalNode } from '../models/GoalNode';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { getDomainColor } from '../models/Domain';
// No separate CSS import needed - use shared styles/pages.css

interface HomePageProps {
  userId: string;
}

const HomePage: React.FC<HomePageProps> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, matchesRes] = await Promise.all([
          axios.get(`http://localhost:3001/users/${userId}`),
          axios.get(`http://localhost:3001/matches/${userId}`)
        ]);
        setUser(userRes.data);
        setMatches(matchesRes.data.slice(0, 3)); // Show top 3 matches
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="home-page loading-container">
        <div className="loading">Loading your progress...</div>
      </div>
    );
  }

  if (!user) {
    return <div className="home-page">User not found</div>;
  }

  const hasGoals = user.goalTree && user.goalTree.length > 0;

  return (
    <div className="home-page">
      <div className="container">
        {/* Welcome Section */}
        <section className="welcome-section fade-in">
          <h1>Welcome back, {user.name}! ⚡</h1>
          <p className="welcome-subtitle">Your journey to focused progress continues.</p>
        </section>

        {/* Goals Overview */}
        <section className="goals-overview fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="section-header">
            <h2>Your Goal Tree</h2>
            <Link to="/goals" className="btn btn-secondary">
              {hasGoals ? 'Edit Goals' : 'Create Goals'}
            </Link>
          </div>

          {hasGoals ? (
            <div className="goals-grid">
              {user.goalTree.map((goal) => (
                <div 
                  key={goal.id} 
                  className="goal-card"
                  style={{ borderLeftColor: getDomainColor(goal.domain) }}
                >
                  <div className="goal-header">
                    <h3>{goal.name}</h3>
                    <span 
                      className="goal-domain"
                      style={{ background: getDomainColor(goal.domain) + '20', color: getDomainColor(goal.domain) }}
                    >
                      {goal.domain}
                    </span>
                  </div>
                  
                  <div className="progress-section">
                    <div className="progress-info">
                      <span>Progress</span>
                      <span className="progress-percentage">{goal.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${goal.progress}%`,
                          background: getDomainColor(goal.domain)
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="goal-meta">
                    <div className="meta-item">
                      <span className="meta-label">Weight:</span>
                      <span className="meta-value">{goal.weight.toFixed(1)}</span>
                    </div>
                    {goal.subGoals && goal.subGoals.length > 0 && (
                      <div className="meta-item">
                        <span className="meta-label">Sub-goals:</span>
                        <span className="meta-value">{goal.subGoals.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3>No goals yet</h3>
              <p>Start by defining your primary goals to get matched with like-minded people.</p>
              <Link to="/goals" className="btn btn-primary">
                Create Your First Goal
              </Link>
            </div>
          )}
        </section>

        {/* Top Matches */}
        {hasGoals && (
          <section className="matches-preview fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="section-header">
              <h2>Top Matches</h2>
              <Link to="/matches" className="view-all-link">
                View All →
              </Link>
            </div>

            {matches.length > 0 ? (
              <div className="matches-grid">
                {matches.map((match) => (
                  <Link 
                    key={match.id}
                    to={`/chat/${match.id}`}
                    className="match-card"
                  >
                    <div className="match-header">
                      <div className="match-avatar">
                        {match.otherUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="match-info">
                        <h3>{match.otherUser.name}</h3>
                        <div className="match-score">
                          {(match.compatibilityScore * 100).toFixed(0)}% match
                        </div>
                      </div>
                    </div>
                    
                    <div className="shared-goals">
                      {match.sharedGoalDomains.slice(0, 3).map((domain) => (
                        <span 
                          key={domain}
                          className="domain-badge"
                          style={{ 
                            background: getDomainColor(domain) + '20',
                            color: getDomainColor(domain)
                          }}
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No matches yet. Complete your goals to start getting matched!</p>
              </div>
            )}
          </section>
        )}

        {/* Quick Actions */}
        <section className="quick-actions fade-in" style={{ animationDelay: '0.3s' }}>
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <Link to={`/profile/${userId}`} className="action-card">
              <span className="action-icon">👤</span>
              <h3>View Profile</h3>
              <p>See your complete goal tree and progress</p>
            </Link>
            
            <Link to="/matches" className="action-card">
              <span className="action-icon">🤝</span>
              <h3>Find Matches</h3>
              <p>Discover people with aligned ambitions</p>
            </Link>
            
            <Link to="/goals" className="action-card">
              <span className="action-icon">🎯</span>
              <h3>Update Goals</h3>
              <p>Refine your path and priorities</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
