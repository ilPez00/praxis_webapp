import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Domain, getDomainColor } from '../models/Domain';
import { GoalNode } from '../models/GoalNode';
// No separate CSS import needed - use shared styles/pages.css

interface GoalSelectionPageProps {
  userId: string;
}

// Goal templates based on whitepaper structure
const goalTemplates: Record<Domain, string[]> = {
  [Domain.CAREER]: ['Promotion', 'Skill Development', 'Networking', 'Job Search', 'Leadership'],
  [Domain.INVESTING]: ['Stock Portfolio', 'Real Estate', 'Retirement Planning', 'Passive Income', 'Financial Independence'],
  [Domain.FITNESS]: ['Strength Training', 'Cardio', 'Weight Loss', 'Muscle Gain', 'Flexibility', 'Sports Performance'],
  [Domain.ACADEMICS]: ['Degree Completion', 'Learning New Subject', 'Research', 'Certification', 'Language Learning'],
  [Domain.MENTAL_HEALTH]: ['Therapy', 'Meditation', 'Stress Management', 'Sleep Quality', 'Mindfulness Practice'],
  [Domain.PHILOSOPHY]: ['Reading Philosophy', 'Critical Thinking', 'Meaning & Purpose', 'Ethical Living', 'Self-Reflection'],
  [Domain.CULTURE_HOBBIES]: ['Art Creation', 'Music', 'Writing', 'Photography', 'Crafts', 'Gaming'],
    [Domain.INTIMACY_ROMANCE]:  ['Dating', 'Relationship Building', 'Communication Skills', 'Intimacy Development'],
    [Domain.FRIENDSHIP_SOCIAL]: ['Making New Friends', 'Deepening Friendships', 'Social Skills', 'Community Involvement'],
    [Domain.HEALTH]:            ['Exercise Regularly', 'Eat Healthy', 'Improve Sleep', 'Manage Stress'],
    [Domain.WEALTH]:            ['Save Money', 'Invest', 'Reduce Debt', 'Increase Income'],
    [Domain.WISDOM]:            ['Read Books', 'Learn New Skills', 'Practice Mindfulness', 'Seek Knowledge'],
    [Domain.RELATIONSHIPS]:     ['Spend Time with Family', 'Connect with Friends', 'Build Stronger Bonds', 'Resolve Conflicts'],
    [Domain.HAPPINESS]:         ['Practice Gratitude', 'Engage in Hobbies', 'Volunteer', 'Travel'],
  };

