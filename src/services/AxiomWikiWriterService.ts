/**
 * Axiom Wiki Writer Service
 *
 * Called nightly during the unified scan. Takes the already-fetched userData
 * and asks the LLM to synthesize 5 dense wiki pages:
 *   - persona.md      — behavioral fingerprint, patterns, divergence
 *   - goals.md        — goal tree state, progress, blockers, patterns
 *   - recent_themes.md — top themes from notebook entries
 *   - mood_trends.md  — mood over time, correlations, triggers
 *   - narrative.md    — evolving life story, major transitions
 *
 * Each page is stored in axiom_wiki_pages (Postgres) for persistence and
 * indexed by llmwiki for token-efficient semantic search.
 *
 * One LLM call per user per night — replaces 15+ raw DB queries per call.
 */

import { supabase } from '../lib/supabaseClient';
import { AICoachingService, LLMProvider } from './AICoachingService';
import logger from '../utils/logger';

export interface WikiPage {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  tokenCount: number;
}

export interface WikiWriterResult {
  userId: string;
  pages: WikiPage[];
  llmUsed: boolean;
  error?: string;
}

// 5 pages that Axiom writes per user per night
const WIKI_PAGE_SPECS = [
  { path: 'persona.md',       description: 'behavioral fingerprint — life stage, true will, divergence, avoidance patterns' },
  { path: 'goals.md',         description: 'goal tree state — active goals, progress, blockers, recurrence patterns' },
  { path: 'recent_themes.md', description: 'top themes from recent notebook entries and diary entries' },
  { path: 'mood_trends.md',   description: 'mood trends over time — correlations, triggers, dominant emotions' },
  { path: 'narrative.md',     description: 'evolving life story — major transitions, identity shifts, long arcs' },
];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class AxiomWikiWriterService {
  private aiCoaching: AICoachingService;

  constructor() {
    this.aiCoaching = new AICoachingService();
  }

  /**
   * Generate all wiki pages for a user from their pre-fetched data.
   * One LLM call per user per night — not per page.
   */
  async writeAllPages(userId: string, userData: any): Promise<WikiWriterResult> {
    const result: WikiWriterResult = { userId, pages: [], llmUsed: false };

    try {
      const prompt = this.buildWikiPrompt(userData);
      const llmText = await this.aiCoaching.runWithFallback(prompt);
      result.llmUsed = true;

      const pages = this.parseWikiResponse(llmText);
      if (pages.length === 0) {
        throw new Error('LLM returned no valid wiki pages');
      }

      for (const page of pages) {
        page.tokenCount = estimateTokens(page.content);
        await this.savePage(userId, page);
        result.pages.push(page);
      }

      logger.info(`[WikiWriter] Wrote ${pages.length} pages for user ${userId} (LLM)`);
    } catch (err: any) {
      logger.warn(`[WikiWriter] LLM generation failed for ${userId}: ${err.message}. Falling back to algorithmic pages.`);

      // Algorithmic fallback — generate pages from data without LLM
      const pages = this.generateAlgorithmicPages(userData);
      for (const page of pages) {
        page.tokenCount = estimateTokens(page.content);
        await this.savePage(userId, page);
        result.pages.push(page);
      }

      result.error = err.message;
    }

    return result;
  }

  /**
   * Build the LLM prompt to generate all 5 wiki pages in one call.
   */
  private buildWikiPrompt(userData: any): string {
    const profile = userData.profile || {};
    const nodes = Array.isArray(userData.nodes) ? userData.nodes : [];
    const checkins = Array.isArray(userData.checkins) ? userData.checkins : [];
    const notebookEntries = Array.isArray(userData.notebookEntries) ? userData.notebookEntries : [];
    const diaryEntries = Array.isArray(userData.diaryEntries) ? userData.diaryEntries : [];
    const goalTree = userData.goalTree || {};
    const metrics = userData.metrics || {};

    const goalsSummary = nodes
      .filter((n: any) => n.name)
      .map((n: any) => `${n.name}: ${n.progress || 0}% (weight ${n.weight || 1})`)
      .join('\n');

    const recentMoods = checkins
      .filter((c: any) => c.mood)
      .slice(0, 14)
      .map((c: any) => `${c.checked_in_at?.slice(0, 10)}: ${c.mood}`)
      .join('\n');

    const topThemes = notebookEntries
      .filter((e: any) => e.title || e.content)
      .slice(0, 30)
      .map((e: any) => `${e.occurred_at?.slice(0, 10)}: ${e.title || '(note)'} [${e.domain || ''}]`)
      .join('\n');

    return `You are Axiom's wiki writer. Based on the user data below, write 5 concise wiki pages.

Each page: YAML frontmatter (title, description, confidence, tags) + dense markdown body.
Be specific. Reference real goal names, percentages, dates, mood values.

Write these pages:
1. persona.md — behavioral fingerprint, true will domains, divergence between stated and actual, avoidance patterns, peak energy, life stage
2. goals.md — each active goal, current progress %, momentum direction, blockers, recurring pattern
3. recent_themes.md — top 5-7 themes from recent entries, frequency, relevant domains
4. mood_trends.md — mood trajectory over time, correlations with activities/goals, triggers
5. narrative.md — what story is the user living right now? Major transitions, identity shifts, long arcs

Respond ONLY with valid JSON array:
[{"path":"persona.md","frontmatter":{"title":"...","description":"...","confidence":0.9,"tags":["..."]},"content":"# Persona\\n\\n..."}]

USER DATA:
Goals:
${goalsSummary || '(no goals)'}

Recent moods (14 days):
${recentMoods || '(no mood data)'}

Recent entries (30 days):
${topThemes || '(no entries)'}

Archetype: ${metrics?.archetype || 'unknown'}
Streak: ${metrics?.checkinStreak || 0}
Stagnation risk: ${metrics?.stagnationRisk || 0}%`;
  }

  /**
   * Parse LLM response into structured wiki pages.
   */
  private parseWikiResponse(text: string): WikiPage[] {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((p: any) => p.path && p.content)
        .map((p: any) => ({
          path: p.path,
          frontmatter: p.frontmatter || {},
          content: p.content,
          tokenCount: 0,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Algorithmic fallback — generate basic pages from data without LLM.
   */
  private generateAlgorithmicPages(userData: any): WikiPage[] {
    const nodes = Array.isArray(userData.nodes) ? userData.nodes : [];
    const metrics = userData.metrics || {};
    const checkins = Array.isArray(userData.checkins) ? userData.checkins : [];
    const notebookEntries = Array.isArray(userData.notebookEntries) ? userData.notebookEntries : [];

    const makePage = (path: string, title: string, description: string, confidence: number, tags: string[], content: string): WikiPage => ({
      path, tokenCount: 0,
      frontmatter: { title, description, confidence, tags },
      content,
    });

    return [
      makePage('persona.md', 'User Persona (algorithmic)',
        `Archetype: ${metrics?.archetype || 'unknown'}. ${nodes.length} goals tracked. ${metrics?.checkinStreak || 0}-day streak.`,
        0.5, ['persona', 'algorithmic'],
        `# Persona\n\nArchetype: ${metrics?.archetype || 'unknown'}\nStreak: ${metrics?.checkinStreak || 0} days\nGoals: ${nodes.filter((n: any) => n.name).map((n: any) => n.name).join(', ') || 'none'}\n`),
      makePage('goals.md', 'Goals (algorithmic)',
        `${nodes.filter((n: any) => n.progress < 100).length} active goals`,
        0.5, ['goals', 'algorithmic'],
        `# Goals\n\n${nodes.filter((n: any) => n.name).map((n: any) => `## ${n.name}\n- Progress: ${n.progress || 0}%\n- Weight: ${n.weight || 1}\n`).join('\n') || 'No goals found'}`),
      makePage('recent_themes.md', 'Recent Themes (algorithmic)',
        `${notebookEntries.length} recent entries`,
        0.4, ['themes', 'algorithmic'],
        `# Recent Themes\n\n${notebookEntries.slice(0, 10).map((e: any) => `- ${e.occurred_at?.slice(0, 10)}: ${e.title || e.content?.slice(0, 100) || '(empty)'}`).join('\n') || 'No entries'}`),
      makePage('mood_trends.md', 'Mood Trends (algorithmic)',
        `${checkins.filter((c: any) => c.mood).length} mood entries`,
        0.4, ['mood', 'algorithmic'],
        `# Mood Trends\n\n${checkins.filter((c: any) => c.mood).slice(0, 20).map((c: any) => `- ${c.checked_in_at?.slice(0, 10)}: ${c.mood}`).join('\n') || 'No mood data'}`),
      makePage('narrative.md', 'Narrative (algorithmic)',
        'Algorithmic placeholder — no LLM available for synthesis',
        0.2, ['narrative', 'algorithmic'],
        `# Narrative\n\n(Algorithmic fallback — no LLM was available to synthesize a narrative.)\n\nRecent activity summary:\n- ${checkins.length} check-ins\n- ${notebookEntries.length} notebook entries\n- ${nodes.filter((n: any) => n.name).length} goals tracked`),
    ];
  }

  /**
   * Save a single wiki page to Postgres.
   */
  private async savePage(userId: string, page: WikiPage): Promise<void> {
    const { error } = await supabase.from('axiom_wiki_pages').upsert({
      user_id: userId,
      page_path: page.path,
      frontmatter: page.frontmatter,
      content: page.content,
      token_count: page.tokenCount,
      generated_by: page.frontmatter.confidence && page.frontmatter.confidence >= 0.8 ? 'llm' : 'algorithm',
      version: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,page_path' });

    if (error) {
      logger.warn(`[WikiWriter] Failed to save ${page.path} for ${userId}: ${error.message}`);
    }
  }
}

export default AxiomWikiWriterService;
