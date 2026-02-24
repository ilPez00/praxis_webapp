// client/src/types/goal.ts
import { Domain } from '../models/Domain';

export { Domain };

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
    [Domain.CAREER]: '#F59E0B',
    [Domain.INVESTING]: '#3B82F6',
    [Domain.FITNESS]: '#EF4444',
    [Domain.ACADEMICS]: '#8B5CF6',
    [Domain.MENTAL_HEALTH]: '#10B981',
    [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#EC4899',
    [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#A855F7',
    [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#F97316',
    [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#06B6D4',
    'defaultDomain': '#9CA3AF',
};

export const DOMAIN_ICONS: Record<string, string> = {
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