const GoalSelectionPage: React.FC<GoalSelectionPageProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [selectedGoals, setSelectedGoals] = useState<Partial<GoalNode>[]>([]);
  const [currentStep, setCurrentStep] = useState<'select' | 'customize'>('select');
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);

  const maxFreeGoals = 3;
  const canAddMore = selectedGoals.length < maxFreeGoals;

  const handleDomainClick = (domain: Domain) => {
    setExpandedDomain(expandedDomain === domain ? null : domain);
  };

  const handleGoalSelect = (domain: Domain, category: string) => {
    if (!canAddMore) {
      alert(`Free tier allows up to ${maxFreeGoals} goals. Upgrade for more!`);
      return;
    }

    const newGoal: Partial<GoalNode> = {
      id: `goal-${Date.now()}-${Math.random()}`,
      domain,
      name: category,
      category,
      weight: 1.0,
      progress: 0,
      subGoals: [],
    };

    setSelectedGoals([...selectedGoals, newGoal]);
    setExpandedDomain(null);
  };

  const handleRemoveGoal = (goalId: string) => {
    setSelectedGoals(selectedGoals.filter(g => g.id !== goalId));
  };

  const handleCustomize = (goalId: string, field: string, value: any) => {
    setSelectedGoals(selectedGoals.map(g => 
      g.id === goalId ? { ...g, [field]: value } : g
    ));
  };

  const handleSubmit = async () => {
    if (selectedGoals.length === 0) {
      alert('Please select at least one goal');
      return;
    }

    // Ensure all goals have required fields
    const completeGoals = selectedGoals.map(g => ({
      ...g,
      specificGoal: g.specificGoal || g.name,
      customDetails: g.customDetails || '',
    })) as GoalNode[];

    try {
      await axios.post(`http://localhost:3001/users/${userId}/goals`, {
        goals: completeGoals
      });
      navigate('/home');
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Failed to save goals. Please try again.');
    }
  };

  return (
    <div className="goal-selection-page">
      <div className="container">
        {/* Header */}
        <div className="page-header fade-in">
          <h1>Build Your Goal Tree 🎯</h1>
          <p className="page-subtitle">
            Select up to {maxFreeGoals} primary goals to define your path and get matched with aligned people.
          </p>
          <div className="goals-counter">
            <span className="counter-value">{selectedGoals.length}</span>
            <span className="counter-max">/ {maxFreeGoals}</span>
          </div>
        </div>

        {/* Selected Goals Summary */}
        {selectedGoals.length > 0 && (
          <div className="selected-goals fade-in" style={{ animationDelay: '0.1s' }}>
            <h2>Your Selected Goals</h2>
            <div className="selected-goals-list">
              {selectedGoals.map((goal) => (
                <div 
                  key={goal.id}
                  className="selected-goal-card"
                  style={{ borderLeftColor: getDomainColor(goal.domain!) }}
                >
                  <div className="goal-content">
                    <div className="goal-top">
                      <span 
                        className="goal-domain-badge"
                        style={{ 
                          background: getDomainColor(goal.domain!) + '20',
                          color: getDomainColor(goal.domain!)
                        }}
                      >
                        {goal.domain}
                      </span>
                      <button 
                        onClick={() => handleRemoveGoal(goal.id!)}
                        className="remove-btn"
                        aria-label="Remove goal"
                      >
                        ×
                      </button>
                    </div>
                    <h3>{goal.category}</h3>
                    
                    {currentStep === 'customize' && (
                      <div className="goal-customize">
                        <input
                          type="text"
                          placeholder="Specific goal (e.g., Add 10kg to squat)"
                          value={goal.specificGoal || ''}
                          onChange={(e) => handleCustomize(goal.id!, 'specificGoal', e.target.value)}
                          className="goal-input"
                        />
                        <textarea
                          placeholder="Additional details (optional)"
                          value={goal.customDetails || ''}
                          onChange={(e) => handleCustomize(goal.id!, 'customDetails', e.target.value)}
                          className="goal-textarea"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Domain Selection */}
        {currentStep === 'select' && (
          <div className="domain-selection fade-in" style={{ animationDelay: '0.2s' }}>
            <h2>Select Goals by Domain</h2>
            <div className="domains-list">
              {Object.values(Domain).map((domain) => (
                <div key={domain} className="domain-item">
                  <button
                    className={`domain-button ${expandedDomain === domain ? 'expanded' : ''}`}
                    onClick={() => handleDomainClick(domain)}
                    disabled={!canAddMore && expandedDomain !== domain}
                  >
                    <div 
                      className="domain-indicator"
                      style={{ background: getDomainColor(domain) }}
                    />
                    <span className="domain-name">{domain}</span>
                    <span className="expand-icon">
                      {expandedDomain === domain ? '−' : '+'}
                    </span>
                  </button>

                  {expandedDomain === domain && (
                    <div className="goal-categories">
                      {goalTemplates[domain].map((category) => (
                        <button
                          key={category}
                          onClick={() => handleGoalSelect(domain, category)}
                          className="category-button"
                          style={{ 
                            borderColor: getDomainColor(domain),
                            '--hover-color': getDomainColor(domain)
                          } as React.CSSProperties}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="page-actions fade-in" style={{ animationDelay: '0.3s' }}>
          {currentStep === 'select' && selectedGoals.length > 0 && (
            <button 
              onClick={() => setCurrentStep('customize')}
              className="btn btn-primary"
            >
              Customize Goals →
            </button>
          )}

          {currentStep === 'customize' && (
            <>
              <button 
                onClick={() => setCurrentStep('select')}
                className="btn btn-secondary"
              >
                ← Back to Selection
              </button>
              <button 
                onClick={handleSubmit}
                className="btn btn-primary"
              >
                Complete Goal Tree ✓
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalSelectionPage;
const _check: Record<Domain, string[]> = goalTemplates; //check for errors between goal selection and goaltemplates
