/**
 * @enum MaslowDomain
 * @description Represents the 14 goal domains based on Maslow's Hierarchy of Needs.
 * These domains are organized into 5 levels corresponding to the hierarchy:
 * - Level 1: Physiological Needs (Survival)
 * - Level 2: Safety Needs (Security & Stability)
 * - Level 3: Love/Belonging (Social Connection)
 * - Level 4: Esteem Needs (Achievement & Recognition)
 * - Level 5: Self-Transcendence (Beyond Self)
 */
export enum MaslowDomain {
  // Level 1: Physiological Needs (Survival)
  /** Physical fitness, strength, athletics, and exercise. */
  BODY_FITNESS = 'Body & Fitness',
  
  /** Sleep optimization, rest days, stress management, and relaxation. */
  REST_RECOVERY = 'Rest & Recovery',
  
  /** Emotional regulation, psychological resilience, and mental wellness. */
  MENTAL_BALANCE = 'Mental Balance',
  
  // Level 2: Safety Needs (Security & Stability)
  /** Living space, organization, cleanliness, and home improvement. */
  ENVIRONMENT_HOME = 'Environment & Home',
  
  /** Medical checkups, preventive care, nutrition, and health metrics. */
  HEALTH_LONGEVITY = 'Health & Longevity',
  
  /** Budget management, emergency fund, debt reduction, and financial stability. */
  FINANCIAL_SECURITY = 'Financial Security',
  
  // Level 3: Love/Belonging Needs (Social Connection)
  /** Platonic relationships, social circles, networking, and social events. */
  FRIENDSHIP_SOCIAL = 'Friendship & Social',
  
  /** Romantic relationships, dating, and physical/emotional intimacy. */
  ROMANCE_INTIMACY = 'Romance & Intimacy',
  
  /** Volunteering, community service, and religious/spiritual community. */
  COMMUNITY_CONTRIBUTION = 'Community & Contribution',
  
  // Level 4: Esteem Needs (Achievement & Recognition)
  /** Professional advancement, skill mastery, and entrepreneurship. */
  CAREER_CRAFT = 'Career & Craft',
  
  /** Investment growth, wealth building, and passive income. */
  WEALTH_ASSETS = 'Wealth & Assets',
  
  /** Video game achievements, esports, streaming, and gaming skill progression. */
  GAMING_ESPORTS = 'Gaming & Esports',
  
  // Level 5: Self-Transcendence (Beyond Self)
  /** Making a difference, mentoring, teaching, and leaving a legacy. */
  IMPACT_LEGACY = 'Impact & Legacy',
  
  /** Life meaning, existential exploration, and philosophical development. */
  SPIRIT_PURPOSE = 'Spirit & Purpose',
}

/**
 * Represents the 5 levels of Maslow's Hierarchy
 */
export enum MaslowLevel {
  LEVEL_1_PHYSIOLOGICAL = 1,
  LEVEL_2_SAFETY = 2,
  LEVEL_3_LOVE_BELONGING = 3,
  LEVEL_4_ESTEEM = 4,
  LEVEL_5_SELF_TRANSCENDENCE = 5,
}

/**
 * Maps each domain to its Maslow level
 */
export const DOMAIN_TO_MASLOW_LEVEL: Record<MaslowDomain, MaslowLevel> = {
  // Level 1
  [MaslowDomain.BODY_FITNESS]: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
  [MaslowDomain.REST_RECOVERY]: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
  [MaslowDomain.MENTAL_BALANCE]: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
  
  // Level 2
  [MaslowDomain.ENVIRONMENT_HOME]: MaslowLevel.LEVEL_2_SAFETY,
  [MaslowDomain.HEALTH_LONGEVITY]: MaslowLevel.LEVEL_2_SAFETY,
  [MaslowDomain.FINANCIAL_SECURITY]: MaslowLevel.LEVEL_2_SAFETY,
  
  // Level 3
  [MaslowDomain.FRIENDSHIP_SOCIAL]: MaslowLevel.LEVEL_3_LOVE_BELONGING,
  [MaslowDomain.ROMANCE_INTIMACY]: MaslowLevel.LEVEL_3_LOVE_BELONGING,
  [MaslowDomain.COMMUNITY_CONTRIBUTION]: MaslowLevel.LEVEL_3_LOVE_BELONGING,
  
  // Level 4
  [MaslowDomain.CAREER_CRAFT]: MaslowLevel.LEVEL_4_ESTEEM,
  [MaslowDomain.WEALTH_ASSETS]: MaslowLevel.LEVEL_4_ESTEEM,
  [MaslowDomain.GAMING_ESPORTS]: MaslowLevel.LEVEL_4_ESTEEM,
  
  // Level 5
  [MaslowDomain.IMPACT_LEGACY]: MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE,
  [MaslowDomain.SPIRIT_PURPOSE]: MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE,
};

