// client/src/pages/MatchesPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MatchesPage.css';

// Mock data — replace with API fetch
interface Match {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  compatibility: number; // 0-100
  sharedDomains: string[];
  bioSnippet: string;
  lastActive?: string;
}

const mockMatches: Match[] = [
  { id: '1', name: 'Elena Rossi', username: '@elena_fit', avatarUrl: '', compatibility: 92, sharedDomains: ['Fitness', 'Health'], bioSnippet: 'Marathon runner & nutrition coach in Milan', lastActive: 'Active now' },
  { id: '2', name: 'Marco Bianchi', username: '@marcob_invest', avatarUrl: '', compatibility: 87, sharedDomains: ['Investing', 'Career'], bioSnippet: 'Building long-term wealth, open to accountability partners' },
  { id: '3', name: 'Sofia Conti', username: '@sofia_create', avatarUrl: '', compatibility: 78, sharedDomains: ['Creativity', 'Learning'], bioSnippet: 'Designer exploring side projects' },
];

const MatchesPage: React.FC = () => {
  const [filter, setFilter] = useState('all'); // all, high (≥85), medium
  const navigate = useNavigate();

  const filteredMatches = mockMatches.filter(m => {
    if (filter === 'high') return m.compatibility >= 85;
    if (filter === 'medium') return m.compatibility >= 70 && m.compatibility < 85;
    return true;
  });

  return (
    <div className="matches-page">
      <div className="matches-header">
        <h1>Matches</h1>
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'high' ? 'active' : ''} onClick={() => setFilter('high')}>High (85%+)</button>
          <button className={filter === 'medium' ? 'active' : ''} onClick={() => setFilter('medium')}>Good</button>
        </div>
      </div>

      <div className="matches-list">
        {filteredMatches.length === 0 ? (
          <p className="empty-state">No matches yet — keep building your goals!</p>
        ) : (
          filteredMatches.map(match => (
            <div
              key={match.id}
              className="match-card"
              onClick={() => navigate(`/chat/${match.id}`)}
            >
              {match.avatarUrl ? (
                <img src={match.avatarUrl} alt={match.name} className="match-avatar" />
              ) : (
                <div className="match-avatar-placeholder">{match.name.charAt(0)}</div>
              )}
              <div className="match-info">
                <div className="match-name-row">
                  <h3>{match.name}</h3>
                  <span className="compatibility-badge">{match.compatibility}% Match</span>
                </div>
                <p className="username">{match.username}</p>
                <p className="bio-snippet">{match.bioSnippet}</p>
                <div className="shared-domains">
                  {match.sharedDomains.map(d => <span key={d} className="domain-pill">{d}</span>)}
                </div>
                {match.lastActive && <p className="last-active">{match.lastActive}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MatchesPage;
