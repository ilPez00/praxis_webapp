/**
 * RachmachinovOrchestrator — central context broker for the AYU stack.
 *
 * Three responsibilities:
 *   1. assembleContext(userId, query)  — compact goal+wiki+dream snapshot for Aura
 *   2. onCheckin(userId, goalId, grade, delta) — PDCA signal hook; pushes sterile flows on success
 *   3. getCommunityPatterns(sector, k) — community flows feed for Aura's local DreamEngine
 *
 * Consumed by: rachmaninov routes (HTTP), AxiomMorningBriefService, AxiomScanService
 */

import { supabase } from '../lib/supabaseClient';
import { PRAXIS_ONTOLOGY } from '../models/PraxisOntology';
import { CommunityPool, SterileFlow } from './CommunityPool';
import { dreamEngine } from './DreamEngine';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export interface GoalSnapshot {
  id: string;
  name: string;
  domain: string;
  ayuDomain: string;
  progress: number;           // 0–1
  deadline?: string;
  daysSinceCheckin: number;
  avgGrade: number;           // 0–1, last 10 checkins
  urgency: number;            // composite score
  stallScore: number;         // 0–1
}

export interface WikiSnippet {
  path: string;
  title: string;
  snippet: string;            // ≤200 chars
  score: number;
}

export interface DreamSnippet {
  goalId: string;
  goalName: string;
  proposal: string;
  type: string;
  score: number;
}

export interface OrchestratorContext {
  userId: string;
  query: string;
  assembledAt: string;
  goals: GoalSnapshot[];       // top 5 by urgency
  wiki: WikiSnippet[];         // top 3 relevant wiki pages
  dreams: DreamSnippet[];      // active dreams for stalled goals
  userOntology: Record<string, { ayuDomain: string; unit: string; contextHints: string[] }>;
  tokenEstimate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'have', 'will', 'from', 'not', 'are', 'was', 'its', 'per', 'day', 'week', 'you', 'your']);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function kwScore(query: string, doc: string): number {
  const qTok = tokenize(query);
  const dTok = new Set(tokenize(doc));
  if (qTok.length === 0) return 0;
  let hits = 0;
  for (const t of qTok) {
    if (dTok.has(t)) hits++;
    else if ([...dTok].some(dt => dt.startsWith(t) || t.startsWith(dt))) hits += 0.4;
  }
  return hits / qTok.length;
}

