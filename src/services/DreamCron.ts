/**
 * DreamCron — dynamic sectorial dream generation scheduler.
 *
 * Runs every 15 minutes. Each tick:
 *   1. Scans system_config for dream_schedule_* entries with due sectors.
 *   2. Processes ONE sector per user (most urgent first).
 *   3. DreamEngine updates that sector's nextRunAt based on urgency.
 *
 * Result: high-stall users/domains get new proposals every 2h.
 *         low-stall users/domains quiet down to 8h intervals.
 *         PDCA-confirmed goals never get dreamed on.
 */

import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { dreamEngine, DreamSchedule } from './DreamEngine';
import logger from '../utils/logger';

const MAX_USERS_PER_TICK = 10;

export function startDreamCron(): void {
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processDueSectors();
    } catch (err: any) {
      logger.error('[DreamCron] Tick failed:', err.message);
    }
  });

  logger.info('[DreamCron] Scheduled: every 15 minutes (dynamic sectorial)');
}

async function processDueSectors(): Promise<void> {
  const now = Date.now();

  const { data, error } = await supabase
    .from('system_config')
    .select('key, value')
    .like('key', 'dream_schedule_%')
    .limit(200);

  if (error || !data || data.length === 0) return;

  // Find users with at least one due sector
  const due = (data as Array<{ key: string; value: DreamSchedule }>).filter(row => {
    const sectors = row.value?.sectors ?? [];
    return sectors.some(s => s.urgency >= 0.3 && s.nextRunAt <= now);
  });

  if (due.length === 0) return;

  logger.info(`[DreamCron] ${due.length} users with due sectors (processing up to ${MAX_USERS_PER_TICK})`);

  const batch = due.slice(0, MAX_USERS_PER_TICK);

  for (const row of batch) {
    const userId = row.key.replace('dream_schedule_', '');

    // Pick most urgent due sector
    const dueSectors = (row.value.sectors ?? [])
      .filter(s => s.urgency >= 0.3 && s.nextRunAt <= now)
      .sort((a, b) => b.urgency - a.urgency);

    if (dueSectors.length === 0) continue;
    const sector = dueSectors[0];

    try {
      const dreams = await dreamEngine.generateDreams(userId, sector.domain);
      logger.info(`[DreamCron] user=${userId} sector=${sector.domain} urgency=${sector.urgency.toFixed(2)} +${dreams.length} dreams`);
    } catch (err: any) {
      logger.warn(`[DreamCron] Failed user=${userId} sector=${sector.domain}: ${err.message}`);
    }
  }
}
