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
// client/src/pages/OnboardingPage.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom"); // assuming you're using react-router
require("../styles/OnboardingPage.css"); // or wherever you put styles
// Reuse existing models if needed later
// import { Domain } from '../models/Domain';
const domains = [
    'Career', 'Investing', 'Fitness', 'Relationships',
    'Health', 'Learning', 'Spirituality', 'Creativity', 'Contribution'
];
const OnboardingPage = () => {
    const [step, setStep] = (0, react_1.useState)(1);
    const [formData, setFormData] = (0, react_1.useState)({
        name: '',
        ageRange: '',
        gender: '',
        bio: '',
        selectedDomains: [],
        identityVerified: false,
    });
    const navigate = (0, react_router_dom_1.useNavigate)();
    const totalSteps = 5;
    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        }
        else {
            // Final step → simulate "verification complete" and redirect
            // In real app: call backend to create user + verify identity
            console.log('Onboarding complete:', formData);
            navigate('/home'); // or '/goals' / wherever protected route starts
        }
    };
    const handleBack = () => {
        if (step > 1)
            setStep(step - 1);
    };
    const updateForm = (field, value) => {
        setFormData(prev => (Object.assign(Object.assign({}, prev), { [field]: value })));
    };
    const toggleDomain = (domain) => {
        setFormData(prev => {
            const selected = prev.selectedDomains.includes(domain)
                ? prev.selectedDomains.filter(d => d !== domain)
                : [...prev.selectedDomains, domain];
            return Object.assign(Object.assign({}, prev), { selectedDomains: selected });
        });
    };
    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (<div className="onboarding-step welcome">
            <h1>Welcome to Praxis</h1>
            <p>Track goals across life domains. Get matched with people on similar paths. Grow together.</p>
            <div className="animation-placeholder"> {/* could add Lottie / CSS animation later */}
              <span role="img" aria-label="rocket">🚀</span>
            </div>
          </div>);
            case 2:
                return (<div className="onboarding-step profile">
            <h2>Tell us about yourself</h2>
            <input type="text" placeholder="Display Name" value={formData.name} onChange={e => updateForm('name', e.target.value)}/>
            <select value={formData.ageRange} onChange={e => updateForm('ageRange', e.target.value)}>
              <option value="">Age range</option>
              <option value="18-24">18–24</option>
              <option value="25-34">25–34</option>
              <option value="35-44">35–44</option>
              <option value="45+">45+</option>
            </select>
            <input type="text" placeholder="Short bio (optional)" value={formData.bio} onChange={e => updateForm('bio', e.target.value)}/>
          </div>);
            case 3:
                return (<div className="onboarding-step domains">
            <h2>Which areas matter most to you?</h2>
            <p>Select all that apply</p>
            <div className="domain-grid">
              {domains.map(domain => (<button key={domain} className={`domain-chip ${formData.selectedDomains.includes(domain) ? 'selected' : ''}`} onClick={() => toggleDomain(domain)}>
                  {domain}
                </button>))}
            </div>
          </div>);
            case 4:
                return (<div className="onboarding-step verification">
            <h2>Verify your identity</h2>
            <p>For real matching & trust — we use secure facial verification (placeholder).</p>
            <button className="verify-btn" disabled={formData.identityVerified}>
              {formData.identityVerified ? 'Verified ✓' : 'Start Face Scan'}
            </button>
            {/* In real impl: integrate camera + face-api.js or send to backend */}
            <small>This step is required to unlock matching and chat.</small>
          </div>);
            case 5:
                return (<div className="onboarding-step complete">
            <h1>You're all set!</h1>
            <p>Now let's build your first goal tree.</p>
            <div className="confetti-placeholder">🎉</div>
          </div>);
            default:
                return null;
        }
    };
    return (<div className="onboarding-page">
      <div className="progress-bar">
        <div className="progress" style={{ width: `${(step / totalSteps) * 100}%` }}/>
      </div>

      <div className="onboarding-content">
        {renderStepContent()}
      </div>

      <div className="onboarding-actions">
        {step > 1 && (<button className="secondary-btn" onClick={handleBack}>
            Back
          </button>)}
        <button className="primary-btn" onClick={handleNext} disabled={(step === 2 && !formData.name.trim()) ||
            (step === 3 && formData.selectedDomains.length === 0) ||
            (step === 4 && !formData.identityVerified)}>
          {step === totalSteps ? "Start Building Goals" : "Continue"}
        </button>
      </div>
    </div>);
};
exports.default = OnboardingPage;
