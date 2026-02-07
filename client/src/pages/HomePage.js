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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const axios_1 = __importDefault(require("axios"));
const react_router_dom_1 = require("react-router-dom");
const Domain_1 = require("../models/Domain");
const HomePage = ({ userId }) => {
    const [user, setUser] = (0, react_1.useState)(null);
    const [matches, setMatches] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const fetchData = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const [userRes, matchesRes] = yield Promise.all([
                    axios_1.default.get(`http://localhost:3001/users/${userId}`),
                    axios_1.default.get(`http://localhost:3001/matches/${userId}`)
                ]);
                setUser(userRes.data);
                setMatches(matchesRes.data.slice(0, 3)); // Show top 3 matches
            }
            catch (error) {
                console.error('Error fetching data:', error);
            }
            finally {
                setLoading(false);
            }
        });
        fetchData();
    }, [userId]);
    if (loading) {
        return (<div className="home-page loading-container">
        <div className="loading">Loading your progress...</div>
      </div>);
    }
    if (!user) {
        return <div className="home-page">User not found</div>;
    }
    const hasGoals = user.goalTree && user.goalTree.length > 0;
    return (<div className="home-page">
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
            <react_router_dom_1.Link to="/goals" className="btn btn-secondary">
              {hasGoals ? 'Edit Goals' : 'Create Goals'}
            </react_router_dom_1.Link>
          </div>

          {hasGoals ? (<div className="goals-grid">
              {user.goalTree.map((goal) => (<div key={goal.id} className="goal-card" style={{ borderLeftColor: (0, Domain_1.getDomainColor)(goal.domain) }}>
                  <div className="goal-header">
                    <h3>{goal.name}</h3>
                    <span className="goal-domain" style={{ background: (0, Domain_1.getDomainColor)(goal.domain) + '20', color: (0, Domain_1.getDomainColor)(goal.domain) }}>
                      {goal.domain}
                    </span>
                  </div>
                  
                  <div className="progress-section">
                    <div className="progress-info">
                      <span>Progress</span>
                      <span className="progress-percentage">{goal.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                    width: `${goal.progress}%`,
                    background: (0, Domain_1.getDomainColor)(goal.domain)
                }}/>
                    </div>
                  </div>
                  
                  <div className="goal-meta">
                    <div className="meta-item">
                      <span className="meta-label">Weight:</span>
                      <span className="meta-value">{goal.weight.toFixed(1)}</span>
                    </div>
                    {goal.subGoals && goal.subGoals.length > 0 && (<div className="meta-item">
                        <span className="meta-label">Sub-goals:</span>
                        <span className="meta-value">{goal.subGoals.length}</span>
                      </div>)}
                  </div>
                </div>))}
            </div>) : (<div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3>No goals yet</h3>
              <p>Start by defining your primary goals to get matched with like-minded people.</p>
              <react_router_dom_1.Link to="/goals" className="btn btn-primary">
                Create Your First Goal
              </react_router_dom_1.Link>
            </div>)}
        </section>

        {/* Top Matches */}
        {hasGoals && (<section className="matches-preview fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="section-header">
              <h2>Top Matches</h2>
              <react_router_dom_1.Link to="/matches" className="view-all-link">
                View All →
              </react_router_dom_1.Link>
            </div>

            {matches.length > 0 ? (<div className="matches-grid">
                {matches.map((match) => (<react_router_dom_1.Link key={match.id} to={`/chat/${match.id}`} className="match-card">
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
                      {match.sharedGoalDomains.slice(0, 3).map((domain) => (<span key={domain} className="domain-badge" style={{
                            background: (0, Domain_1.getDomainColor)(domain) + '20',
                            color: (0, Domain_1.getDomainColor)(domain)
                        }}>
                          {domain}
                        </span>))}
                    </div>
                  </react_router_dom_1.Link>))}
              </div>) : (<div className="empty-state">
                <p>No matches yet. Complete your goals to start getting matched!</p>
              </div>)}
          </section>)}

        {/* Quick Actions */}
        <section className="quick-actions fade-in" style={{ animationDelay: '0.3s' }}>
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <react_router_dom_1.Link to={`/profile/${userId}`} className="action-card">
              <span className="action-icon">👤</span>
              <h3>View Profile</h3>
              <p>See your complete goal tree and progress</p>
            </react_router_dom_1.Link>
            
            <react_router_dom_1.Link to="/matches" className="action-card">
              <span className="action-icon">🤝</span>
              <h3>Find Matches</h3>
              <p>Discover people with aligned ambitions</p>
            </react_router_dom_1.Link>
            
            <react_router_dom_1.Link to="/goals" className="action-card">
              <span className="action-icon">🎯</span>
              <h3>Update Goals</h3>
              <p>Refine your path and priorities</p>
            </react_router_dom_1.Link>
          </div>
        </section>
      </div>
    </div>);
};
exports.default = HomePage;
