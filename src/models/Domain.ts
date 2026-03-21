/**
 * @enum Domain
 * @description Represents the 14 core life domains that categorize all user goals in Praxis.
 * These domains are organized based on Maslow's Hierarchy of Needs.
 */
export enum Domain {
  // Level 1: Physiological Needs
  BODY_FITNESS = 'Body & Fitness',
  REST_RECOVERY = 'Rest & Recovery',
  MENTAL_BALANCE = 'Mental Balance',
  
  // Level 2: Safety Needs
  ENVIRONMENT_HOME = 'Environment & Home',
  HEALTH_LONGEVITY = 'Health & Longevity',
  FINANCIAL_SECURITY = 'Financial Security',
  
  // Level 3: Love/Belonging
  FRIENDSHIP_SOCIAL = 'Friendship & Social',
  ROMANCE_INTIMACY = 'Romance & Intimacy',
  COMMUNITY_CONTRIBUTION = 'Community & Contribution',
  
  // Level 4: Esteem Needs
  CAREER_CRAFT = 'Career & Craft',
  WEALTH_ASSETS = 'Wealth & Assets',
  GAMING_ESPORTS = 'Gaming & Esports',
  
  // Level 5: Self-Transcendence
  IMPACT_LEGACY = 'Impact & Legacy',
  SPIRIT_PURPOSE = 'Spirit & Purpose'
}
