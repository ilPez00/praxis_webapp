import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { logFail } from '../controllers/failsController';
import logger from '../utils/logger';

export function startFailsCron() {
  cron.schedule('30 10 * * *', async () => {
    logger.info('[FailsCron] Checking for missed checkins...');
    
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, last_activity_date, current_streak')
        .gt('current_streak', 0);
      
      if (!profiles || profiles.length === 0) return;
      
      let missedCount = 0;
      
      for (const profile of profiles) {
        const lastActivity = profile.last_activity_date?.slice(0, 10);
        
        if (lastActivity === yesterday) {
          const { data: checkinToday } = await supabase
            .from('checkins')
            .select('id')
            .eq('user_id', profile.id)
            .gte('checked_in_at', `${today}T00:00:00`)
            .maybeSingle();
          
          if (!checkinToday) {
            missedCount++;
            await logFail('missed_checkin', `${profile.current_streak}-day streak broken`, `Had ${profile.current_streak} day streak`);
          }
        }
      }
      
      logger.info(`[FailsCron] Logged ${missedCount} missed checkins`);
    } catch (err: any) {
      logger.error('[FailsCron] Error:', err.message);
    }
  });
  
  logger.info('[FailsCron] Cron job scheduled: daily at 10:30 AM UTC');
}
