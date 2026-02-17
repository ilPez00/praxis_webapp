import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';

const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.CAREER]: '#4CAF50',
  [Domain.INVESTING]: '#26A69A',
  [Domain.FITNESS]: '#E57373',
  [Domain.ACADEMICS]: '#EC407A',
  [Domain.MENTAL_HEALTH]: '#64B5F6',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#78909C',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#9CCC65',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#FFA726',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#AB47BC',
};

interface MatchResult {
  userId: string;
  score: number;
}

const HomePage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUserId(authUser?.id || '1');
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchData = async () => {
      try {
        const [goalsRes, matchesRes] = await Promise.allSettled([
          axios.get(`http://localhost:3001/goals/${currentUserId}`),
          axios.get(`http://localhost:3001/matches/${currentUserId}`),
        ]);

        if (goalsRes.status === 'fulfilled') {
          setGoalTree(goalsRes.value.data);
        }
        if (matchesRes.status === 'fulfilled') {
          setMatches(matchesRes.value.data.slice(0, 3));
        }
      } catch (err) {
        console.error('Error fetching home data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUserId]);

  if (userLoading || loading) {
    return (
      <div className="home-page loading-container">
        <div className="loading">Loading your dashboard...</div>
      </div>
    );
  }

  const rootGoals = goalTree?.rootNodes || [];
  const allNodes = goalTree?.nodes || [];
  const hasGoals = rootGoals.length > 0;
  const userName = user?.name || 'there';

  // Compute average progress across root goals
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((sum, g) => sum + g.progress * 100, 0) / rootGoals.length)
    : 0;

  // Count unique domains
  const activeDomains = new Set(allNodes.map(n => n.domain)).size;

  return (
    <div className="home-page">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>

        {/* Welcome */}
        <section className="welcome-section fade-in">
          <h1>Welcome back, {userName} ⚡</h1>
          <p className="welcome-subtitle">
            {hasGoals
              ? `${allNodes.length} goals across ${activeDomains} domain${activeDomains !== 1 ? 's' : ''} · ${avgProgress}% average progress`
              : 'Start building your goal tree to find meaningful connections.'}
          </p>
        </section>

        {/* Goals Overview */}
        <section className="goals-overview fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="section-header">
            <h2>Your Goals</h2>
            <Link
              to={`/goals/${currentUserId}`}
              style={{ color: '#007AFF', fontWeight: 600, textDecoration: 'none' }}
            >
              {hasGoals ? 'Edit Goals →' : 'Create Goals →'}
            </Link>
          </div>

          {hasGoals ? (
            <div className="goals-grid">
              {rootGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="goal-card"
                  style={{ borderLeftColor: DOMAIN_COLORS[goal.domain] || '#999' }}
                >
                  <div className="goal-header">
                    <h3>{goal.name}</h3>
                    <span
                      className="goal-domain"
                      style={{
                        backgroundColor: `${DOMAIN_COLORS[goal.domain] || '#999'}20`,
                        color: DOMAIN_COLORS[goal.domain] || '#999',
                      }}
                    >
                      {goal.domain}
                    </span>
                  </div>

                  <div className="progress-section">
                    <div className="progress-info">
                      <span>Progress</span>
                      <span className="progress-percentage">
                        {Math.round(goal.progress * 100)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${goal.progress * 100}%`,
                          backgroundColor: DOMAIN_COLORS[goal.domain] || '#007AFF',
                        }}
                      />
                    </div>
                  </div>

                  <div className="goal-meta">
                    <div className="meta-item">
                      <span className="meta-label">Weight:</span>
                      <span className="meta-value">{goal.weight.toFixed(2)}</span>
                    </div>
                    {(() => {
                      const children = allNodes.filter(n => n.parentId === goal.id);
                      return children.length > 0 ? (
                        <div className="meta-item">
                          <span className="meta-label">Sub-goals:</span>
                          <span className="meta-value">{children.length}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3>No goals yet</h3>
              <p>Define your goals to start matching with like-minded people.</p>
              <Link
                to={`/goals/${currentUserId}`}
                style={{
                  display: 'inline-block',
                  padding: '10px 24px',
                  background: '#007AFF',
                  color: 'white',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Build Your Goal Tree
              </Link>
            </div>
          )}
        </section>

        {/* Top Matches */}
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
                <div
                  key={match.userId}
                  className="match-card"
                  onClick={() => navigate(`/chat/${currentUserId}/${match.userId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="match-header">
                    <div className="match-avatar">
                      {match.userId.charAt(0).toUpperCase()}
                    </div>
                    <div className="match-info">
                      <h3>User {match.userId.slice(0, 8)}</h3>
                      <div className="match-score">
                        {Math.round(match.score * 100)}% Compatible
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🤝</div>
              <h3>No matches yet</h3>
              <p>
                {hasGoals
                  ? 'Waiting for other users with similar goals to join.'
                  : 'Set up your goals first to start finding matches.'}
              </p>
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="quick-actions fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="actions-grid">
            <Link to={`/profile/${currentUserId}`} className="action-card">
              <span className="action-icon">👤</span>
              <h3>Profile</h3>
              <p>View and edit your profile</p>
            </Link>
            <Link to={`/goals/${currentUserId}`} className="action-card">
              <span className="action-icon">🌳</span>
              <h3>Goal Tree</h3>
              <p>Manage your goals and sub-goals</p>
            </Link>
            <Link to="/matches" className="action-card">
              <span className="action-icon">🔍</span>
              <h3>Find Matches</h3>
              <p>Discover compatible people</p>
            </Link>
            <Link to="/chat" className="action-card">
              <span className="action-icon">💬</span>
              <h3>Messages</h3>
              <p>Goal-focused conversations</p>
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
};

export default HomePage;