/**
 * Color scheme organized by Maslow level
 * Level 1: Red/Orange (Survival, urgency)
 * Level 2: Blue/Green (Stability, security)
 * Level 3: Pink/Purple (Connection, warmth)
 * Level 4: Gold/Yellow (Achievement, prestige)
 * Level 5: Purple/White (Transcendence, spirituality)
 */
export const DOMAIN_COLORS: Record<MaslowDomain, string> = {
  // Level 1: Physiological
  [MaslowDomain.BODY_FITNESS]: '#EF4444',
  [MaslowDomain.REST_RECOVERY]: '#F97316',
  [MaslowDomain.MENTAL_BALANCE]: '#FB923C',
  
  // Level 2: Safety
  [MaslowDomain.ENVIRONMENT_HOME]: '#10B981',
  [MaslowDomain.HEALTH_LONGEVITY]: '#3B82F6',
  [MaslowDomain.FINANCIAL_SECURITY]: '#6366F1',
  
  // Level 3: Love/Belonging
  [MaslowDomain.FRIENDSHIP_SOCIAL]: '#EC4899',
  [MaslowDomain.ROMANCE_INTIMACY]: '#F472B6',
  [MaslowDomain.COMMUNITY_CONTRIBUTION]: '#A78BFA',
  
  // Level 4: Esteem
  [MaslowDomain.CAREER_CRAFT]: '#F59E0B',
  [MaslowDomain.WEALTH_ASSETS]: '#FBBF24',
  [MaslowDomain.GAMING_ESPORTS]: '#8B5CF6',
  
  // Level 5: Self-Transcendence
  [MaslowDomain.IMPACT_LEGACY]: '#8B5CF6',
  [MaslowDomain.SPIRIT_PURPOSE]: '#C4B5FD',
};

/**
 * Icon mapping for each domain
 */
export const DOMAIN_ICONS: Record<MaslowDomain, string> = {
  // Level 1
  [MaslowDomain.BODY_FITNESS]: '💪',
  [MaslowDomain.REST_RECOVERY]: '😴',
  [MaslowDomain.MENTAL_BALANCE]: '🧠',
  
  // Level 2
  [MaslowDomain.ENVIRONMENT_HOME]: '🏠',
  [MaslowDomain.HEALTH_LONGEVITY]: '🛡️',
  [MaslowDomain.FINANCIAL_SECURITY]: '💰',
  
  // Level 3
  [MaslowDomain.FRIENDSHIP_SOCIAL]: '👥',
  [MaslowDomain.ROMANCE_INTIMACY]: '❤️',
  [MaslowDomain.COMMUNITY_CONTRIBUTION]: '🏛️',
  
  // Level 4
  [MaslowDomain.CAREER_CRAFT]: '💼',
  [MaslowDomain.WEALTH_ASSETS]: '📈',
  [MaslowDomain.GAMING_ESPORTS]: '🎮',
  
  // Level 5
  [MaslowDomain.IMPACT_LEGACY]: '🎯',
  [MaslowDomain.SPIRIT_PURPOSE]: '🌟',
};

/**
 * Level names and descriptions for UI display
 */
export const MASLOW_LEVEL_INFO: Record<MaslowLevel, { name: string; description: string; color: string }> = {
  [MaslowLevel.LEVEL_1_PHYSIOLOGICAL]: {
    name: 'Physiological Needs',
    description: 'Basic survival needs: body, rest, and mental balance',
    color: '#EF4444',
  },
  [MaslowLevel.LEVEL_2_SAFETY]: {
    name: 'Safety Needs',
    description: 'Security and stability: home, health, and finances',
    color: '#3B82F6',
  },
  [MaslowLevel.LEVEL_3_LOVE_BELONGING]: {
    name: 'Love & Belonging',
    description: 'Social connection: friends, romance, and community',
    color: '#EC4899',
  },
  [MaslowLevel.LEVEL_4_ESTEEM]: {
    name: 'Esteem Needs',
    description: 'Achievement and recognition: career, wealth, and mastery',
    color: '#F59E0B',
  },
  [MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE]: {
    name: 'Self-Transcendence',
    description: 'Beyond self: impact, legacy, and purpose',
    color: '#8B5CF6',
  },
};
