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
    
    // 1. Fetch user profile for location context
    const { data: profile } = await supabase.from('profiles').select('city, latitude, longitude').eq('id', userId).single();
    const userCity = profile?.city || 'Unknown';

    // 2. Fetch deep context
    // We fetch more items to ensure Axiom always has something to pick from
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
      supabase.from('events').select('*').gte('event_date', today).limit(20),
      supabase.from('places').select('*').limit(20),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 10 }),
      supabase.from('coaching_offers').select('*').limit(10),
    ]);

    const prompt = `You are Axiom. Generate a high-performance daily protocol for user ${userName}.
    
### User Location: ${userCity}

### Context:
- Goals: ${JSON.stringify(goalsRes.data?.nodes || [])}
- Tracked Progress: ${JSON.stringify(trackerRes.data || [])}
- Available Events: ${JSON.stringify(eventsRes.data || [])}
- Available Places: ${JSON.stringify(placesRes.data || [])}
- Aligned Users: ${JSON.stringify(matchRes.data || [])}
- Services: ${JSON.stringify(servicesRes.data || [])}

### Task:
Provide a JSON response with exactly these keys. 
You MUST prioritize items that are NEARBY (same city) and MATCH the user's goals. 
YOU MUST ALWAYS PICK ONE MATCH, ONE EVENT, AND ONE PLACE. Never return "null" or "N/A" for these. Pick the best possible candidate from the lists above.

1. "message": "A short (1-2 sentence) motivating morning message in Axiom's voice."
2. "match": { "id": "ID", "name": "string", "reason": "why they match goals" }
3. "event": { "id": "ID", "title": "string", "reason": "why attend" }
4. "place": { "id": "ID", "name": "string", "reason": "why go here" }
5. "challenge": { "type": "bet|duel", "target": "string", "terms": "string" }
6. "resources": [ { "goal": "string", "suggestion": "string", "details": "string" } ] (Provide ONE per goal).
7. "routine": [ { "time": "HH:MM", "task": "string", "alignment": "string" } ]
8. "motivation": "A 2-3 sentence overall take on the user's current trajectory."
9. "strategy": [ { "goal": "string", "domain": "string", "progress": number, "insight": "string", "steps": ["step1", "step2"] } ] (The original per-goal guidance).
10. "network": "Advice on leveraging the community/network."

CRITICAL: Use actual IDs from the context. All text fields MUST be strings.

JSON ONLY:`;

    const responseText = await aiCoachingService['runWithFallback'](prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const recommendations = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

    // Save to the daily briefs table
    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      brief: recommendations,
      generated_at: new Date().toISOString()
    });

    // Also update the main 'coaching_briefs' table so the per-goal strategy is mirrored there
    await supabase.from('coaching_briefs').upsert({
      user_id: userId,
      brief: {
        motivation: recommendations.motivation,
        strategy: recommendations.strategy,
        network: recommendations.network
      },
      generated_at: new Date().toISOString()
    });
  }
}
