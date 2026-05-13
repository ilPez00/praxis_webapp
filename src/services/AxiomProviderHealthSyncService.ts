/**
 * Axiom Provider Health Sync Service
 *
 * Bridges the /home/gio/ai/scanner.py endpoint/key tester with the
 * axiom_provider_health database table. Runs alongside the midnight
 * unified scan so Axiom's fallback chain can skip known-broken providers.
 *
 * Pipeline:
 *   scanner.py --dry-run  →  parse results  →  upsert axiom_provider_health
 *         ↓
 *   AICoachingService.runWithFallback()  →  check health table  →  skip BROKEN
 */

import { execFile as execFileSync } from 'child_process';
import { promisify } from 'util';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const execFileAsync = promisify(execFileSync);

const SCANNER_PATH = '/home/gio/ai/scanner.py';

export interface ProviderHealth {
  name: string;
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
  status: string;  // VALID | BROKEN | EXHAUSTED | SERVER_ERR | UNREACHABLE | NO_KEY
}

export class AxiomProviderHealthSyncService {
  /**
   * Run scanner.py in dry-run mode, parse results, sync to DB.
   * Non-blocking — designed to be called in parallel with user processing.
   */
  async runScanAndSync(): Promise<ProviderHealth[]> {
    const health = await this.runScanner();
    if (health.length > 0) {
      await this.syncToDatabase(health);
    }
    return health;
  }

  /**
   * Run scanner.py --dry-run and parse the structured output.
   */
  private async runScanner(): Promise<ProviderHealth[]> {
    try {
      const { stdout } = await execFileAsync('python3', [SCANNER_PATH, '--dry-run'], {
        timeout: 120000,  // 2 minutes for full scan
      });

      return this.parseScanOutput(stdout);
    } catch (err: any) {
      logger.warn(`[ProviderHealth] Scanner failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse scanner.py's report section.
   * Output lines look like:
   *   ✓ VALID        [200]  GROQ
   *   ✗ BROKEN       [401]  MISTRAL
   *   ~ EXHAUSTED    [429]  GEMINI
   */
  private parseScanOutput(output: string): ProviderHealth[] {
    const health: ProviderHealth[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^[✓✗~○!?·]\s+(\w+)\s+\[(\d+)\]\s+(.+)/);
      if (match) {
        const status = match[1];
        const code = parseInt(match[2], 10);
        const name = match[3].trim().toLowerCase();

        health.push({
          name,
          reachable: status === 'VALID' || status === 'NO_KEY',
          latencyMs: null,
          error: status === 'BROKEN' ? `HTTP ${code}` : null,
          status,
        });
      }
    }

    return health;
  }

  /**
   * Upsert health results into axiom_provider_health table.
   */
  private async syncToDatabase(health: ProviderHealth[]): Promise<void> {
    const now = new Date().toISOString();

    for (const h of health) {
      const { error } = await supabase.from('axiom_provider_health').upsert({
        provider_name: h.name,
        reachable: h.reachable,
        latency_ms: h.latencyMs,
        error: h.error,
        last_checked_at: now,
      }, { onConflict: 'provider_name' });

      if (error) {
        logger.warn(`[ProviderHealth] DB sync failed for ${h.name}: ${error.message}`);
      }
    }

    logger.info(`[ProviderHealth] Synced ${health.length} provider statuses to DB`);
  }

  /**
   * Get the current health map for quick lookup.
   * Used by AICoachingService.runWithFallback() to skip unhealthy providers.
   */
  static async getHealthMap(): Promise<Record<string, boolean>> {
    try {
      const { data } = await supabase
        .from('axiom_provider_health')
        .select('provider_name, reachable')
        .order('last_checked_at', { ascending: false });

      const map: Record<string, boolean> = {};
      if (data) {
        for (const row of data) {
          if (!map[row.provider_name]) {
            map[row.provider_name] = row.reachable;
          }
        }
      }
      return map;
    } catch {
      return {};
    }
  }
}

export default AxiomProviderHealthSyncService;
