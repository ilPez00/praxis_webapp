import { MaslowDomain, MaslowLevel, DOMAIN_TO_MASLOW_LEVEL, DOMAIN_COLORS, DOMAIN_ICONS, MASLOW_LEVEL_INFO } from '../../types/MaslowDomain';

describe('MaslowDomain enum', () => {
  it('has 14 domains', () => {
    const values = Object.values(MaslowDomain);
    expect(values).toHaveLength(14);
  });

  it('includes all expected domains', () => {
    expect(MaslowDomain.BODY_FITNESS).toBe('Body & Fitness');
    expect(MaslowDomain.REST_RECOVERY).toBe('Rest & Recovery');
    expect(MaslowDomain.MENTAL_BALANCE).toBe('Mental Balance');
    expect(MaslowDomain.ENVIRONMENT_HOME).toBe('Environment & Home');
    expect(MaslowDomain.HEALTH_LONGEVITY).toBe('Health & Longevity');
    expect(MaslowDomain.FINANCIAL_SECURITY).toBe('Financial Security');
    expect(MaslowDomain.FRIENDSHIP_SOCIAL).toBe('Friendship & Social');
    expect(MaslowDomain.ROMANCE_INTIMACY).toBe('Romance & Intimacy');
    expect(MaslowDomain.COMMUNITY_CONTRIBUTION).toBe('Community & Contribution');
    expect(MaslowDomain.CAREER_CRAFT).toBe('Career & Craft');
    expect(MaslowDomain.WEALTH_ASSETS).toBe('Wealth & Assets');
    expect(MaslowDomain.GAMING_ESPORTS).toBe('Gaming & Esports');
    expect(MaslowDomain.IMPACT_LEGACY).toBe('Impact & Legacy');
    expect(MaslowDomain.SPIRIT_PURPOSE).toBe('Spirit & Purpose');
  });
});

describe('DOMAIN_TO_MASLOW_LEVEL', () => {
  it('maps each domain to a level', () => {
    const domains = Object.values(MaslowDomain);
    for (const domain of domains) {
      expect(DOMAIN_TO_MASLOW_LEVEL[domain]).toBeDefined();
    }
  });

  it('has 3 domains at Level 1', () => {
    const level1 = Object.entries(DOMAIN_TO_MASLOW_LEVEL).filter(([, l]) => l === MaslowLevel.LEVEL_1_PHYSIOLOGICAL);
    expect(level1).toHaveLength(3);
  });

  it('has 3 domains at Level 2', () => {
    const level2 = Object.entries(DOMAIN_TO_MASLOW_LEVEL).filter(([, l]) => l === MaslowLevel.LEVEL_2_SAFETY);
    expect(level2).toHaveLength(3);
  });

  it('has 3 domains at Level 3', () => {
    const level3 = Object.entries(DOMAIN_TO_MASLOW_LEVEL).filter(([, l]) => l === MaslowLevel.LEVEL_3_LOVE_BELONGING);
    expect(level3).toHaveLength(3);
  });

  it('has 3 domains at Level 4', () => {
    const level4 = Object.entries(DOMAIN_TO_MASLOW_LEVEL).filter(([, l]) => l === MaslowLevel.LEVEL_4_ESTEEM);
    expect(level4).toHaveLength(3);
  });

  it('has 2 domains at Level 5', () => {
    const level5 = Object.entries(DOMAIN_TO_MASLOW_LEVEL).filter(([, l]) => l === MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE);
    expect(level5).toHaveLength(2);
  });
});

describe('DOMAIN_COLORS', () => {
  it('provides a color for every domain', () => {
    const domains = Object.values(MaslowDomain);
    for (const domain of domains) {
      expect(DOMAIN_COLORS[domain]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('DOMAIN_ICONS', () => {
  it('provides an icon for every domain', () => {
    const domains = Object.values(MaslowDomain);
    for (const domain of domains) {
      expect(DOMAIN_ICONS[domain]).toBeTruthy();
      expect(typeof DOMAIN_ICONS[domain]).toBe('string');
    }
  });
});

describe('MASLOW_LEVEL_INFO', () => {
  it('has entries for all 5 levels', () => {
    expect(Object.keys(MASLOW_LEVEL_INFO)).toHaveLength(5);
  });

  it('each level has name, description, and color', () => {
    for (const info of Object.values(MASLOW_LEVEL_INFO)) {
      expect(info.name).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(info.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
