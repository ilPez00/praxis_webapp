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
const react_router_dom_1 = require("react-router-dom");
const axios_1 = __importDefault(require("axios"));
const Domain_1 = require("../models/Domain");
// Goal templates based on whitepaper structure
const goalTemplates = {
    [Domain_1.Domain.CAREER]: ['Promotion', 'Skill Development', 'Networking', 'Job Search', 'Leadership'],
    [Domain_1.Domain.INVESTING]: ['Stock Portfolio', 'Real Estate', 'Retirement Planning', 'Passive Income', 'Financial Independence'],
    [Domain_1.Domain.FITNESS]: ['Strength Training', 'Cardio', 'Weight Loss', 'Muscle Gain', 'Flexibility', 'Sports Performance'],
    [Domain_1.Domain.ACADEMICS]: ['Degree Completion', 'Learning New Subject', 'Research', 'Certification', 'Language Learning'],
    [Domain_1.Domain.MENTAL_HEALTH]: ['Therapy', 'Meditation', 'Stress Management', 'Sleep Quality', 'Mindfulness Practice'],
    [Domain_1.Domain.PHILOSOPHY]: ['Reading Philosophy', 'Critical Thinking', 'Meaning & Purpose', 'Ethical Living', 'Self-Reflection'],
    [Domain_1.Domain.CULTURE_HOBBIES]: ['Art Creation', 'Music', 'Writing', 'Photography', 'Crafts', 'Gaming'],
    [Domain_1.Domain.INTIMACY_ROMANCE]: ['Dating', 'Relationship Building', 'Communication Skills', 'Intimacy Development'],
    [Domain_1.Domain.FRIENDSHIP_SOCIAL]: ['Making New Friends', 'Deepening Friendships', 'Social Skills', 'Community Involvement'],
};
const GoalSelectionPage = ({ userId }) => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [selectedGoals, setSelectedGoals] = (0, react_1.useState)([]);
    const [currentStep, setCurrentStep] = (0, react_1.useState)('select');
    const [expandedDomain, setExpandedDomain] = (0, react_1.useState)(null);
    const maxFreeGoals = 3;
    const canAddMore = selectedGoals.length < maxFreeGoals;
    const handleDomainClick = (domain) => {
        setExpandedDomain(expandedDomain === domain ? null : domain);
    };
    const handleGoalSelect = (domain, category) => {
        if (!canAddMore) {
            alert(`Free tier allows up to ${maxFreeGoals} goals. Upgrade for more!`);
            return;
        }
        const newGoal = {
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
    const handleRemoveGoal = (goalId) => {
        setSelectedGoals(selectedGoals.filter(g => g.id !== goalId));
    };
    const handleCustomize = (goalId, field, value) => {
        setSelectedGoals(selectedGoals.map(g => g.id === goalId ? Object.assign(Object.assign({}, g), { [field]: value }) : g));
    };
    const handleSubmit = () => __awaiter(void 0, void 0, void 0, function* () {
        if (selectedGoals.length === 0) {
            alert('Please select at least one goal');
            return;
        }
        // Ensure all goals have required fields
        const completeGoals = selectedGoals.map(g => (Object.assign(Object.assign({}, g), { specificGoal: g.specificGoal || g.name, customDetails: g.customDetails || '' })));
        try {
            yield axios_1.default.post(`http://localhost:3001/users/${userId}/goals`, {
                goals: completeGoals
            });
            navigate('/home');
        }
        catch (error) {
            console.error('Error saving goals:', error);
            alert('Failed to save goals. Please try again.');
        }
    });
    return (<div className="goal-selection-page">
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
        {selectedGoals.length > 0 && (<div className="selected-goals fade-in" style={{ animationDelay: '0.1s' }}>
            <h2>Your Selected Goals</h2>
            <div className="selected-goals-list">
              {selectedGoals.map((goal) => (<div key={goal.id} className="selected-goal-card" style={{ borderLeftColor: (0, Domain_1.getDomainColor)(goal.domain) }}>
                  <div className="goal-content">
                    <div className="goal-top">
                      <span className="goal-domain-badge" style={{
                    background: (0, Domain_1.getDomainColor)(goal.domain) + '20',
                    color: (0, Domain_1.getDomainColor)(goal.domain)
                }}>
                        {goal.domain}
                      </span>
                      <button onClick={() => handleRemoveGoal(goal.id)} className="remove-btn" aria-label="Remove goal">
                        ×
                      </button>
                    </div>
                    <h3>{goal.category}</h3>
                    
                    {currentStep === 'customize' && (<div className="goal-customize">
                        <input type="text" placeholder="Specific goal (e.g., Add 10kg to squat)" value={goal.specificGoal || ''} onChange={(e) => handleCustomize(goal.id, 'specificGoal', e.target.value)} className="goal-input"/>
                        <textarea placeholder="Additional details (optional)" value={goal.customDetails || ''} onChange={(e) => handleCustomize(goal.id, 'customDetails', e.target.value)} className="goal-textarea" rows={2}/>
                      </div>)}
                  </div>
                </div>))}
            </div>
          </div>)}

        {/* Domain Selection */}
        {currentStep === 'select' && (<div className="domain-selection fade-in" style={{ animationDelay: '0.2s' }}>
            <h2>Select Goals by Domain</h2>
            <div className="domains-list">
              {Object.values(Domain_1.Domain).map((domain) => (<div key={domain} className="domain-item">
                  <button className={`domain-button ${expandedDomain === domain ? 'expanded' : ''}`} onClick={() => handleDomainClick(domain)} disabled={!canAddMore && expandedDomain !== domain}>
                    <div className="domain-indicator" style={{ background: (0, Domain_1.getDomainColor)(domain) }}/>
                    <span className="domain-name">{domain}</span>
                    <span className="expand-icon">
                      {expandedDomain === domain ? '−' : '+'}
                    </span>
                  </button>

                  {expandedDomain === domain && (<div className="goal-categories">
                      {goalTemplates[domain].map((category) => (<button key={category} onClick={() => handleGoalSelect(domain, category)} className="category-button" style={{
                            borderColor: (0, Domain_1.getDomainColor)(domain),
                            '--hover-color': (0, Domain_1.getDomainColor)(domain)
                        }}>
                          {category}
                        </button>))}
                    </div>)}
                </div>))}
            </div>
          </div>)}

        {/* Action Buttons */}
        <div className="page-actions fade-in" style={{ animationDelay: '0.3s' }}>
          {currentStep === 'select' && selectedGoals.length > 0 && (<button onClick={() => setCurrentStep('customize')} className="btn btn-primary">
              Customize Goals →
            </button>)}

          {currentStep === 'customize' && (<>
              <button onClick={() => setCurrentStep('select')} className="btn btn-secondary">
                ← Back to Selection
              </button>
              <button onClick={handleSubmit} className="btn btn-primary">
                Complete Goal Tree ✓
              </button>
            </>)}
        </div>
      </div>
    </div>);
};
exports.default = GoalSelectionPage;
const _check = goalTemplates; //check for errors between goal selection and goaltemplates
