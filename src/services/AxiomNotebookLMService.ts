/**
 * Axiom NotebookLM Integration
 * Queries user's NotebookLM notebooks for superior RAG context
 * Uses Python subprocess with httpx (no browser/Playwright needed)
 */

import { execFile as execFileSync } from 'child_process';
import { promisify } from 'util';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import path from 'path';

const execFileAsync = promisify(execFileSync);

export interface NotebookLMResult {
  notebookId: string;
  answer?: string;
  error?: string;
}

export interface AxiomNotebookLMContext {
  notebookInsights: string;
  notebooksQueried: number;
  errors: string[];
}

const PYTHON_SCRIPT = path.join(__dirname, 'AxiomNotebookLMPython.py');

class AxiomNotebookLMService {
  /**
   * Get stored NotebookLM tokens for a user
   */
  async getTokens(userId: string): Promise<Record<string, string> | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('notebooklm_tokens')
        .eq('id', userId)
        .single();

      const tokens = data?.notebooklm_tokens;
      if (!tokens) return null;

      // Support both raw cookies dict and legacy storage_state format
      if (typeof tokens === 'string') {
        try {
          const parsed = JSON.parse(tokens);
          if (parsed.cookies) return parsed.cookies; // storage_state format
          return parsed; // raw cookies
        } catch {
          return null;
        }
      }
      if (tokens.cookies) return tokens.cookies;
      return tokens as Record<string, string>;
    } catch (err: any) {
      logger.warn(`[NotebookLM] Could not load tokens for ${userId}: ${err.message}`);
      return null;
    }
  }

  /**
   * List user's NotebookLM notebooks
   */
  async listNotebooks(userId: string): Promise<any[]> {
    const tokens = await this.getTokens(userId);
    if (!tokens) return [];

    try {
      const cookiesJson = JSON.stringify(tokens);
      const { stdout } = await execFileAsync('python3', [PYTHON_SCRIPT, 'list', cookiesJson], { timeout: 30000 });
      const result = JSON.parse(stdout.trim());

      if (result.error) {
        logger.warn(`[NotebookLM] List notebooks failed: ${result.error}`);
        return [];
      }

      return Array.isArray(result) ? result : [];
    } catch (err: any) {
      logger.warn(`[NotebookLM] List notebooks error: ${err.message}`);
      return [];
    }
  }

  /**
   * Ask a question to a specific NotebookLM notebook
   */
  async askNotebook(userId: string, notebookId: string, question: string): Promise<NotebookLMResult> {
    const tokens = await this.getTokens(userId);
    if (!tokens) {
      return { notebookId, error: 'No NotebookLM tokens configured' };
    }

    try {
      const cookiesJson = JSON.stringify(tokens);
      const { stdout, stderr } = await execFileAsync('python3', [PYTHON_SCRIPT, 'ask', cookiesJson, notebookId, question], { timeout: 45000 });

      if (stderr) {
        logger.debug(`[NotebookLM] stderr: ${stderr.slice(0, 200)}`);
      }

      const result = JSON.parse(stdout.trim());
      return {
        notebookId,
        answer: result.answer || result.raw || null,
        error: result.error,
      };
    } catch (err: any) {
      logger.warn(`[NotebookLM] Ask failed for ${notebookId}: ${err.message}`);
      return { notebookId, error: err.message };
    }
  }

  /**
   * Query all user notebooks with a context-building question
   * Returns aggregated context string for Axiom prompts
   */
  async queryAllNotebooks(userId: string, context: string): Promise<AxiomNotebookLMContext> {
    const notebooks = await this.listNotebooks(userId);

    if (notebooks.length === 0) {
      return { notebookInsights: '', notebooksQueried: 0, errors: [] };
    }

    const question = `Based on this user's Praxis data, what insights can you provide?\n\nUser context:\n${context.slice(0, 500)}`;
    const errors: string[] = [];
    const answers: string[] = [];

    // Query up to 5 notebooks (cap to avoid rate limiting)
    const toQuery = notebooks.slice(0, 5);

    for (const nb of toQuery) {
      const nbId = nb.notebookId || nb.id;
      if (!nbId) continue;

      const result = await this.askNotebook(userId, nbId, question);

      if (result.error) {
        errors.push(`${nbId}: ${result.error}`);
      } else if (result.answer) {
        const title = nb.title || nb.name || nbId;
        answers.push(`[NotebookLM: ${title}]\n${(result.answer || '').slice(0, 1500)}`);
      }

      // Small delay between notebooks
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const notebookInsights = answers.length > 0
      ? `\n\n## NotebookLM Insights\n${answers.join('\n\n---\n\n')}`
      : '';

    return {
      notebookInsights,
      notebooksQueried: toQuery.length,
      errors,
    };
  }

  /**
   * Check if a user has NotebookLM configured
   */
  async isConfigured(userId: string): Promise<boolean> {
    const tokens = await this.getTokens(userId);
    return tokens !== null && Object.keys(tokens).length > 0;
  }
}

export const axiomNotebookLMService = new AxiomNotebookLMService();
export default axiomNotebookLMService;
