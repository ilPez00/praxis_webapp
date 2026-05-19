/**
 * Axiom Wiki Search Service
 *
 * Two modes:
 *   1. Local dev:  calls `llmwiki search` (Tantivy BM25 + usearch semantic)
 *   2. Railway:    uses PostgreSQL FTS via wiki_search() RPC
 *
 * Returns the same snippet format regardless of mode.
 * Each snippet is ~50 tokens — replaces 3000+ tokens of raw data dumps.
 */

import { execFile as execFileSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const execFileAsync = promisify(execFileSync);

const WIKI_ROOT = process.env.WIKI_ROOT || '/home/gio/ai/wiki';
const UBER_WIKI_ROOT = process.env.UBER_WIKI_ROOT || '/home/gio/uber-wiki/wiki';
const LLMWIKI_BIN = process.env.LLMWIKI_BIN || '/home/gio/.cargo/bin/llmwiki';

export interface WikiSnippet {
  pagePath: string;
  snippet: string;
  score: number;
  matchLocations?: string[];
}

export class AxiomWikiSearchService {
  /**
   * Search the wiki for context relevant to a query.
   * Returns up to 3 snippets, each ~50 tokens.
   */
  async search(userId: string, query: string, maxResults: number = 3): Promise<WikiSnippet[]> {
    try {
      const llmwikiUp = await this.isLlmwikiAvailable();
      const ownerUserId = process.env.UBER_WIKI_OWNER_USER_ID;
      const isOwner = ownerUserId && userId === ownerUserId;

      const [userSnippets, globalSnippets, communitySnippets] = await Promise.all([
        llmwikiUp
          ? this.searchLlmwiki(userId, query, maxResults)
          : this.searchPostgres(userId, query, maxResults),
        isOwner ? this.searchUberWiki(query, 2) : Promise.resolve([]),
        this.searchCommunityWiki(query, 2),
      ]);
      const merged = [...globalSnippets, ...communitySnippets, ...userSnippets];
      return merged.slice(0, maxResults + 2);
    } catch (err: any) {
      logger.warn(`[WikiSearch] search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Search the community wiki aggregates (anonymized patterns).
   * Uses simple keyword search on tags and source_type for now.
   */
  async searchCommunityWiki(query: string, maxResults: number = 2): Promise<WikiSnippet[]> {
    try {
      const { data, error } = await supabase
        .from('community_wiki_aggregates')
        .select('source_type, scores, tags, content, logged_at')
        .or(`tags.cs.{${query}},source_type.ilike.%${query}%`)
        .order('confidence', { ascending: false })
        .limit(maxResults);

      if (error || !data) return [];

      return data.map((row: any) => ({
        pagePath: `[community]/${row.source_type}`,
        snippet: `${row.content || ''} (Tags: ${row.tags.join(', ')})`,
        score: 0.8,
      }));
    } catch (err: any) {
      logger.warn(`[WikiSearch] community search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Search the global uber-wiki (personal knowledge base — user spec, projects, infra).
   * Always local; no Postgres fallback.
   */
  async searchUberWiki(query: string, maxResults: number = 2): Promise<WikiSnippet[]> {
    if (!fs.existsSync(UBER_WIKI_ROOT)) return [];
    try {
      const { stdout } = await execFileAsync(LLMWIKI_BIN, [
        'search', query,
        '--wiki-root', UBER_WIKI_ROOT,
      ], { timeout: 10000 });
      return this.parseLlmwikiOutput(stdout, maxResults).map(s => ({
        ...s,
        pagePath: `[uber-wiki]/${s.pagePath}`,
      }));
    } catch (err: any) {
      logger.warn(`[WikiSearch] uber-wiki search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Read a full wiki page by path.
   * Returns null if the page doesn't exist.
   */
  async read(userId: string, pagePath: string): Promise<string | null> {
    try {
      if (await this.isLlmwikiAvailable()) {
        return await this.readLlmwiki(userId, pagePath);
      }
      return await this.readPostgres(userId, pagePath);
    } catch (err: any) {
      logger.warn(`[WikiSearch] read failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Search using llmwiki binary (Tantivy BM25 + usearch semantic hybrid).
   */
  private async searchLlmwiki(userId: string, query: string, maxResults: number): Promise<WikiSnippet[]> {
    const userWikiDir = `${WIKI_ROOT}/${userId}`;

    if (!fs.existsSync(userWikiDir)) {
      logger.info(`[WikiSearch] No wiki directory for ${userId} at ${userWikiDir}`);
      return [];
    }

    try {
      const { stdout } = await execFileAsync(LLMWIKI_BIN, [
        'search', query,
        '--wiki-root', userWikiDir,
      ], { timeout: 15000 });

      return this.parseLlmwikiOutput(stdout, maxResults);
    } catch (err: any) {
      // llmwiki may not have indexed this user yet
      logger.warn(`[WikiSearch] llmwiki search failed for ${userId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse llmwiki's structured text output into WikiSnippet objects.
   * Output format:
   *   [1] path/to/page.md (score: 0.94)
   *       Description line
   *       → match at: L67 "keyword"
   */
  private parseLlmwikiOutput(output: string, maxResults: number): WikiSnippet[] {
    const snippets: WikiSnippet[] = [];
    const lines = output.split('\n');
    let current: Partial<WikiSnippet> | null = null;

    for (const line of lines) {
      const resultMatch = line.match(/^\[(\d+)\]\s+(\S+)\s+\(score:\s+([\d.]+)\)/);
      if (resultMatch) {
        if (current && current.pagePath) {
          snippets.push(current as WikiSnippet);
        }
        current = {
          pagePath: resultMatch[2],
          score: parseFloat(resultMatch[3]),
          matchLocations: [],
        };
        continue;
      }

      if (current) {
        const locationMatch = line.match(/→\s+match at:\s+(.+)/);
        if (locationMatch) {
          current.matchLocations = (current.matchLocations || []).concat(locationMatch[1]);
        } else if (line.trim() && !line.startsWith('[') && !line.startsWith('No results') && !line.startsWith('=')) {
          current.snippet = (current.snippet || '') + ' ' + line.trim();
        }
      }
    }

    if (current && current.pagePath) {
      snippets.push(current as WikiSnippet);
    }

    return snippets.slice(0, maxResults);
  }

  /**
   * Read a full page via llmwiki.
   */
  private async readLlmwiki(userId: string, pagePath: string): Promise<string | null> {
    const userWikiDir = `${WIKI_ROOT}/${userId}`;

    if (!fs.existsSync(userWikiDir)) return null;

    try {
      const { stdout } = await execFileAsync(LLMWIKI_BIN, [
        'read', pagePath,
        '--wiki-root', userWikiDir,
      ], { timeout: 10000 });

      return stdout || null;
    } catch {
      return null;
    }
  }

  /**
   * Search using PostgreSQL FTS (Railway fallback).
   */
  private async searchPostgres(userId: string, query: string, maxResults: number): Promise<WikiSnippet[]> {
    const { data, error } = await supabase.rpc('wiki_search', {
      query_user_id: userId,
      search_query: query,
      max_results: maxResults,
    });

    if (error) {
      logger.warn(`[WikiSearch] PG FTS failed: ${error.message}`);
      return [];
    }

    return (data || []).map((row: any) => ({
      pagePath: row.page_path,
      snippet: row.snippet?.trim() || '',
      score: row.rank || 0,
    }));
  }

  /**
   * Read a full page from Postgres (Railway fallback).
   */
  private async readPostgres(userId: string, pagePath: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('axiom_wiki_pages')
      .select('content')
      .eq('user_id', userId)
      .eq('page_path', pagePath)
      .single();

    if (error || !data) return null;
    return data.content;
  }

  /**
   * Check if llmwiki binary is available on this machine.
   */
  private async isLlmwikiAvailable(): Promise<boolean> {
    try {
      await execFileAsync(LLMWIKI_BIN, ['--version'], { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

export default AxiomWikiSearchService;
