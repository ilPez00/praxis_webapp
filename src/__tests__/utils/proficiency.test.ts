import { classifyPostDomain } from '../../utils/proficiency';

describe('classifyPostDomain', () => {
  it('classifies career-related text', () => {
    const result = classifyPostDomain('I got a promotion at work and my salary increased');
    expect(result).toBe('Career');
  });

  it('classifies fitness-related text', () => {
    const result = classifyPostDomain('Went to the gym for a workout and ran on the treadmill');
    expect(result).toBe('Fitness');
  });

  it('classifies investing text', () => {
    const result = classifyPostDomain('My crypto portfolio and stock investments are growing');
    expect(result).toBe('Investing / Financial Growth');
  });

  it('classifies academics text', () => {
    const result = classifyPostDomain('Studied for my exam at the university library');
    expect(result).toBe('Academics');
  });

  it('classifies mental health text', () => {
    const result = classifyPostDomain('Meditation helped with my anxiety and stress today');
    expect(result).toBe('Mental Health');
  });

  it('classifies philosophical text', () => {
    const result = classifyPostDomain('Reading stoic philosophy about meaning and virtue');
    expect(result).toBe('Philosophical Development');
  });

  it('classifies creative hobbies text', () => {
    const result = classifyPostDomain('Painted a new piece and listened to music');
    expect(result).toBe('Culture / Hobbies / Creative Pursuits');
  });

  it('classifies romance text', () => {
    const result = classifyPostDomain('Had a great date with my partner, feeling love');
    expect(result).toBe('Intimacy / Romantic Exploration');
  });

  it('classifies social text', () => {
    const result = classifyPostDomain('Hung out with friends at a social event in the community');
    expect(result).toBe('Friendship / Social Engagement');
  });

  it('classifies personal goals text', () => {
    const result = classifyPostDomain('Going on a travel adventure to achieve a bucket list dream');
    expect(result).toBe('Personal Goals');
  });

  it('returns null for text with no domain keywords', () => {
    const result = classifyPostDomain('The weather is nice today');
    expect(result).toBeNull();
  });

  it('returns null for empty text', () => {
    const result = classifyPostDomain('');
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = classifyPostDomain('GYM WORKOUT EXERCISE TRAINING');
    expect(result).toBe('Fitness');
  });

  it('picks the domain with the most keyword matches', () => {
    const text = 'I went to the gym to workout and lift, then studied at the university for my exam';
    const result = classifyPostDomain(text);
    expect(result).toBe('Fitness');
  });
});
