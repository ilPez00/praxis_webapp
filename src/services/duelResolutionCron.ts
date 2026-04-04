import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { logFail } from '../controllers/failsController';
import logger from '../utils/logger';

export function startDuelResolutionCron() {
  cron.schedule('0 11 * * *', async () => {
    logger.info('[DuelResolution] Checking for expired duels...');
    
    try {
      const now = new Date().toISOString();
      
      const { data: expiredDuels } = await supabase
        .from('duels')
        .select('*')
        .eq('status', 'active')
        .lt('deadline', now);
      
      if (!expiredDuels || expiredDuels.length === 0) {
        logger.info('[DuelResolution] No expired duels found');
        return;
      }
      
      let resolved = 0;
      
      for (const duel of expiredDuels) {
        const challengerWon = false;
        const opponentWon = false;
        
        // Note: In a full implementation, we'd check actual goal completion
        // For now, both lose (neither completed) - or could implement smart resolution
        
        const stakeAmount = (duel.stake_pp || 100) * 1.8;
        
        await supabase
          .from('duels')
          .update({ status: 'completed' })
          .eq('id', duel.id);
        
        logFail('failed_bet', duel.title, `Duel lost by both parties`);
        
        resolved++;
        logger.info(`[DuelResolution] Duel ${duel.id} resolved: both lost`);
      }
      
      logger.info(`[DuelResolution] Resolved ${resolved} expired duels`);
    } catch (err: any) {
      logger.error('[DuelResolution] Error:', err.message);
    }
  });
  
  logger.info('[DuelResolution] Cron job scheduled: daily at 11:00 AM UTC');
}
