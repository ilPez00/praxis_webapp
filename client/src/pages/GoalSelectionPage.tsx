import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { Domain } from '../models/Domain';
import { GoalNode } from '../models/GoalNode';
import { GoalTree } from '../models/GoalTree';

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

const DOMAIN_ICONS: Record<Domain, string> = {
  [Domain.CAREER]: '💼',
  [Domain.INVESTING]: '📈',
  [Domain.FITNESS]: '💪',
  [Domain.ACADEMICS]: '📚',
  [Domain.MENTAL_HEALTH]: '🧠',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '🔮',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '🎨',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '❤️',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '🤝',
};

// Suggested goal categories per domain
const DOMAIN_CATEGORIES: Record<Domain, string[]> = {
  [Domain.CAREER]: [
    'Get Promoted', 'Switch Careers', 'Start a Business',
    'Build Network', 'Learn New Skills', 'Freelance Work',
  ],
  [Domain.INVESTING]: [
    'Build Portfolio', 'Learn Trading', 'Real Estate',
    'Retirement Planning', 'Passive Income', 'Budgeting',
  ],
  [Domain.FITNESS]: [
    'Lose Weight', 'Build Muscle', 'Run a Marathon',
    'Yoga Practice', 'Sports Training', 'Nutrition Plan',
  ],
  [Domain.ACADEMICS]: [
    'Get a Degree', 'Learn a Language', 'Research Project',
    'Online Courses', 'Certifications', 'Study Group',
  ],
  [Domain.MENTAL_HEALTH]: [
    'Meditation', 'Therapy', 'Stress Management',
    'Better Sleep', 'Journaling', 'Mindfulness',
  ],
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: [
    'Reading Philosophy', 'Ethical Living', 'Self-Reflection',
    'Stoicism Practice', 'Writing Essays', 'Discussion Groups',
  ],
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: [
    'Learn Music', 'Photography', 'Painting',
    'Creative Writing', 'Film Making', 'Cooking',
  ],
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: [
    'Dating', 'Strengthen Relationship', 'Communication Skills',
    'Vulnerability Practice', 'Shared Activities', 'Boundaries',
  ],
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: [
    'Make New Friends', 'Community Service', 'Social Events',
    'Reconnect Old Friends', 'Group Activities', 'Mentoring',
  ],
};

const MAX_FREE_GOALS = 3;

interface SelectedGoal {
  id: string;
  domain: Domain;
  category: string;
  customName: string;
  details: string;
}

const GoalSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<SelectedGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingTree, setExistingTree] = useState<GoalTree | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const uid = authUser?.id || '1';
      setCurrentUserId(uid);

      // Load existing goals if any
      try {
        const res = await axios.get(`http://localhost:3001/goals/${uid}`);
        const tree: GoalTree = res.data;
        setExistingTree(tree);

        // Convert existing root nodes into selected goals for editing
        if (tree.rootNodes && tree.rootNodes.length > 0) {
          const converted: SelectedGoal[] = tree.rootNodes.map((node) => ({
            id: node.id,
            domain: node.domain,
            category: node.category || node.name,
            customName: node.name,
            details: node.customDetails || '',
          }));
          setSelectedGoals(converted);
        }
      } catch {
        // No existing tree — that's fine
      }
    };
    init();
  }, []);

  const handleSelectCategory = (domain: Domain, category: string) => {
    if (selectedGoals.length >= MAX_FREE_GOALS) return;

    // Don't add duplicates
    if (selectedGoals.some(g => g.domain === domain && g.category === category)) return;

    const newGoal: SelectedGoal = {
      id: Math.random().toString(36).substring(2, 9),
      domain,
      category,
      customName: category,
      details: '',
    };

    setSelectedGoals([...selectedGoals, newGoal]);
    setExpandedDomain(null);
  };

  const handleRemoveGoal = (goalId: string) => {
    setSelectedGoals(selectedGoals.filter(g => g.id !== goalId));
  };

  const handleUpdateGoal = (goalId: string, field: 'customName' | 'details', value: string) => {
    setSelectedGoals(selectedGoals.map(g =>
      g.id === goalId ? { ...g, [field]: value } : g
    ));
  };

  const handleSave = async () => {
    if (!currentUserId || selectedGoals.length === 0) return;
    setSaving(true);

    try {
      // Build GoalNode array from selected goals
      const nodes: GoalNode[] = selectedGoals.map((g) => ({
        id: g.id,
        domain: g.domain,
        name: g.customName || g.category,
        weight: 1.0,
        progress: 0,
        category: g.category,
        customDetails: g.details || undefined,
        parentId: undefined,
      }));

      // Preserve existing sub-goals if we have an existing tree
      const existingSubGoals = existingTree?.nodes.filter(n => n.parentId) || [];
      // Only keep sub-goals whose parent still exists
      const validSubGoals = existingSubGoals.filter(sub =>
        nodes.some(n => n.id === sub.parentId)
      );

      const allNodes = [...nodes, ...validSubGoals];

      await axios.post('http://localhost:3001/goals', {
        userId: currentUserId,
        nodes: allNodes,
        rootNodes: nodes,
      });

      navigate(`/goals/${currentUserId}`);
    } catch (err) {
      console.error('Failed to save goals:', err);
      alert('Failed to save goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDomain = (domain: Domain) => {
    setExpandedDomain(expandedDomain === domain ? null : domain);
  };

  const canAddMore = selectedGoals.length < MAX_FREE_GOALS;

  return (
    <div className="goal-selection-page">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div className="page-header">
          <h1>Choose Your Goals</h1>
          <p className="page-subtitle">
            Select up to {MAX_FREE_GOALS} primary goals from any domain.
            You can customize names and add details to refine your matches.
          </p>
          <div className="goals-counter">
            <span className="counter-value">{selectedGoals.length}</span>
            <span>/</span>
            <span className="counter-max">{MAX_FREE_GOALS}</span>
          </div>
        </div>

        {/* Selected Goals */}
        {selectedGoals.length > 0 && (
          <section className="selected-goals fade-in">
            <h2>Selected Goals</h2>
            <div className="selected-goals-list">
              {selectedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="selected-goal-card"
                  style={{ borderLeftColor: DOMAIN_COLORS[goal.domain] }}
                >
                  <div className="goal-content">
                    <div className="goal-top">
                      <span
                        className="goal-domain-badge"
                        style={{
                          backgroundColor: `${DOMAIN_COLORS[goal.domain]}20`,
                          color: DOMAIN_COLORS[goal.domain],
                        }}
                      >
                        {DOMAIN_ICONS[goal.domain]} {goal.domain}
                      </span>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveGoal(goal.id)}
                        title="Remove goal"
                      >
                        ×
                      </button>
                    </div>

                    <div className="goal-customize">
                      <input
                        className="goal-input"
                        type="text"
                        value={goal.customName}
                        onChange={(e) => handleUpdateGoal(goal.id, 'customName', e.target.value)}
                        placeholder="Goal name"
                      />
                      <textarea
                        className="goal-textarea"
                        value={goal.details}
                        onChange={(e) => handleUpdateGoal(goal.id, 'details', e.target.value)}
                        placeholder="Add details (optional) — what specifically do you want to achieve?"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Domain Selection */}
        <section className="domain-selection fade-in" style={{ animationDelay: '0.1s' }}>
          <h2>{selectedGoals.length > 0 ? 'Add More Goals' : 'Pick a Domain'}</h2>
          <div className="domains-list">
            {Object.values(Domain).map((domain) => {
              const isExpanded = expandedDomain === domain;
              const alreadySelected = selectedGoals.filter(g => g.domain === domain).length;

              return (
                <div key={domain} className="domain-item">
                  <button
                    className="domain-button"
                    onClick={() => toggleDomain(domain)}
                    disabled={!canAddMore && !isExpanded}
                  >
                    <div
                      className="domain-indicator"
                      style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                    />
                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>
                      {DOMAIN_ICONS[domain]}
                    </span>
                    <span className="domain-name">
                      {domain}
                      {alreadySelected > 0 && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: '0.75rem',
                          color: DOMAIN_COLORS[domain],
                          fontWeight: 500,
                        }}>
                          ({alreadySelected} selected)
                        </span>
                      )}
                    </span>
                    <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                  </button>

                  {isExpanded && (
                    <div className="goal-categories">
                      {DOMAIN_CATEGORIES[domain].map((cat) => {
                        const isAlreadyPicked = selectedGoals.some(
                          g => g.domain === domain && g.category === cat
                        );
                        return (
                          <button
                            key={cat}
                            className="category-button"
                            onClick={() => handleSelectCategory(domain, cat)}
                            disabled={isAlreadyPicked || !canAddMore}
                            style={{
                              ...(isAlreadyPicked
                                ? {
                                    borderColor: DOMAIN_COLORS[domain],
                                    backgroundColor: `${DOMAIN_COLORS[domain]}15`,
                                    opacity: 0.6,
                                  }
                                : {}),
                              ['--hover-color' as string]: DOMAIN_COLORS[domain],
                            }}
                          >
                            {cat}
                            {isAlreadyPicked && ' ✓'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Actions */}
        <div className="page-actions fade-in" style={{ animationDelay: '0.2s', marginTop: 32, marginBottom: 48 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 32px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: 'transparent',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selectedGoals.length === 0 || saving}
            style={{
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              background: selectedGoals.length === 0 ? '#ccc' : '#007AFF',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: selectedGoals.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : `Save ${selectedGoals.length} Goal${selectedGoals.length !== 1 ? 's' : ''}`}
          </button>
        </div>

      </div>
    </div>
  );
};

export default GoalSelectionPage;
