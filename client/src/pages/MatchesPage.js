"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// client/src/pages/MatchesPage.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
require("../styles/MatchesPage.css");
const mockMatches = [
    { id: '1', name: 'Elena Rossi', username: '@elena_fit', avatarUrl: '', compatibility: 92, sharedDomains: ['Fitness', 'Health'], bioSnippet: 'Marathon runner & nutrition coach in Milan', lastActive: 'Active now' },
    { id: '2', name: 'Marco Bianchi', username: '@marcob_invest', avatarUrl: '', compatibility: 87, sharedDomains: ['Investing', 'Career'], bioSnippet: 'Building long-term wealth, open to accountability partners' },
    { id: '3', name: 'Sofia Conti', username: '@sofia_create', avatarUrl: '', compatibility: 78, sharedDomains: ['Creativity', 'Learning'], bioSnippet: 'Designer exploring side projects' },
];
const MatchesPage = () => {
    const [filter, setFilter] = (0, react_1.useState)('all'); // all, high (≥85), medium
    const navigate = (0, react_router_dom_1.useNavigate)();
    const filteredMatches = mockMatches.filter(m => {
        if (filter === 'high')
            return m.compatibility >= 85;
        if (filter === 'medium')
            return m.compatibility >= 70 && m.compatibility < 85;
        return true;
    });
    return (<div className="matches-page">
      <div className="matches-header">
        <h1>Matches</h1>
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'high' ? 'active' : ''} onClick={() => setFilter('high')}>High (85%+)</button>
          <button className={filter === 'medium' ? 'active' : ''} onClick={() => setFilter('medium')}>Good</button>
        </div>
      </div>

      <div className="matches-list">
        {filteredMatches.length === 0 ? (<p className="empty-state">No matches yet — keep building your goals!</p>) : (filteredMatches.map(match => (<div key={match.id} className="match-card" onClick={() => navigate(`/chat/${match.id}`)}>
              {match.avatarUrl ? (<img src={match.avatarUrl} alt={match.name} className="match-avatar"/>) : (<div className="match-avatar-placeholder">{match.name.charAt(0)}</div>)}
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
            </div>)))}
      </div>
    </div>);
};
exports.default = MatchesPage;
