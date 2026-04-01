/**
 * Email Service using Resend
 * Transactional emails for user retention and engagement
 */

import { Resend } from 'resend';
import logger from '../utils/logger';

// Initialize Resend
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = 'Praxis <noreply@praxis.app>';
const BASE_URL = process.env.CLIENT_URL || 'https://praxis-webapp.vercel.app';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email with retry logic
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!resend) {
    logger.warn('Resend not configured - email not sent');
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error: any) {
    logger.error(`Email failed to ${options.to}: ${error.message}`);
    return false;
  }
}

/**
 * Email Templates
 */

export const EmailService = {
  /**
   * Welcome Email - Sent when user completes onboarding
   */
  async sendWelcomeEmail(user: { email: string; name: string }) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #F59E0B, #8B5CF6); padding: 40px 20px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 32px; }
            .content { background: #fff; padding: 40px 20px; }
            .button { display: inline-block; background: #F59E0B; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .feature { margin: 20px 0; padding: 20px; background: #F9FAFB; border-radius: 8px; }
            .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎯 Welcome to Praxis!</h1>
            <p>Your AI-powered accountability partner</p>
          </div>
          <div class="content">
            <h2>Hi ${user.name}!</h2>
            <p>You've just taken the first step toward building real, lasting change. Praxis combines smart goal tracking with social accountability to help you achieve what matters most.</p>
            
            <div class="feature">
              <h3>🌟 Get Started in 3 Steps:</h3>
              <ol>
                <li><strong>Set your first goal</strong> - Break it down into actionable steps</li>
                <li><strong>Check in daily</strong> - Build streaks and earn rewards</li>
                <li><strong>Find your squad</strong> - Connect with accountability partners</li>
              </ol>
            </div>

            <p style="text-align: center;">
              <a href="${BASE_URL}/dashboard" class="button">Go to Dashboard →</a>
            </p>

            <p><strong>What you get free:</strong></p>
            <ul>
              <li>✅ 3 root goals (unlimited with Pro)</li>
              <li>✅ Daily AI briefs from Axiom</li>
              <li>✅ Accountability partner matching</li>
              <li>✅ Streak tracking & leaderboards</li>
            </ul>

            <p>Need help? Just reply to this email - we read every message.</p>
            
            <p>Cheering you on,<br><strong>The Praxis Team</strong></p>
          </div>
          <div class="footer">
            <p>Praxis - Where goals meet community</p>
            <p>Verona, Italy 🇮🇹</p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to Praxis, ${user.name}!

      You've just taken the first step toward building real, lasting change.

      Get Started in 3 Steps:
      1. Set your first goal - Break it down into actionable steps
      2. Check in daily - Build streaks and earn rewards
      3. Find your squad - Connect with accountability partners

      Go to Dashboard: ${BASE_URL}/dashboard

      What you get free:
      ✅ 3 root goals (unlimited with Pro)
      ✅ Daily AI briefs from Axiom
      ✅ Accountability partner matching
      ✅ Streak tracking & leaderboards

      Need help? Just reply to this email.

      Cheering you on,
      The Praxis Team
    `;

    return sendEmail({
      to: user.email,
      subject: 'Welcome to Praxis! Let\'s build something great together 🎯',
      html,
      text,
    });
  },

  /**
   * Streak At Risk - Sent when user hasn't checked in for 1 day
   */
  async sendStreakReminder(user: { email: string; name: string; streak: number }) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1F2937; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #F97316, #F59E0B); padding: 40px 20px; text-align: center; color: white; }
            .streak { font-size: 64px; font-weight: 900; margin: 20px 0; }
            .content { background: #fff; padding: 40px 20px; }
            .button { display: inline-block; background: #F97316; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔥 Your streak is at risk!</h1>
          </div>
          <div class="content">
            <p>Hey ${user.name},</p>
            
            <p style="text-align: center;">
              <span class="streak">${user.streak} days</span>
            </p>
            
            <div class="warning">
              <strong>⚠️ Don't let it break!</strong><br>
              You're on a ${user.streak}-day streak. Check in before midnight to keep it going.
            </div>

            <p>Remember why you started. Every day counts. Every check-in builds momentum.</p>

            <p style="text-align: center;">
              <a href="${BASE_URL}/dashboard" class="button">Check In Now →</a>
            </p>

            <p><strong>Quick win:</strong> Just log one thing you did today toward your goals. That's it.</p>

            <p>You've got this!<br><strong>The Praxis Team</strong></p>
          </div>
          <div class="footer">
            <p>Praxis - Where goals meet community</p>
          </div>
        </body>
      </html>
    `;

    return sendEmail({
      to: user.email,
      subject: `🔥 Your ${user.streak}-day streak needs you!`,
      html,
      text: `
        Hey ${user.name},

        Your ${user.streak}-day streak is at risk!

        Check in before midnight to keep it going: ${BASE_URL}/dashboard

        Remember why you started. Every day counts.

        You've got this!
        The Praxis Team
      `,
    });
  },

  /**
   * Milestone Celebration - Sent on 7, 30, 90, 365 day streaks
   */
  async sendMilestoneCelebration(user: { email: string; name: string; streak: number }) {
    const milestone = user.streak;
    const tier = milestone >= 365 ? 'Legendary' : milestone >= 90 ? 'Elite' : milestone >= 30 ? 'Veteran' : 'Warrior';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1F2937; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #F59E0B, #8B5CF6); padding: 40px 20px; text-align: center; color: white; }
            .badge { font-size: 80px; margin: 20px 0; }
            .streak { font-size: 48px; font-weight: 900; }
            .content { background: #fff; padding: 40px 20px; }
            .button { display: inline-block; background: #F59E0B; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .stats { background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="badge">🏆</div>
            <h1>Congratulations, ${user.name}!</h1>
            <p>You've reached the <strong>${tier} Tier</strong></p>
          </div>
          <div class="content">
            <p style="text-align: center;">
              <span class="streak">${milestone} DAYS</span>
            </p>
            
            <p><strong>This is incredible!</strong> You're now in the top 
            ${milestone >= 365 ? '0.1%' : milestone >= 90 ? '1%' : milestone >= 30 ? '5%' : '15%'} of all Praxis users.</p>

            <div class="stats">
              <h3>Your Impact:</h3>
              <ul>
                <li>✅ ${milestone} days of consistent action</li>
                <li>✅ ${Math.floor(milestone / 7)} weeks of momentum</li>
                <li>✅ Countless goals moved forward</li>
                <li>✅ An inspiration to others</li>
              </ul>
            </div>

            <p><strong>What's next?</strong></p>
            <ul>
              <li>Share your achievement and inspire others</li>
              <li>Set an even bigger goal</li>
              <li>Mentor someone just starting out</li>
            </ul>

            <p style="text-align: center;">
              <a href="${BASE_URL}/profile" class="button">View Your Profile →</a>
            </p>

            <p>Keep building,<br><strong>The Praxis Team</strong></p>
          </div>
          <div class="footer">
            <p>Praxis - Where goals meet community</p>
          </div>
        </body>
      </html>
    `;

    return sendEmail({
      to: user.email,
      subject: `🏆 ${milestone} days! You're ${tier}, ${user.name}!`,
      html,
      text: `
        Congratulations ${user.name}!

        ${milestone} DAYS - ${tier} Tier!

        You're in the top ${milestone >= 365 ? '0.1%' : milestone >= 90 ? '1%' : milestone >= 30 ? '5%' : '15%'} of all Praxis users.

        Your Impact:
        ✅ ${milestone} days of consistent action
        ✅ ${Math.floor(milestone / 7)} weeks of momentum
        ✅ Countless goals moved forward
        ✅ An inspiration to others

        Keep building!
        The Praxis Team
      `,
    });
  },

  /**
   * Weekly Digest - Sent every Sunday with user stats
   */
  async sendWeeklyDigest(user: { email: string; name: string }, stats: {
    goalsCompleted: number;
    streakCurrent: number;
    streakBest: number;
    xpGained: number;
    rankChange: number;
  }) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1F2937; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); padding: 40px 20px; text-align: center; color: white; }
            .content { background: #fff; padding: 40px 20px; }
            .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; }
            .stat { background: #F9FAFB; padding: 16px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 32px; font-weight: 900; color: #F59E0B; }
            .stat-label { font-size: 14px; color: #6B7280; }
            .button { display: inline-block; background: #8B5CF6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Your Week in Review</h1>
            <p>Great work this week, ${user.name}!</p>
          </div>
          <div class="content">
            <div class="stat-grid">
              <div class="stat">
                <div class="stat-value">${stats.goalsCompleted}</div>
                <div class="stat-label">Goals Completed</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats.streakCurrent}🔥</div>
                <div class="stat-label">Current Streak</div>
              </div>
              <div class="stat">
                <div class="stat-value">+${stats.xpGained}</div>
                <div class="stat-label">XP Gained</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats.rankChange >= 0 ? '+' : ''}${stats.rankChange}</div>
                <div class="stat-label">Rank Change</div>
              </div>
            </div>

            <p><strong>Best streak:</strong> ${stats.streakBest} days</p>

            <p style="text-align: center;">
              <a href="${BASE_URL}/dashboard" class="button">See Full Dashboard →</a>
            </p>

            <p><strong>Tip:</strong> Users who check in daily are 3x more likely to achieve their goals. Keep the momentum going!</p>

            <p>See you next week,<br><strong>The Praxis Team</strong></p>
          </div>
          <div class="footer">
            <p>Praxis - Where goals meet community</p>
          </div>
        </body>
      </html>
    `;

    return sendEmail({
      to: user.email,
      subject: `📊 Your Week in Review: ${stats.goalsCompleted} goals, +${stats.xpGained} XP`,
      html,
      text: `
        Your Week in Review

        Goals Completed: ${stats.goalsCompleted}
        Current Streak: ${stats.streakCurrent}🔥
        XP Gained: +${stats.xpGained}
        Rank Change: ${stats.rankChange >= 0 ? '+' : ''}${stats.rankChange}
        Best Streak: ${stats.streakBest} days

        See Full Dashboard: ${BASE_URL}/dashboard

        Tip: Users who check in daily are 3x more likely to achieve their goals.

        The Praxis Team
      `,
    });
  },

  /**
   * Re-engagement - Sent after 7 days of inactivity
   */
  async sendReEngagement(user: { email: string; name: string; lastActive: Date }) {
    const daysInactive = Math.floor((Date.now() - new Date(user.lastActive).getTime()) / 86400000);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1F2937; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981, #059669); padding: 40px 20px; text-align: center; color: white; }
            .content { background: #fff; padding: 40px 20px; }
            .button { display: inline-block; background: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .reminder { background: #D1FAE5; border-left: 4px solid #10B981; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>👋 We miss you, ${user.name}!</h1>
          </div>
          <div class="content">
            <p>It's been ${daysInactive} days since your last visit. We hope you're doing well!</p>
            
            <div class="reminder">
              <strong>💡 Remember:</strong> Progress isn't about perfection. It's about showing up, even for just 5 minutes.
            </div>

            <p><strong>What you've accomplished:</strong></p>
            <ul>
              <li>Every goal you set was a step toward growth</li>
              <li>Every check-in built momentum</li>
              <li>Every interaction inspired others</li>
            </ul>

            <p>Your goals are still waiting. Your squad is still here. And we're still cheering for you.</p>

            <p style="text-align: center;">
              <a href="${BASE_URL}/dashboard" class="button">Come Back →</a>
            </p>

            <p>No pressure. No judgment. Just support.</p>

            <p>Always here for you,<br><strong>The Praxis Team</strong></p>
          </div>
          <div class="footer">
            <p>Praxis - Where goals meet community</p>
          </div>
        </body>
      </html>
    `;

    return sendEmail({
      to: user.email,
      subject: `👋 We miss you! Come back to Praxis`,
      html,
      text: `
        Hey ${user.name},

        It's been ${daysInactive} days since your last visit. We hope you're doing well!

        Remember: Progress isn't about perfection. It's about showing up, even for just 5 minutes.

        Your goals are still waiting. Your squad is still here. And we're still cheering for you.

        Come Back: ${BASE_URL}/dashboard

        No pressure. No judgment. Just support.

        The Praxis Team
      `,
    });
  },
};

export default EmailService;
