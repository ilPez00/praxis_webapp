# Praxis WebApp Implementation Guide

This document contains all the remaining components and pages for the Praxis webapp. Each file should be created in the specified location.

## FILES CREATED SO FAR:
✅ /client/src/models/Domain.ts - Updated with all 9 domains and colors
✅ /client/src/models/GoalNode.ts - Updated with whitepaper spec
✅ /client/src/models/FeedbackGrade.ts - Updated with all feedback grades
✅ /client/src/index.css - Global styles
✅ /client/src/App.tsx - Main app with routing
✅ /client/src/styles/App.css - App-specific styles
✅ /client/src/components/NavigationBar.tsx - Navigation component
✅ /client/src/components/NavigationBar.css - Nav styles
✅ /client/src/pages/LandingPage.tsx - Landing page
✅ /client/src/pages/LandingPage.css - Landing page styles

## REMAINING FILES TO CREATE:

### 1. HomePage.tsx
Location: /client/src/pages/HomePage.tsx
Purpose: Main dashboard showing user's goals, progress, and potential matches

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { GoalNode } from '../models/GoalNode';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { getDomainColor } from '../models/Domain';
import './HomePage.css';

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
```

### 2. HomePage.css
Location: /client/src/pages/HomePage.css

```css
.home-page {
  min-height: 100vh;
  padding: var(--spacing-xl) 0;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-section {
  margin-bottom: var(--spacing-xl);
}

.welcome-section h1 {
  font-size: 2.5rem;
  margin-bottom: var(--spacing-sm);
}

.welcome-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.section-header h2 {
  font-size: 1.75rem;
}

.goals-overview,
.matches-preview,
.quick-actions {
  margin-bottom: var(--spacing-xl);
}

.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.goal-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  border-left: 4px solid;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.goal-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
  gap: var(--spacing-sm);
}

.goal-header h3 {
  font-size: 1.125rem;
  flex: 1;
}

.goal-domain {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.progress-section {
  margin-bottom: var(--spacing-md);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.progress-percentage {
  font-weight: 600;
  color: var(--text-primary);
}

.progress-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--transition-slow);
}

.goal-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.875rem;
}

.meta-item {
  display: flex;
  gap: var(--spacing-xs);
}

.meta-label {
  color: var(--text-secondary);
}

.meta-value {
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 2px dashed var(--border-medium);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-md);
}

.empty-state h3 {
  margin-bottom: var(--spacing-sm);
}

.empty-state p {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);
}

.matches-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.match-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  text-decoration: none;
  color: var(--text-primary);
}

.match-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  opacity: 1;
}

.match-header {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.match-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--praxis-primary), var(--praxis-secondary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  flex-shrink: 0;
}

.match-info {
  flex: 1;
}

.match-info h3 {
  margin-bottom: var(--spacing-xs);
}

.match-score {
  font-size: 0.875rem;
  color: var(--praxis-primary);
  font-weight: 600;
}

.shared-goals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.domain-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
}

.view-all-link {
  color: var(--praxis-primary);
  font-weight: 600;
  font-size: 0.9375rem;
  text-decoration: none;
  transition: opacity var(--transition-fast);
}

.view-all-link:hover {
  opacity: 0.7;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
}

.action-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  text-decoration: none;
  color: var(--text-primary);
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  opacity: 1;
}

.action-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: var(--spacing-md);
}

.action-card h3 {
  margin-bottom: var(--spacing-xs);
}

.action-card p {
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .welcome-section h1 {
    font-size: 2rem;
  }
  
  .goals-grid,
  .matches-grid,
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
```

## SUMMARY OF IMPLEMENTATION

The Praxis webapp now has:

1. **Core Models** - All 9 domains from whitepaper, enhanced GoalNode with weights/progress, complete FeedbackGrade system
2. **Routing & Auth** - Full routing system, login/logout flow, protected routes
3. **iOS-Inspired Design** - Clean, modern styling matching Android app colors
4. **Landing Page** - Stunning hero section with animated gradients, domain showcase, how-it-works
5. **Navigation** - Fixed header with theme toggle, responsive design
6. **Home Dashboard** - Goals overview with progress, top matches, quick actions

## NEXT STEPS TO COMPLETE

Create the following pages (use similar patterns as HomePage):
- OnboardingPage - Identity verification and introduction
- GoalSelectionPage - Hierarchical goal tree builder (4-level as per whitepaper)
- ProfilePage - Complete user profile with goal tree visualization
- MatchesPage - Browse all matches with filtering
- ChatPage - Goal-focused DM channel with feedback grading
- LoginPage/SignupPage - Authentication forms

All pages should follow the established design patterns with fade-in animations, consistent spacing, and domain-colored accents.

The backend already has basic structure - needs enhancement for matching algorithm and feedback system.
