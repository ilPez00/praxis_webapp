/**
 * Axiom Wiki Materializer
 *
 * Syncs wiki pages from Postgres (axiom_wiki_pages) to the local filesystem
 * so llmwiki can index them, then triggers an incremental reindex.
 *
 * Only runs on the dev machine (where /home/gio/ai/wiki exists).
 * Railway uses PostgreSQL FTS directly instead.
 *
 * Pattern: materialize → llmwiki index → ready for search
 */

import { execFile as execFileSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const execFileAsync = promisify(execFileSync);

const WIKI_ROOT = '/home/gio/ai/wiki';
const LLMWIKI_BIN = 'llmwiki';

export interface MaterializeResult {
  userId: string;
  pagesWritten: number;
  indexed: boolean;
  error?: string;
}

export class AxiomWikiMaterializer {
  /**
   * Materialize all wiki pages for a user from Postgres to filesystem,
   * then trigger llmwiki incremental reindex.
   */
  async materializeAndIndex(userId: string): Promise<MaterializeResult> {
    const result: MaterializeResult = { userId, pagesWritten: 0, indexed: false };

    try {
      const pagesWritten = await this.materialize(userId);
      result.pagesWritten = pagesWritten;

      if (pagesWritten > 0) {
        await this.reindex();
        result.indexed = true;
      }

      logger.info(`[WikiMaterializer] Materialized ${pagesWritten} pages for ${userId} (indexed: ${result.indexed})`);
    } catch (err: any) {
      logger.warn(`[WikiMaterializer] Failed for ${userId}: ${err.message}`);
      result.error = err.message;
    }

    return result;
  }

  /**
   * Write all wiki pages for a user from Postgres → filesystem.
   * Creates parent directories as needed.
   */
  private async materialize(userId: string): Promise<number> {
    const { data: pages, error } = await supabase
      .from('axiom_wiki_pages')
      .select('page_path, frontmatter, content')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`DB query failed: ${error.message}`);
    }

    if (!pages || pages.length === 0) {
      logger.info(`[WikiMaterializer] No pages to materialize for ${userId}`);
      return 0;
    }

    const userDir = path.join(WIKI_ROOT, userId);
    await fs.promises.mkdir(userDir, { recursive: true });

    for (const page of pages) {
      const filePath = path.join(userDir, page.page_path);
      const fileDir = path.dirname(filePath);
      await fs.promises.mkdir(fileDir, { recursive: true });

      const fm = page.frontmatter || {};
      const fmLines = Object.entries(fm)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
          if (typeof v === 'number') return `${k}: ${v}`;
          return `${k}: ${String(v)}`;
        })
        .join('\n');

      const markdown = `---\n${fmLines}\n---\n\n${page.content}`;
      await fs.promises.writeFile(filePath, markdown, 'utf-8');
    }

    return pages.length;
  }

  /**
   * Trigger llmwiki incremental reindex on the entire wiki root.
   * Only runs if llmwiki binary is available.
   */
  private async reindex(): Promise<void> {
    try {
      const { stdout } = await execFileAsync(LLMWIKI_BIN, ['index', '--incremental', '--wiki-root', WIKI_ROOT], {
        timeout: 60000,
      });
      logger.info(`[WikiMaterializer] llmwiki reindex: ${stdout.trim()}`);
    } catch (err: any) {
      // llmwiki binary might not be installed yet
      logger.warn(`[WikiMaterializer] llmwiki reindex skipped: ${err.message}`);
    }
  }

  /**
   * Full reindex (not incremental — rebuilds from scratch).
   * Run when page structure changes significantly.
   */
  async fullReindex(): Promise<void> {
    try {
      const { stdout } = await execFileAsync(LLMWIKI_BIN, ['index', '--wiki-root', WIKI_ROOT], {
        timeout: 120000,
      });
      logger.info(`[WikiMaterializer] llmwiki full reindex: ${stdout.trim()}`);
    } catch (err: any) {
      logger.warn(`[WikiMaterializer] llmwiki full reindex skipped: ${err.message}`);
    }
  }

  /**
   * Check if llmwiki binary is available on this machine.
   */
  async isLlmwikiAvailable(): Promise<boolean> {
    try {
      await execFileAsync(LLMWIKI_BIN, ['--help'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export default AxiomWikiMaterializer;