async function getUserOntologyOverrides(userId: string): Promise<Record<string, any>> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', `rachmaninov_overrides_${userId}`)
      .maybeSingle();
    return (data?.value as any) ?? {};
  } catch { return {}; }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class RachmachinovOrchestrator {
  private pool = new CommunityPool();

  // ---- 1. assembleContext -------------------------------------------------

  async assembleContext(userId: string, query: string): Promise<OrchestratorContext> {
    const now = Date.now();

    const [treeRes, checkinRes, wikiRes, overrides] = await Promise.all([
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      supabase
        .from('checkins')
        .select('goal_node_id, created_at, grade, progress_delta')
        .eq('user_id', userId)
        .gte('created_at', new Date(now - 30 * 86400_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('axiom_wiki_pages')
        .select('page_path, frontmatter, content, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20),
      getUserOntologyOverrides(userId),
    ]);

    const nodes: any[] = Array.isArray(treeRes.data?.nodes) ? treeRes.data.nodes : [];
    const checkins: any[] = checkinRes.data || [];
    const pages: any[] = wikiRes.data || [];

    // -- Goals snapshot --
    const active = nodes.filter(n => (n.progress ?? 0) < 1 && n.status !== 'completed');
    const sevenAgo = now - 7 * 86400_000;

    const goals: GoalSnapshot[] = active.map(goal => {
      const gCheckins = checkins.filter(c => c.goal_node_id === goal.id);
      const recent7   = gCheckins.filter(c => new Date(c.created_at).getTime() > sevenAgo);
      const avgGrade  = gCheckins.length > 0
        ? gCheckins.slice(0, 10).reduce((s, c) => s + (c.grade ?? 0.5), 0) / Math.min(gCheckins.length, 10)
        : 0.5;
      const lastMs    = gCheckins[0]?.created_at ? new Date(gCheckins[0].created_at).getTime() : 0;
      const daysSince = lastMs ? (now - lastMs) / 86400_000 : 999;
      const stallScore = Math.min(daysSince / 10, 1);
      const daysToDeadline = goal.deadline
        ? (new Date(goal.deadline).getTime() - now) / 86400_000
        : 999;

      let urgency = 0;
      if (daysSince > 3)  urgency += 3;
      if (daysSince > 7)  urgency += 3;
      if (daysToDeadline < 7)  urgency += 5;
      if (daysToDeadline < 14) urgency += 2;
      if ((goal.progress ?? 0) < 0.3) urgency += 2;
      if (recent7.length < 2) urgency += 2;

      const ontoDef  = PRAXIS_ONTOLOGY[goal.domain as keyof typeof PRAXIS_ONTOLOGY];
      const ov       = overrides[goal.domain] ?? {};
      const ayuDomain = ov.ayuDomain ?? ontoDef?.ayuDomain ?? 'CONSTRUCT';

      return {
        id: goal.id,
        name: goal.name || 'Unnamed goal',
        domain: goal.domain || '',
        ayuDomain,
        progress: goal.progress ?? 0,
        deadline: goal.deadline,
        daysSinceCheckin: daysSince,
        avgGrade,
        urgency,
        stallScore,
      };
    });

    goals.sort((a, b) => b.urgency - a.urgency);
    const topGoals = goals.slice(0, 5);

    // -- Wiki snippets ranked by query relevance --
    const wikis: WikiSnippet[] = pages
      .map(p => {
        const title   = p.frontmatter?.title || p.page_path.replace('.md', '');
        const content = p.content || '';
        const snippet = content.slice(0, 400);
        const score   = kwScore(query, `${title} ${snippet}`);
        return { path: p.page_path, title, snippet: snippet.slice(0, 200), score };
      })
      .filter(w => w.score > 0 || pages.length <= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // -- Dream snippets for stalled goals (non-blocking; silent fail) --
    let dreamSnippets: DreamSnippet[] = [];
    try {
      const stalledIds = topGoals.filter(g => g.stallScore >= 0.3).map(g => g.id);
      if (stalledIds.length > 0) {
        const dreamContext = await dreamEngine.getDreams(userId);
        const activeDreams = dreamContext.filter(d => !d.dismissed && stalledIds.includes(d.goalId));
        dreamSnippets = activeDreams.slice(0, 3).map(d => ({
          goalId:   d.goalId,
          goalName: d.trigger,
          proposal: d.proposal,
          type:     d.type,
          score:    d.score,
        }));
      }
    } catch (e: any) {
      logger.warn('[Orchestrator] Dream fetch failed:', e.message);
    }

    // -- Merged user ontology (global + user overrides) --
    const userOntology = Object.fromEntries(
      Object.entries(PRAXIS_ONTOLOGY).map(([domain, def]) => {
        const ov = overrides[domain] ?? {};
        return [domain, {
          ayuDomain:    ov.ayuDomain    ?? def.ayuDomain,
          unit:         ov.unit         ?? def.unit,
          contextHints: ov.contextHints ?? def.contextHints,
        }];
      })
    );

    const tokenEstimate = Math.round(
      (JSON.stringify(topGoals).length + JSON.stringify(wikis).length + JSON.stringify(dreamSnippets).length) / 4
    );

    return {
      userId,
      query,
      assembledAt: new Date().toISOString(),
      goals:       topGoals,
      wiki:        wikis,
      dreams:      dreamSnippets,
      userOntology,
      tokenEstimate,
    };
  }

  // ---- Formatted context block for LLM injection -------------------------

  formatContextBlock(ctx: OrchestratorContext): string {
    const lines: string[] = ['[RACHMANINOV CONTEXT]'];

    if (ctx.goals.length > 0) {
      lines.push('GOALS:');
      for (const g of ctx.goals) {
        const deadline = g.deadline ? ` deadline=${g.deadline}` : '';
        const stall    = g.stallScore >= 0.3 ? ` stall=${Math.round(g.stallScore * 100)}%` : '';
        lines.push(`  ${g.name} [${g.domain}/${g.ayuDomain}] progress=${Math.round(g.progress * 100)}%${deadline}${stall}`);
      }
    }

    if (ctx.wiki.length > 0) {
      lines.push('WIKI:');
      for (const w of ctx.wiki) {
        lines.push(`  [${w.title}] ${w.snippet}`);
      }
    }

    if (ctx.dreams.length > 0) {
      lines.push('DREAM PROPOSALS:');
      for (const d of ctx.dreams) {
        lines.push(`  [${d.type}] ${d.proposal}`);
      }
    }

    lines.push('[/RACHMANINOV CONTEXT]');
    return lines.join('\n');
  }

  // ---- 2. onCheckin -------------------------------------------------------

  /**
   * Called after every checkin. Two effects:
   *   - If grade >= 0.85 AND progress >= 1.0 → goal succeeded: push sterile flow to community_flows
   *   - If grade >= 0.7 → suppress dreaming on this goal (PDCA confirms it's working);
   *     dream schedule for this sector gets bumped by 8h to avoid needless re-runs
   */
  async onCheckin(
    userId: string,
    goalId: string,
    goalName: string,
    goalDomain: string,
    grade: number,
    progressDelta: number,
    currentProgress: number,
    recentAction?: string,
  ): Promise<{ pushed: boolean; dreamSuppressed: boolean }> {
    let pushed = false;
    let dreamSuppressed = false;

    const ontoDef = PRAXIS_ONTOLOGY[goalDomain as keyof typeof PRAXIS_ONTOLOGY];
    const ayuDomain = ontoDef?.ayuDomain ?? 'CONSTRUCT';

    // Push sterile flow on goal success
    if (grade >= 0.85 && currentProgress >= 1.0) {
      try {
        const flow: SterileFlow = {
          will:    goalName.slice(0, 120),
          action:  recentAction?.slice(0, 200) ?? `Completed ${goalName}`,
          effect:  `Progress reached 100% (grade ${Math.round(grade * 10)}/10)`,
          grade:   String(Math.round(grade * 10)),
          outcome: 'SUCCEEDED',
          domain:  ayuDomain,
        };
        await this.pool.push(flow, ayuDomain);
        pushed = true;
        logger.info(`[Orchestrator] Sterile flow pushed for goal ${goalId} (${ayuDomain})`);
      } catch (e: any) {
        logger.warn('[Orchestrator] Failed to push sterile flow:', e.message);
      }
    }

    // Suppress dreaming if goal is confirmed working (grade >= 0.7)
    if (grade >= 0.7) {
      try {
        const schedule = await dreamEngine.getSchedule(userId);
        const sector = schedule?.sectors.find(s => s.domain === ayuDomain);
        if (sector) {
          // Bump nextRunAt by 8h — PDCA confirms this sector is active
          const bumped = { ...sector, nextRunAt: Date.now() + 8 * 3600_000, urgency: Math.max(0, sector.urgency - 0.2) };
          const updated = {
            ...schedule,
            sectors: schedule.sectors.map(s => s.domain === ayuDomain ? bumped : s),
            updatedAt: Date.now(),
          };
          await supabase.from('system_config').upsert({
            key: `dream_schedule_${userId}`,
            value: updated,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });
          dreamSuppressed = true;
        }
      } catch (e: any) {
        logger.warn('[Orchestrator] Dream suppression failed:', e.message);
      }
    }

    return { pushed, dreamSuppressed };
  }

  // ---- 3. getCommunityPatterns -------------------------------------------

  /**
   * Returns k sterile flows for a given ayuDomain sector.
   * Used by Aura's local DreamEngine to seed its offline BM25 corpus.
   * If sector is omitted, returns a mix across all domains.
   */
  async getCommunityPatterns(sector?: string, k = 20): Promise<SterileFlow[]> {
    const domains = sector
      ? [sector]
      : ['HEAL', 'CONSTRUCT', 'FABRICATE', 'STUDY', 'BOND'];

    const perDomain = Math.ceil(k / domains.length);
    const results: SterileFlow[] = [];

    for (const d of domains) {
      try {
        const flows = await this.pool.retrieve(d, [0.5, 0.5, 0.5], perDomain, 'generic');
        results.push(...flows);
      } catch (e: any) {
        logger.warn(`[Orchestrator] getCommunityPatterns fetch failed for ${d}:`, e.message);
      }
    }

    return results.slice(0, k);
  }
}

// Singleton
export const rachmachinovOrchestrator = new RachmachinovOrchestrator();
