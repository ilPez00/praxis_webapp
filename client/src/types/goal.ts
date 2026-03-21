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

// Domain color mapping for styling (Maslow Levels)
export const DOMAIN_COLORS: Record<string, string> = {
    // Level 1: Physiological
    [Domain.BODY_FITNESS]: '#EF4444',
    [Domain.REST_RECOVERY]: '#3B82F6',
    [Domain.MENTAL_BALANCE]: '#10B981',
    
    // Level 2: Safety
    [Domain.ENVIRONMENT_HOME]: '#F59E0B',
    [Domain.HEALTH_LONGEVITY]: '#10B981',
    [Domain.FINANCIAL_SECURITY]: '#3B82F6',
    
    // Level 3: Love/Belonging
    [Domain.FRIENDSHIP_SOCIAL]: '#06B6D4',
    [Domain.ROMANCE_INTIMACY]: '#F97316',
    [Domain.COMMUNITY_CONTRIBUTION]: '#8B5CF6',
    
    // Level 4: Esteem
    [Domain.CAREER_CRAFT]: '#F59E0B',
    [Domain.WEALTH_ASSETS]: '#3B82F6',
    [Domain.GAMING_ESPORTS]: '#8B5CF6',
    
    // Level 5: Self-Transcendence
    [Domain.IMPACT_LEGACY]: '#F43F5E',
    [Domain.SPIRIT_PURPOSE]: '#EC4899',
    
    'defaultDomain': '#9CA3AF',
};

export const DOMAIN_ICONS: Record<string, string> = {
    [Domain.BODY_FITNESS]: '💪',
    [Domain.REST_RECOVERY]: '🛌',
    [Domain.MENTAL_BALANCE]: '🧘',
    [Domain.ENVIRONMENT_HOME]: '🏠',
    [Domain.HEALTH_LONGEVITY]: '🥗',
    [Domain.FINANCIAL_SECURITY]: '🛡️',
    [Domain.FRIENDSHIP_SOCIAL]: '🤝',
    [Domain.ROMANCE_INTIMACY]: '❤️',
    [Domain.COMMUNITY_CONTRIBUTION]: '🏛️',
    [Domain.CAREER_CRAFT]: '💼',
    [Domain.WEALTH_ASSETS]: '📈',
    [Domain.GAMING_ESPORTS]: '🎮',
    [Domain.IMPACT_LEGACY]: '🌟',
    [Domain.SPIRIT_PURPOSE]: '🔮',
};
