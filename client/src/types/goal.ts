// client/src/types/goal.ts
import { Domain } from '../models/Domain';

export { Domain };

export interface GoalNode {
    id: string;
    title: string;
    description?: string;
    completionMetric?: string; // What does success look like?
    targetDate?: string;       // ISO date string deadline
    weight: number; // 0-100, importance percentage within parent
    progress: number; // 0-100, completion percentage
    status?: 'active' | 'suspended' | 'completed';
    parentId?: string;
    children: GoalNode[];
    domain?: Domain; // Only on top-level nodes for categorization
}

// Utility for generating unique IDs
export const generateUniqueId = (): string => {
    return `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Domain color mapping for styling
export const DOMAIN_COLORS: Record<string, string> = {
    [Domain.FITNESS]: '#EF4444',
    [Domain.MENTAL_HEALTH]: '#10B981',
    [Domain.CAREER]: '#F59E0B',
    [Domain.ACADEMICS]: '#3B82F6',
    [Domain.INVESTING]: '#3B82F6',
    [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#8B5CF6',
    [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#F97316',
    [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#06B6D4',
    [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#EC4899',
    [Domain.PERSONAL_GOALS]: '#9CA3AF',
    'defaultDomain': '#9CA3AF',
};

export const DOMAIN_ICONS: Record<string, string> = {
    [Domain.FITNESS]: '💪',
    [Domain.MENTAL_HEALTH]: '🧘',
    [Domain.CAREER]: '💼',
    [Domain.ACADEMICS]: '📚',
    [Domain.INVESTING]: '📈',
    [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '🎨',
    [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '❤️',
    [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '🤝',
    [Domain.PHILOSOPHICAL_DEVELOPMENT]: '🔮',
    [Domain.PERSONAL_GOALS]: '🎯',
};
