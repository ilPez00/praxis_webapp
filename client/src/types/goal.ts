// client/src/types/goal.ts

export enum Domain {
    CAREER = 'Career',
    INVESTING = 'Investing',
    FITNESS = 'Fitness',
    ACADEMICS = 'Academics',
    MENTAL_HEALTH = 'Mental Health',
    PHILOSOPHICAL_DEVELOPMENT = 'Philosophical Development',
    CULTURE_HOBBIES_CREATIVE_PURSUITS = 'Culture, Hobbies & Creative Pursuits',
    INTIMACY_ROMANTIC_EXPLORATION = 'Intimacy & Romantic Exploration',
    FRIENDSHIP_SOCIAL_ENGAGEMENT = 'Friendship & Social Engagement',
}

export interface GoalNode {
    id: string;
    title: string;
    description?: string;
    weight: number; // 0-100, importance percentage within parent
    progress: number; // 0-100, completion percentage
    children: GoalNode[];
    domain?: Domain; // Only on top-level nodes for categorization
}

// Example Data for the Goal Tree
export const exampleGoalTreeData: GoalNode[] = [
    {
        id: 'domain-career',
        title: 'Career',
        description: 'Advancing your professional life.',
        weight: 100,
        progress: 70,
        domain: Domain.CAREER,
        children: [
            {
                id: 'career-promo',
                title: 'Get Promotion',
                description: 'Achieve promotion to Senior Engineer.',
                weight: 60,
                progress: 80,
                children: [
                    {
                        id: 'career-lead-project',
                        title: 'Lead a major project',
                        description: 'Successfully lead the Q3 platform migration project.',
                        weight: 70,
                        progress: 90,
                        children: [],
                    },
                    {
                        id: 'career-mentor-junior',
                        title: 'Mentor a junior developer',
                        description: 'Provide guidance and support to a new team member.',
                        weight: 30,
                        progress: 60,
                        children: [],
                    },
                ],
            },
            {
                id: 'career-skill',
                title: 'Learn new skill (AI/ML)',
                description: 'Complete online course in Machine Learning.',
                weight: 40,
                progress: 50,
                children: [],
            },
        ],
    },
    {
        id: 'domain-fitness',
        title: 'Fitness',
        description: 'Improving physical health and well-being.',
        weight: 100,
        progress: 60,
        domain: Domain.FITNESS,
        children: [
            {
                id: 'fitness-marathon',
                title: 'Run a marathon',
                description: 'Complete the city marathon in under 4 hours.',
                weight: 70,
                progress: 40,
                children: [],
            },
            {
                id: 'fitness-strength',
                title: 'Increase strength',
                description: 'Achieve personal bests in key lifts.',
                weight: 30,
                progress: 75,
                children: [],
            },
        ],
    },
    {
        id: 'domain-investing',
        title: 'Investing',
        description: 'Growing personal wealth.',
        weight: 100,
        progress: 85,
        domain: Domain.INVESTING,
        children: [
            {
                id: 'invest-portfolio',
                title: 'Diversify investment portfolio',
                description: 'Allocate investments across different asset classes.',
                weight: 50,
                progress: 95,
                children: [],
            },
            {
                id: 'invest-research',
                title: 'Research new investment opportunities',
                description: 'Investigate emerging markets and technologies.',
                weight: 50,
                progress: 70,
                children: [],
            },
        ],
    },
];

// Utility for generating unique IDs
export const generateUniqueId = (): string => {
    return `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Domain color mapping for styling
export const DOMAIN_COLORS: Record<string, string> = {
    [Domain.CAREER]: '#FF9F0A', // iOS Orange
    [Domain.INVESTING]: '#007AFF', // iOS Blue
    [Domain.FITNESS]: '#FF3B30', // iOS Red
    [Domain.ACADEMICS]: '#5856D6', // iOS Indigo
    [Domain.MENTAL_HEALTH]: '#34C759', // iOS Green
    [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#FF2D55', // iOS Pink
    [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#AF52DE', // iOS Purple
    [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#636366', // iOS Gray (Dark)
    [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#00C7BE', // iOS Teal
    'defaultDomain': '#CCCCCC', // Default grey for non-domain specific nodes
};
