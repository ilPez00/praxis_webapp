import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/OnboardingPage.css';
import InitialGoalSetup from '../components/InitialGoalSetup'; // Import the new component
import { supabase } from '../lib/supabase'; // Assuming supabase is used for auth

const domains = [
    'Career', 'Investing', 'Fitness', 'Relationships',
    'Health', 'Learning', 'Spirituality', 'Creativity', 'Contribution'
];

const OnboardingPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        ageRange: '',
        gender: '',
        bio: '',
        selectedDomains: [] as string[],
        identityVerified: false,
    });
    const navigate = useNavigate();
    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined); // State to hold userId

    useEffect(() => {
        // Fetch current user ID - this would come from a real auth context
        const fetchUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
            } else {
                // For development/testing, if no user is logged in, use a placeholder
                setCurrentUserId('1'); 
            }
        };
        fetchUserId();
    }, []);

    const totalSteps = 5;

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            // For step 5, the InitialGoalSetup component handles the final action
            // so this button's functionality is overridden by that component
            // If the user somehow bypasses InitialGoalSetup, they'd go to home
            console.log('Onboarding complete (via fallback):', formData);
            navigate('/home'); 
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const updateForm = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleDomain = (domain: string) => {
        setFormData(prev => {
            const selected = prev.selectedDomains.includes(domain)
                ? prev.selectedDomains.filter(d => d !== domain)
                : [...prev.selectedDomains, domain];
            return { ...prev, selectedDomains: selected };
        });
    };

    const handleGoalsCreated = () => {
        console.log('Initial goals created successfully. Navigating to home.');
        navigate('/home'); // Or navigate to their goal tree page: `/goals/${currentUserId}`
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="onboarding-step welcome">
                        <h1>Welcome to Praxis</h1>
                        <p>Track goals across life domains. Get matched with people on similar paths. Grow together.</p>
                        <div className="animation-placeholder">
                            <span role="img" aria-label="rocket">🚀</span>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="onboarding-step profile">
                        <h2>Tell us about yourself</h2>
                        <input type="text" placeholder="Display Name" value={formData.name} onChange={e => updateForm('name', e.target.value)} />
                        <select value={formData.ageRange} onChange={e => updateForm('ageRange', e.target.value)}>
                            <option value="">Age range</option>
                            <option value="18-24">18–24</option>
                            <option value="25-34">25–34</option>
                            <option value="35-44">35–44</option>
                            <option value="45+">45+</option>
                        </select>
                        <input type="text" placeholder="Short bio (optional)" value={formData.bio} onChange={e => updateForm('bio', e.target.value)} />
                    </div>
                );
            case 3:
                return (
                    <div className="onboarding-step domains">
                        <h2>Which areas matter most to you?</h2>
                        <p>Select all that apply</p>
                        <div className="domain-grid">
                            {domains.map(domain => (
                                <button key={domain} className={`domain-chip ${formData.selectedDomains.includes(domain) ? 'selected' : ''}`} onClick={() => toggleDomain(domain)}>
                                    {domain}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="onboarding-step verification">
                        <h2>Verify your identity</h2>
                        <p>For real matching & trust — we use secure facial verification (placeholder).</p>
                        <button className="verify-btn" disabled={formData.identityVerified}>
                            {formData.identityVerified ? 'Verified ✓' : 'Start Face Scan'}
                        </button>
                        <small>This step is required to unlock matching and chat.</small>
                    </div>
                );
            case 5:
                if (!currentUserId) {
                    return <div>Loading user information...</div>;
                }
                return (
                    <div className="onboarding-step complete">
                        <InitialGoalSetup userId={currentUserId} onGoalsCreated={handleGoalsCreated} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="onboarding-page">
            <div className="progress-bar">
                <div className="progress" style={{ width: `${(step / totalSteps) * 100}%` }} />
            </div>

            <div className="onboarding-content">
                {renderStepContent()}
            </div>

            <div className="onboarding-actions">
                {step > 1 && step < totalSteps && ( // Don't show back button on first step or if it's the last step
                    <button className="secondary-btn" onClick={handleBack}>
                        Back
                    </button>
                )}
                {step < totalSteps && ( // Only show continue button for steps 1-4
                    <button className="primary-btn" onClick={handleNext} disabled={
                        (step === 2 && !formData.name.trim()) ||
                        (step === 3 && formData.selectedDomains.length === 0) ||
                        (step === 4 && !formData.identityVerified)
                    }>
                        Continue
                    </button>
                )}
                {/* For step 5, the InitialGoalSetup component has its own save button */}
            </div>
        </div>
    );
};

export default OnboardingPage;