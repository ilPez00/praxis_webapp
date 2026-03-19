import { MaslowDomain, MaslowLevel, DOMAIN_COLORS, DOMAIN_ICONS, DOMAIN_TO_MASLOW_LEVEL } from './MaslowDomain';

export interface DomainConfig {
  value: MaslowDomain;
  label: string;
  color: string;
  icon: string;
  level: MaslowLevel;
  levelName: string;
}

export const PRAXIS_DOMAINS: DomainConfig[] = [
  // Level 1: Physiological Needs
  { 
    value: MaslowDomain.BODY_FITNESS, 
    label: '💪 Body & Fitness', 
    color: DOMAIN_COLORS[MaslowDomain.BODY_FITNESS], 
    icon: DOMAIN_ICONS[MaslowDomain.BODY_FITNESS],
    level: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
    levelName: 'Physiological',
  },
  { 
    value: MaslowDomain.REST_RECOVERY, 
    label: '😴 Rest & Recovery', 
    color: DOMAIN_COLORS[MaslowDomain.REST_RECOVERY], 
    icon: DOMAIN_ICONS[MaslowDomain.REST_RECOVERY],
    level: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
    levelName: 'Physiological',
  },
  { 
    value: MaslowDomain.MENTAL_BALANCE, 
    label: '🧠 Mental Balance', 
    color: DOMAIN_COLORS[MaslowDomain.MENTAL_BALANCE], 
    icon: DOMAIN_ICONS[MaslowDomain.MENTAL_BALANCE],
    level: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
    levelName: 'Physiological',
  },
  
  // Level 2: Safety Needs
  { 
    value: MaslowDomain.ENVIRONMENT_HOME, 
    label: '🏠 Environment & Home', 
    color: DOMAIN_COLORS[MaslowDomain.ENVIRONMENT_HOME], 
    icon: DOMAIN_ICONS[MaslowDomain.ENVIRONMENT_HOME],
    level: MaslowLevel.LEVEL_2_SAFETY,
    levelName: 'Safety',
  },
  { 
    value: MaslowDomain.HEALTH_LONGEVITY, 
    label: '🛡️ Health & Longevity', 
    color: DOMAIN_COLORS[MaslowDomain.HEALTH_LONGEVITY], 
    icon: DOMAIN_ICONS[MaslowDomain.HEALTH_LONGEVITY],
    level: MaslowLevel.LEVEL_2_SAFETY,
    levelName: 'Safety',
  },
  { 
    value: MaslowDomain.FINANCIAL_SECURITY, 
    label: '💰 Financial Security', 
    color: DOMAIN_COLORS[MaslowDomain.FINANCIAL_SECURITY], 
    icon: DOMAIN_ICONS[MaslowDomain.FINANCIAL_SECURITY],
    level: MaslowLevel.LEVEL_2_SAFETY,
    levelName: 'Safety',
  },
  
  // Level 3: Love/Belonging
  { 
    value: MaslowDomain.FRIENDSHIP_SOCIAL, 
    label: '👥 Friendship & Social', 
    color: DOMAIN_COLORS[MaslowDomain.FRIENDSHIP_SOCIAL], 
    icon: DOMAIN_ICONS[MaslowDomain.FRIENDSHIP_SOCIAL],
    level: MaslowLevel.LEVEL_3_LOVE_BELONGING,
    levelName: 'Love & Belonging',
  },
  { 
    value: MaslowDomain.ROMANCE_INTIMACY, 
    label: '❤️ Romance & Intimacy', 
    color: DOMAIN_COLORS[MaslowDomain.ROMANCE_INTIMACY], 
    icon: DOMAIN_ICONS[MaslowDomain.ROMANCE_INTIMACY],
    level: MaslowLevel.LEVEL_3_LOVE_BELONGING,
    levelName: 'Love & Belonging',
  },
  { 
    value: MaslowDomain.COMMUNITY_CONTRIBUTION, 
    label: '🏛️ Community & Contribution', 
    color: DOMAIN_COLORS[MaslowDomain.COMMUNITY_CONTRIBUTION], 
    icon: DOMAIN_ICONS[MaslowDomain.COMMUNITY_CONTRIBUTION],
    level: MaslowLevel.LEVEL_3_LOVE_BELONGING,
    levelName: 'Love & Belonging',
  },
  
  // Level 4: Esteem
  { 
    value: MaslowDomain.CAREER_CRAFT, 
    label: '💼 Career & Craft', 
    color: DOMAIN_COLORS[MaslowDomain.CAREER_CRAFT], 
    icon: DOMAIN_ICONS[MaslowDomain.CAREER_CRAFT],
    level: MaslowLevel.LEVEL_4_ESTEEM,
    levelName: 'Esteem',
  },
  { 
    value: MaslowDomain.WEALTH_ASSETS, 
    label: '📈 Wealth & Assets', 
    color: DOMAIN_COLORS[MaslowDomain.WEALTH_ASSETS], 
    icon: DOMAIN_ICONS[MaslowDomain.WEALTH_ASSETS],
    level: MaslowLevel.LEVEL_4_ESTEEM,
    levelName: 'Esteem',
  },
  { 
    value: MaslowDomain.GAMING_ESPORTS, 
    label: '🎮 Gaming & Esports', 
    color: DOMAIN_COLORS[MaslowDomain.GAMING_ESPORTS], 
    icon: DOMAIN_ICONS[MaslowDomain.GAMING_ESPORTS],
    level: MaslowLevel.LEVEL_4_ESTEEM,
    levelName: 'Esteem',
  },
  
  // Level 5: Self-Transcendence
  { 
    value: MaslowDomain.IMPACT_LEGACY, 
    label: '🎯 Impact & Legacy', 
    color: DOMAIN_COLORS[MaslowDomain.IMPACT_LEGACY], 
    icon: DOMAIN_ICONS[MaslowDomain.IMPACT_LEGACY],
    level: MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE,
    levelName: 'Self-Transcendence',
  },
  { 
    value: MaslowDomain.SPIRIT_PURPOSE, 
    label: '🌟 Spirit & Purpose', 
    color: DOMAIN_COLORS[MaslowDomain.SPIRIT_PURPOSE], 
    icon: DOMAIN_ICONS[MaslowDomain.SPIRIT_PURPOSE],
    level: MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE,
    levelName: 'Self-Transcendence',
  },
];

/**
 * Get domain configuration by value
 */
export const getDomainConfig = (value: string): DomainConfig => {
  return PRAXIS_DOMAINS.find(d => d.value === value) || {
    value: MaslowDomain.CAREER_CRAFT,
    label: 'Career & Craft',
    color: '#F59E0B',
    icon: '💼',
    level: MaslowLevel.LEVEL_4_ESTEEM,
    levelName: 'Esteem',
  };
};

/**
 * Get all domains for a specific Maslow level
 */
export const getDomainsByLevel = (level: MaslowLevel): DomainConfig[] => {
  return PRAXIS_DOMAINS.filter(d => d.level === level);
};

/**
 * Get domain by index (for ordered display)
 */
export const getDomainByIndex = (index: number): DomainConfig | undefined => {
  return PRAXIS_DOMAINS[index];
};
