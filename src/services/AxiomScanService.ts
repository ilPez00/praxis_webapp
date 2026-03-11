import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();

export class AxiomScanService {
  /**
   * Starts the midnight cron job.
   */
  public static start() {
    // Schedule: 00:00 every day
    cron.schedule('0 0 * * *', async () => {
      logger.info('[AxiomScan] Starting midnight automated scan...');
      try {
        await this.runGlobalScan();
      } catch (err: any) {
        logger.error('[AxiomScan] Global scan failed:', err.message);
      }
    });
    logger.info('[AxiomScan] Midnight cron job scheduled.');
  }

  /**
   * Manually trigger a scan for all active users.
   */
  public static async runGlobalScan() {
    // 1. Fetch all active users (users who checked in in the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, name')
      .gte('last_activity_date', sevenDaysAgo.toISOString().slice(0, 10));

    if (userError) throw userError;
    if (!users || users.length === 0) {
      logger.info('[AxiomScan] No active users found for scan.');
      return;
    }

    logger.info(`[AxiomScan] Scanning ${users.length} active users...`);

    // 2. Process each user (ideally in chunks or sequentially to respect rate limits)
    for (const user of users) {
      try {
        await this.generateDailyRecommendations(user.id, user.name);
        // Small delay to be kind to the API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        logger.warn(`[AxiomScan] Failed recommendations for ${user.name} (${user.id}): ${err.message}`);
      }
    }
    logger.info('[AxiomScan] Global scan completed.');
  }

  /**
   * Aggregates all data for a user and generates tailored recommendations.
   */
  private static async generateDailyRecommendations(userId: string, userName: string) {
    logger.info(`[AxiomScan] Processing ${userName}...`);

    // 1. Fetch all relevant data for context
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString();

    const [
      postsRes,
      messagesRes,
      eventsRes,
      challengesRes,
      matchRes,
      placesRes,
      servicesRes,
      trackerRes,
      goalsRes
    ] = await Promise.all([
      supabase.from('posts').select('*').gte('created_at', sinceISO).limit(20),
      supabase.from('messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).gte('created_at', sinceISO).limit(50),
      supabase.from('events').select('*').gte('event_date', new Date().toISOString().slice(0, 10)).limit(10),
      supabase.from('challenges').select('*').limit(10),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 5 }),
      supabase.from('places').select('*').limit(10),
      supabase.from('coaching_offers').select('*').limit(10),
      supabase.from('trackers').select('*, tracker_entries(*)').eq('user_id', userId),
      supabase.from('goal_trees').select('nodes').eq('userId', userId).single(),
    ]);

    // 2. Build the detailed context prompt
    const prompt = `You are Axiom. This is your midnight automated scan for ${userName}.
Analyze the following data from the last 7 days and provide 6 specific recommendations.

### User Goals
${JSON.stringify(goalsRes.data?.nodes || [])}

### Recent Activity (Posts)
${JSON.stringify(postsRes.data || [])}

### Upcoming Community Events
${JSON.stringify(eventsRes.data || [])}

### Community Challenges
${JSON.stringify(challengesRes.data || [])}

### Potential Matches (Aligned Students)
${JSON.stringify(matchRes.data || [])}

### Community Places
${JSON.stringify(placesRes.data || [])}

### Available Services/Coaches
${JSON.stringify(servicesRes.data || [])}

### Tracked Progress (Widgets & Trackers)
${JSON.stringify(trackerRes.data || [])}

---
INSTRUCTIONS:
Return a JSON object with exactly these 6 tailored recommendations for ${userName}:
1. "match": One best fitting student to connect with and why.
2. "event": One upcoming event they should attend.
3. "post": A relevant post from the community (e.g., a goal achieved by someone else) to inspire them.
4. "service": One job, coach, or service that fits their current needs.
5. "place": A physical or digital place (gym, library, board) they should visit.
6. "resource": A custom resource tailored to their exact tracked progress (e.g., a specific meal plan if they are tracking fitness, a lifting schedule, or a study plan).

Format:
{
  "match": { "name": "...", "reason": "..." },
  "event": { "title": "...", "reason": "..." },
  "post": { "author": "...", "snippet": "...", "reason": "..." },
  "service": { "title": "...", "reason": "..." },
  "place": { "name": "...", "reason": "..." },
  "resource": { "title": "...", "content": "..." }
}
`;

    const responseText = await aiCoachingService['runWithFallback'](prompt);
    // Manual JSON cleanup if needed
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const recommendations = JSON.parse(cleaned);

    // 3. Store in the database
    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      brief: recommendations,
      generated_at: new Date().toISOString()
    });

    logger.info(`[AxiomScan] Recommendations saved for ${userName}`);
  }
}
