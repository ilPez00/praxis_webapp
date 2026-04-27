import { getDomainConfig, getDomainsByLevel, getDomainByIndex, PRAXIS_DOMAINS } from '../../types/Domain';
import { MaslowDomain, MaslowLevel } from '../../types/MaslowDomain';

describe('PRAXIS_DOMAINS', () => {
  it('has 14 domain configs', () => {
    expect(PRAXIS_DOMAINS).toHaveLength(14);
  });

  it('each config has required fields', () => {
    for (const d of PRAXIS_DOMAINS) {
      expect(d.value).toBeTruthy();
      expect(d.label).toBeTruthy();
      expect(d.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(d.icon).toBeTruthy();
      expect(typeof d.level).toBe('number');
      expect(d.levelName).toBeTruthy();
    }
  });
});

describe('getDomainConfig', () => {
  it('returns config for known domain', () => {
    const config = getDomainConfig(MaslowDomain.BODY_FITNESS);
    expect(config.value).toBe(MaslowDomain.BODY_FITNESS);
    expect(config.level).toBe(MaslowLevel.LEVEL_1_PHYSIOLOGICAL);
  });

  it('returns default config for unknown domain', () => {
    const config = getDomainConfig('Unknown Domain');
    expect(config.value).toBe(MaslowDomain.CAREER_CRAFT);
    expect(config.label).toBe('Career & Craft');
  });

  it('returns default config for empty string', () => {
    const config = getDomainConfig('');
    expect(config.value).toBe(MaslowDomain.CAREER_CRAFT);
  });
});

describe('getDomainsByLevel', () => {
  it('returns 3 domains for Level 1', () => {
    const domains = getDomainsByLevel(MaslowLevel.LEVEL_1_PHYSIOLOGICAL);
    expect(domains).toHaveLength(3);
  });

  it('returns 3 domains for Level 2', () => {
    const domains = getDomainsByLevel(MaslowLevel.LEVEL_2_SAFETY);
    expect(domains).toHaveLength(3);
  });

  it('returns 3 domains for Level 3', () => {
    const domains = getDomainsByLevel(MaslowLevel.LEVEL_3_LOVE_BELONGING);
    expect(domains).toHaveLength(3);
  });

  it('returns 3 domains for Level 4', () => {
    const domains = getDomainsByLevel(MaslowLevel.LEVEL_4_ESTEEM);
    expect(domains).toHaveLength(3);
  });

  it('returns 2 domains for Level 5', () => {
    const domains = getDomainsByLevel(MaslowLevel.LEVEL_5_SELF_TRANSCENDENCE);
    expect(domains).toHaveLength(2);
  });

  it('all returned configs match the requested level', () => {
    for (const level of [1, 2, 3, 4, 5] as MaslowLevel[]) {
      const domains = getDomainsByLevel(level);
      for (const d of domains) {
        expect(d.level).toBe(level);
      }
    }
  });
});

describe('getDomainByIndex', () => {
  it('returns config for valid index', () => {
    const config = getDomainByIndex(0);
    expect(config).toBeDefined();
    expect(config!.value).toBe(MaslowDomain.BODY_FITNESS);
  });

  it('returns undefined for out-of-bounds index', () => {
    expect(getDomainByIndex(-1)).toBeUndefined();
    expect(getDomainByIndex(100)).toBeUndefined();
  });

  it('returns config for last index', () => {
    const config = getDomainByIndex(13);
    expect(config).toBeDefined();
    expect(config!.value).toBe(MaslowDomain.SPIRIT_PURPOSE);
  });
});
