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
// client/src/pages/ProfilePage.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
require("../styles/ProfilePage.css");
// Assume these exist or create simple mocks
const useUser_1 = require("../hooks/useUser"); // your auth/user context
const ProfilePage = () => {
    const { user, isLoading } = (0, useUser_1.useUser)(); // Replace with your real hook
    const navigate = (0, react_router_dom_1.useNavigate)();
    // Mock/fallback data — replace with real fetch/context
    const profile = user || {
        name: 'Alfonso',
        username: '@alfonso_milano',
        avatarUrl: 'https://example.com/avatar.jpg', // placeholder
        bio: 'Building better habits in Milan. Fitness & investing enthusiast. Open to meaningful connections.',
        ageRange: '25-34',
        verified: true,
        domains: ['Fitness', 'Investing', 'Career', 'Relationships'],
        overallGrade: 'Consistent Achiever',
        totalGoals: 17,
        completionRate: 68,
        goalTree: [
            {
                id: '1',
                title: 'Reach 10% body fat',
                domain: 'Fitness',
                weight: 0.4,
                progress: 0.65,
                children: [
                    { id: '1.1', title: 'Daily gym 5×/week', domain: 'Fitness', weight: 0.6, progress: 0.8 },
                    { id: '1.2', title: 'Calorie deficit tracking', domain: 'Fitness', weight: 0.4, progress: 0.45 },
                ],
            },
            {
                id: '2',
                title: 'Build €50k investment portfolio',
                domain: 'Investing',
                weight: 0.3,
                progress: 0.42,
                children: [],
            },
            // ... more roots
        ],
    };
    const [expandedNodes, setExpandedNodes] = (0, react_1.useState)(new Set());
    const toggleNode = (id) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id))
                newSet.delete(id);
            else
                newSet.add(id);
            return newSet;
        });
    };
    const renderGoalNode = (node, level = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);
        return (<div key={node.id} className={`goal-item level-${level}`}>
        <div className={`goal-header ${hasChildren ? 'clickable' : ''}`} onClick={() => hasChildren && toggleNode(node.id)}>
          <div className="goal-title">
            {hasChildren && <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>}
            {node.title}
          </div>
          <div className="goal-meta">
            <span className="progress-bar-small" style={{ width: `${node.progress * 100}%` }}/>
            <span className="progress-text">{Math.round(node.progress * 100)}%</span>
            {node.grade && <span className="grade-badge">{node.grade}</span>}
          </div>
        </div>

        {hasChildren && isExpanded && (<div className="goal-children">
            {node.children.map(child => renderGoalNode(child, level + 1))}
          </div>)}
      </div>);
    };
    if (isLoading)
        return <div className="loading">Loading profile...</div>;
    return (<div className="profile-page">
      <div className="profile-header">
        {profile.avatarUrl ? (<img src={profile.avatarUrl} alt="Profile" className="avatar-large"/>) : (<div className="avatar-placeholder">{profile.name.charAt(0)}</div>)}
        <div className="profile-info">
          <h1>{profile.name}</h1>
          <p className="username">{profile.username}</p>
          {profile.verified && (<div className="verified-badge">
              Verified <span>✓</span>
            </div>)}
          <p className="bio">{profile.bio}</p>
          <div className="quick-stats">
            <span>{profile.ageRange}</span>
            <span>•</span>
            <span>{profile.overallGrade}</span>
          </div>
        </div>

        <button className="edit-btn" onClick={() => navigate('/profile/edit')}>
          Edit Profile
        </button>
      </div>

      <div className="profile-stats-card">
        <div className="stat-item">
          <div className="stat-value">{profile.totalGoals}</div>
          <div className="stat-label">Goals</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{profile.completionRate}%</div>
          <div className="stat-label">Overall Progress</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{profile.domains.length}</div>
          <div className="stat-label">Focus Areas</div>
        </div>
      </div>

      <div className="domains-section">
        <h2>Active Domains</h2>
        <div className="domain-chips">
          {profile.domains.map(domain => (<span key={domain} className="domain-chip">{domain}</span>))}
        </div>
      </div>

      <div className="goal-tree-section">
        <h2>Your Goal Tree</h2>
        <div className="goal-tree">
          {profile.goalTree.length === 0 ? (<p className="empty-state">No goals yet. Start building!</p>) : (profile.goalTree.map(node => renderGoalNode(node)))}
        </div>
      </div>

      {/* Future: add sections for recent feedback, matches compatibility preview, etc. */}
    </div>);
};
exports.default = ProfilePage;
