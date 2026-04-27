/**
 * emailService — test template rendering with proper module isolation.
 * The Resend client is created at module load time, so we use
 * jest.isolateModules / dynamic imports to control env vars.
 */

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

describe('EmailService templates', () => {
  beforeEach(() => {
    process.env.CLIENT_URL = 'https://example.com';
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  describe('with Resend configured', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'test-key-re-12345';
    });

    it('sendWelcomeEmail returns true', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendWelcomeEmail({
        email: 'test@example.com', name: 'Alice',
      });
      expect(result).toBe(true);
    });

    it('sendStreakReminder returns true', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendStreakReminder({
        email: 'test@example.com', name: 'Bob', streak: 14,
      });
      expect(result).toBe(true);
    });

    it('sendMilestoneCelebration returns true for 7-day streak', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendMilestoneCelebration({
        email: 'test@example.com', name: 'Charlie', streak: 7,
      });
      expect(result).toBe(true);
    });

    it('sendMilestoneCelebration returns true for 30-day streak', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendMilestoneCelebration({
        email: 'test@example.com', name: 'Diana', streak: 30,
      });
      expect(result).toBe(true);
    });

    it('sendMilestoneCelebration returns true for 365-day streak', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendMilestoneCelebration({
        email: 'test@example.com', name: 'Frank', streak: 365,
      });
      expect(result).toBe(true);
    });

    it('sendWeeklyDigest returns true', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendWeeklyDigest(
        { email: 'test@example.com', name: 'Grace' },
        { goalsCompleted: 5, streakCurrent: 7, streakBest: 14, xpGained: 250, rankChange: 3 }
      );
      expect(result).toBe(true);
    });

    it('sendReEngagement returns true', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendReEngagement({
        email: 'test@example.com', name: 'Heidi',
        lastActive: new Date(Date.now() - 10 * 86400000),
      });
      expect(result).toBe(true);
    });
  });

  describe('without Resend configured', () => {
    it('returns false without API key', async () => {
      const { default: EmailService } = await import('../../services/emailService');
      const result = await EmailService.sendWelcomeEmail({
        email: 'test@example.com', name: 'Ivan',
      });
      expect(result).toBe(false);
    });
  });
});
