import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();

export class AxiomScanService {
  public static start() {
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

  public static async runGlobalScan() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, name')
      .gte('last_activity_date', sevenDaysAgo.toISOString().slice(0, 10));

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    for (const user of users) {
      try {
        await this.generateDailyRecommendations(user.id, user.name);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        logger.warn(`[AxiomScan] Failed for ${user.name}: ${err.message}`);
      }
    }
  }

  private static async generateDailyRecommendations(userId: string, userName: string) {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. Fetch deep context
    const [
      goalsRes,
      trackerRes,
      eventsRes,
      placesRes,
      matchRes,
      servicesRes
    ] = await Promise.all([
      supabase.from('goal_trees').select('nodes').eq('userId', userId).single(),
      supabase.from('trackers').select('*, tracker_entries(*)').eq('user_id', userId),
      supabase.from('events').select('*').gte('event_date', today).limit(10),
      supabase.from('places').select('*').limit(10),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 3 }),
      supabase.from('coaching_offers').select('*').limit(10),
    ]);

    const prompt = `You are Axiom. Generate a high-performance daily brief for ${userName}.
    
### Context:
- Goals: ${JSON.stringify(goalsRes.data?.nodes || [])}
- Tracked Progress: ${JSON.stringify(trackerRes.data || [])}
- Local Events: ${JSON.stringify(eventsRes.data || [])}
- Community Places: ${JSON.stringify(placesRes.data || [])}
- Aligned Students: ${JSON.stringify(matchRes.data || [])}
- Services: ${JSON.stringify(servicesRes.data || [])}

### Task:
Provide a JSON response with exactly:
1. "match": { "id": "...", "name": "...", "reason": "..." } (the best clickable student).
2. "resources": [ { "goal": "...", "suggestion": "...", "details": "..." } ] (ONE specific resource per goal. If they study Kant, suggest Schopenhauer. If muscle, a specific routine).
3. "event": { "id": "...", "title": "...", "reason": "..." } (clickable event).
4. "place": { "id": "...", "name": "...", "reason": "..." } (clickable place).
5. "challenge": { "type": "bet|duel", "target": "...", "terms": "..." } (suggest a specific competitive action).
6. "routine": [ { "time": "...", "task": "...", "alignment": "..." } ] (A full day plan considering 9-5 work hours).

JSON ONLY:`;

    const responseText = await aiCoachingService['runWithFallback'](prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const recommendations = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      brief: recommendations,
      generated_at: new Date().toISOString()
    });
  }
}
