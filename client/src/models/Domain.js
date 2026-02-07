"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDomainColor = exports.Domain = void 0;
var Domain;
(function (Domain) {
    // the ones you have
    Domain["CAREER"] = "Career";
    Domain["INVESTING"] = "Investing";
    Domain["FITNESS"] = "Fitness";
    Domain["ACADEMICS"] = "Academics";
    Domain["MENTAL_HEALTH"] = "Mental Health";
    Domain["PHILOSOPHY"] = "Philosophy";
    Domain["CULTURE_HOBBIES"] = "Culture & Hobbies";
    Domain["INTIMACY_ROMANCE"] = "Intimacy & Romance";
    Domain["FRIENDSHIP_SOCIAL"] = "Friendship & Social";
    // the missing ones (must exist in your enum)
    Domain["HEALTH"] = "Health";
    Domain["WEALTH"] = "Wealth";
    Domain["WISDOM"] = "Wisdom";
    Domain["RELATIONSHIPS"] = "Relationships";
    Domain["HAPPINESS"] = "Happiness";
    // possibly more...
})(Domain || (exports.Domain = Domain = {}));
const goalTemplates = {
    [Domain.CAREER]: ['Promotion', 'Skill Development', 'Networking', 'Job Search', 'Leadership'],
    [Domain.INVESTING]: ['Stock Portfolio', 'Real Estate', 'Retirement Planning', 'Passive Income', 'Financial Independence'],
    [Domain.FITNESS]: ['Strength Training', 'Cardio', 'Weight Loss', 'Muscle Gain', 'Flexibility', 'Sports Performance'],
    [Domain.ACADEMICS]: ['Degree Completion', 'Learning New Subject', 'Research', 'Certification', 'Language Learning'],
    [Domain.MENTAL_HEALTH]: ['Therapy', 'Meditation', 'Stress Management', 'Sleep Quality', 'Mindfulness Practice'],
    [Domain.PHILOSOPHY]: ['Reading Philosophy', 'Critical Thinking', 'Meaning & Purpose', 'Ethical Living', 'Self-Reflection'],
    [Domain.CULTURE_HOBBIES]: ['Art Creation', 'Music', 'Writing', 'Photography', 'Crafts', 'Gaming'],
    [Domain.INTIMACY_ROMANCE]: ['Dating', 'Relationship Building', 'Communication Skills', 'Intimacy Development'],
    [Domain.FRIENDSHIP_SOCIAL]: ['Making New Friends', 'Deepening Friendships', 'Social Skills', 'Community Involvement'],
    // ── add these (adjust names/content as you like) ──
    [Domain.HEALTH]: ['General Health', 'Nutrition', 'Preventive Care', 'Medical Checkups'],
    [Domain.WEALTH]: ['Budgeting', 'Debt Reduction', 'Saving', 'Building Emergency Fund'],
    [Domain.WISDOM]: ['Lifelong Learning', 'Decision Making', 'Emotional Intelligence'],
    [Domain.RELATIONSHIPS]: ['Family Bonding', 'Partner Communication', 'Conflict Resolution'],
    [Domain.HAPPINESS]: ['Gratitude Practice', 'Positive Habits', 'Work-Life Balance', 'Joyful Activities'],
};
// A utility function to get a color for a domain, useful for UI styling
const getDomainColor = (domain) => {
    const colorMap = {
        [Domain.CAREER]: '#ff6347', // Tomato
        [Domain.INVESTING]: '#4682b4', // SteelBlue
        [Domain.FITNESS]: '#32cd32', // LimeGreen
        [Domain.ACADEMICS]: '#ffd700', // Gold
        [Domain.MENTAL_HEALTH]: '#9370db', // MediumPurple
        [Domain.PHILOSOPHY]: '#8b4513', // SaddleBrown
        [Domain.CULTURE_HOBBIES]: '#ff4500', // OrangeRed
        [Domain.INTIMACY_ROMANCE]: '#ff69b4', // HotPink
        [Domain.FRIENDSHIP_SOCIAL]: '#1e90ff', // DodgerBlue
        // Default colors for original domains
        [Domain.HEALTH]: '#32cd32',
        [Domain.WEALTH]: '#4682b4',
        [Domain.WISDOM]: '#ffd700',
        [Domain.RELATIONSHIPS]: '#ff69b4',
        [Domain.HAPPINESS]: '#ff4500',
    };
    return colorMap[domain] || '#cccccc'; // Return a default color if not found
};
exports.getDomainColor = getDomainColor;
