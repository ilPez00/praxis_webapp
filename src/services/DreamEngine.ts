/**
 * DreamEngine — pattern-match community flows to generate variation proposals
 * for stalled goals. No LLM. PDCA-aware: goals in active Do/Check phase are
 * excluded — only real stalls get dreamed on.
 *
 * Sectorial: each ayuDomain (HEAL/CONSTRUCT/FABRICATE/STUDY/BOND) is processed
 * independently. Cron calls generateDreams(userId, sector) one sector per tick.
 *
 * Dynamic intervals per sector (stored in dream_schedule_<userId>):
 *   stallScore >= 0.8  → 2h  (>8 days no checkin)
 *   stallScore >= 0.5  → 4h  (>5 days)
 *   stallScore >= 0.3  → 8h  (>3 days)
 *   stallScore <  0.3  → skip (goal active — no dreaming needed)
 */

import { supabase } from '../lib/supabaseClient';
import { PRAXIS_ONTOLOGY } from '../models/PraxisOntology';
import { CommunityPool } from './CommunityPool';
import logger from '../utils/logger';
import { v4 as uuid } from 'uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DreamType = 'GOAL_RECOMBINE' | 'DOMAIN_SWAP' | 'PATTERN_HYPOTHESIS' | 'CONTEXT_REMAP';

export interface Dream {
  id: string;
  type: DreamType;
  proposal: string;
  sourceDomain: string;
  trigger: string;
  goalId: string;
  sector: string;           // ayuDomain this dream belongs to
  contextTrigger: string[];
  score: number;
  createdAt: string;
  dismissed: boolean;
}

interface StalledGoal {
  id: string;
  name: string;
  domain: string;
  ayuDomain: string;
  progress: number;
  daysSinceCheckin: number;
  stallScore: number;
}

export interface SectorState {
  domain: string;      // ayuDomain: HEAL / CONSTRUCT / FABRICATE / STUDY / BOND
  nextRunAt: number;   // ms timestamp
  urgency: number;     // 0–1, max stallScore of goals in this sector
  lastDreamCount: number;
}

export interface DreamSchedule {
  sectors: SectorState[];
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADJACENT_AYU: Record<string, string[]> = {
  HEAL:      ['CONSTRUCT', 'BOND', 'STUDY'],
  CONSTRUCT: ['FABRICATE', 'HEAL', 'STUDY'],
  FABRICATE: ['STUDY', 'CONSTRUCT', 'BOND'],
  STUDY:     ['FABRICATE', 'HEAL', 'CONSTRUCT'],
  BOND:      ['HEAL', 'STUDY', 'FABRICATE'],
};

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'have', 'will', 'from', 'not', 'are', 'was', 'its', 'per', 'day', 'week']);

// stallScore → ms until next dream attempt for this sector
function stallInterval(urgency: number): number {
  if (urgency >= 0.8) return 2 * 3600_000;   // 2h — severe stall
  if (urgency >= 0.5) return 4 * 3600_000;   // 4h
  if (urgency >= 0.3) return 8 * 3600_000;   // 8h — mild stall
  return 0;                                   // active — skip
}

// ---------------------------------------------------------------------------
// BM25-lite keyword scorer
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

function keywordScore(query: string, doc: string): number {
  const qTokens = tokenize(query).filter(t => !STOPWORDS.has(t));
  const dTokens = new Set(tokenize(doc).filter(t => !STOPWORDS.has(t)));
  if (qTokens.length === 0) return 0;
  let hits = 0;
  for (const t of qTokens) {
    if (dTokens.has(t)) hits++;
    else if ([...dTokens].some(dt => dt.startsWith(t) || t.startsWith(dt))) hits += 0.4;
  }
  return hits / qTokens.length;
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class DreamEngine {
  private pool = new CommunityPool();

  // -------------------------------------------------------------------------
  // PDCA signal detection — goals confirmed working by recent user behaviour
  // -------------------------------------------------------------------------

  private async getPdcaConfirmed(userId: string, goalIds: string[]): Promise<Set<string>> {
    if (goalIds.length === 0) return new Set();

    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
    const { data } = await supabase
      .from('checkins')
      .select('goal_node_id, grade, progress_delta, win_of_the_day')
      .eq('user_id', userId)
      .in('goal_node_id', goalIds)
      .gte('created_at', threeDaysAgo)
      .order('created_at', { ascending: false })
      .limit(goalIds.length * 5);

    const confirmed = new Set<string>();
    const seenGoals = new Set<string>();

    for (const c of (data || [])) {
      const gid: string = c.goal_node_id;
      if (seenGoals.has(gid)) continue;
      seenGoals.add(gid);

      const goodGrade = (c.grade ?? 0) >= 0.7;
      const improving  = (c.progress_delta ?? 0) > 0.02;
      if (goodGrade || improving) confirmed.add(gid);
    }

    return confirmed;
  }

  // -------------------------------------------------------------------------
  // Profile user — active + stalled goals, PDCA-filtered
  // -------------------------------------------------------------------------

  private async profileUser(userId: string, sector?: string): Promise<StalledGoal[]> {
    const [treeRes, checkinRes] = await Promise.all([
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      supabase
        .from('checkins')
        .select('goal_node_id, created_at, grade, progress_delta')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const nodes: any[] = Array.isArray(treeRes.data?.nodes) ? treeRes.data.nodes : [];
    const checkins: any[] = checkinRes.data || [];
    const now = Date.now();

    const active = nodes.filter(n => (n.progress ?? 0) < 1 && n.status !== 'completed');
    const pdcaConfirmed = await this.getPdcaConfirmed(userId, active.map(n => n.id));

    const stalled: StalledGoal[] = [];

    for (const goal of active) {
      if (pdcaConfirmed.has(goal.id)) continue;  // working — don't dream on it

      const domain = goal.domain || this.inferDomain(goal.name);
      const ontoDef = PRAXIS_ONTOLOGY[domain as keyof typeof PRAXIS_ONTOLOGY];
      const ayuDomain = ontoDef?.ayuDomain ?? 'CONSTRUCT';

      if (sector && ayuDomain !== sector) continue;  // sectorial filter

      const gCheckins = checkins.filter(c => c.goal_node_id === goal.id);
      const lastMs = gCheckins[0]?.created_at ? new Date(gCheckins[0].created_at).getTime() : 0;
      const daysSince = lastMs ? (now - lastMs) / 86400_000 : 30;

      if (daysSince < 3) continue;  // not stalled

      const stallScore = Math.min(daysSince / 10, 1);
      stalled.push({ id: goal.id, name: goal.name, domain, ayuDomain, progress: goal.progress ?? 0, daysSinceCheckin: daysSince, stallScore });
    }

    return stalled.sort((a, b) => b.stallScore - a.stallScore).slice(0, 5);
  }

  private inferDomain(name: string): string {
    const lower = name.toLowerCase();
    for (const [domain, def] of Object.entries(PRAXIS_ONTOLOGY)) {
      if (def.contextHints.some(h => lower.includes(h))) return domain;
    }
    return 'KNOWLEDGE_SKILLS';
  }

  // -------------------------------------------------------------------------
  // Match community flows from adjacent domains
  // -------------------------------------------------------------------------

  private async matchFlows(goal: StalledGoal, limit = 4): Promise<Array<{ flow: any; score: number; sourceDomain: string }>> {
    const adjacentAyu = ADJACENT_AYU[goal.ayuDomain] ?? ['CONSTRUCT'];

    const results: Array<{ flow: any; score: number; sourceDomain: string }> = [];
    for (const ayu of adjacentAyu.slice(0, 2)) {
      const flows = await this.pool.retrieve(ayu, [0.5, 0.5, 0.5], limit * 2, 'generic');
      for (const f of flows) {
        const score = keywordScore(goal.name, `${f.will} ${f.action}`);
        results.push({ flow: f, score, sourceDomain: ayu });
      }
    }

    return results
      .sort((a, b) => b.score - a.score || Math.random() - 0.5)
      .slice(0, limit);
  }

  // -------------------------------------------------------------------------
  // Build dream from matched flow
  // -------------------------------------------------------------------------

  private buildDream(goal: StalledGoal, match: { flow: any; score: number; sourceDomain: string }, type: DreamType): Dream {
    const { flow, score, sourceDomain } = match;
    const ontoDef = PRAXIS_ONTOLOGY[goal.domain as keyof typeof PRAXIS_ONTOLOGY];

    let proposal: string;
    switch (type) {
      case 'GOAL_RECOMBINE':
        proposal = `"${goal.name}" reframed as "${flow.will}" — ${sourceDomain} approach, fresh energy.`;
        break;
      case 'DOMAIN_SWAP':
        proposal = `${goal.name} via ${sourceDomain}: ${flow.action}`;
        break;
      case 'PATTERN_HYPOTHESIS':
        proposal = `Others who paused "${goal.name}" rerouted via: ${flow.will}. Effect: ${flow.effect}`;
        break;
      case 'CONTEXT_REMAP':
      default: {
        const hints = Object.entries(PRAXIS_ONTOLOGY)
          .filter(([, d]) => d.ayuDomain === sourceDomain)
          .flatMap(([, d]) => d.contextHints)
          .slice(0, 4);
        proposal = `${goal.name} — anchor to: ${hints.join(', ')} (${sourceDomain} context shift)`;
      }
    }

    const contextTrigger = [
      ...tokenize(goal.name).filter(t => !STOPWORDS.has(t)).slice(0, 4),
      goal.ayuDomain.toLowerCase(),
      ...(ontoDef?.contextHints.slice(0, 2) ?? []),
    ];

    return {
      id: uuid(),
      type,
      proposal,
      sourceDomain,
      trigger: goal.name,
      goalId: goal.id,
      sector: goal.ayuDomain,
      contextTrigger,
      score: Math.min(goal.stallScore * 0.6 + score * 0.4, 1),
      createdAt: new Date().toISOString(),
      dismissed: false,
    };
  }

  // -------------------------------------------------------------------------
  // Generate + store (per sector)
  // -------------------------------------------------------------------------

  async generateDreams(userId: string, sector?: string): Promise<Dream[]> {
    const stalled = await this.profileUser(userId, sector);

    if (stalled.length === 0) {
      logger.info(`[DreamEngine] No stalled goals for ${userId}${sector ? ` sector=${sector}` : ''}`);
      // Clear sector schedule if nothing to dream about
      if (sector) await this.clearSector(userId, sector);
      return [];
    }

    const typeSeq: DreamType[] = ['GOAL_RECOMBINE', 'PATTERN_HYPOTHESIS', 'DOMAIN_SWAP', 'CONTEXT_REMAP'];
    const newDreams: Dream[] = [];

    for (const goal of stalled) {
      const matches = await this.matchFlows(goal, 2);
      for (let i = 0; i < matches.length; i++) {
        newDreams.push(this.buildDream(goal, matches[i], typeSeq[i % typeSeq.length]));
      }
    }

    // Merge with existing dreams — keep existing non-dismissed, add new ones
    const existing = await this.getDreams(userId);
    const existingIds = new Set(existing.map(d => d.goalId + d.type));
    const toAdd = newDreams.filter(d => !existingIds.has(d.goalId + d.type));
    const merged = [...existing, ...toAdd]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);  // cap total at 20 across all sectors

    await this.storeDreams(userId, merged);
    await this.updateSectorSchedule(userId, sector, stalled);

    logger.info(`[DreamEngine] user=${userId} sector=${sector ?? 'all'} +${toAdd.length} dreams (${stalled.length} stalled goals)`);
    return toAdd;
  }

  // -------------------------------------------------------------------------
  // Schedule management — dynamic per-sector intervals
  // -------------------------------------------------------------------------

  private scheduleKey(userId: string): string { return `dream_schedule_${userId}`; }
  private storageKey(userId: string): string  { return `dreams_${userId}`; }

  async getSchedule(userId: string): Promise<DreamSchedule> {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', this.scheduleKey(userId))
      .maybeSingle();
    return (data?.value as DreamSchedule) ?? { sectors: [], updatedAt: 0 };
  }

  private async updateSectorSchedule(userId: string, sector: string | undefined, stalled: StalledGoal[]): Promise<void> {
    const schedule = await this.getSchedule(userId);
    const now = Date.now();

    // Group stalled goals by ayuDomain to get per-sector urgency
    const sectorUrgency = new Map<string, number>();
    for (const g of stalled) {
      const cur = sectorUrgency.get(g.ayuDomain) ?? 0;
      sectorUrgency.set(g.ayuDomain, Math.max(cur, g.stallScore));
    }

    const updatedSectors = [...schedule.sectors.filter(s => !sectorUrgency.has(s.domain))];

    for (const [domain, urgency] of sectorUrgency) {
      const interval = stallInterval(urgency);
      updatedSectors.push({
        domain,
        nextRunAt: now + interval,
        urgency,
        lastDreamCount: stalled.filter(g => g.ayuDomain === domain).length,
      });
    }

    const newSchedule: DreamSchedule = { sectors: updatedSectors, updatedAt: now };
    await supabase.from('system_config').upsert(
      { key: this.scheduleKey(userId), value: newSchedule },
      { onConflict: 'key' }
    );
  }

  private async clearSector(userId: string, sector: string): Promise<void> {
    const schedule = await this.getSchedule(userId);
    const updated = {
      sectors: schedule.sectors.filter(s => s.domain !== sector),
      updatedAt: Date.now(),
    };
    await supabase.from('system_config').upsert(
      { key: this.scheduleKey(userId), value: updated },
      { onConflict: 'key' }
    );
  }

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------

  async storeDreams(userId: string, dreams: Dream[]): Promise<void> {
    const { error } = await supabase
      .from('system_config')
      .upsert({ key: this.storageKey(userId), value: dreams }, { onConflict: 'key' });
    if (error) logger.warn(`[DreamEngine] Store failed: ${error.message}`);
  }

  async getDreams(userId: string, contextTags?: string[]): Promise<Dream[]> {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', this.storageKey(userId))
      .maybeSingle();

    const all: Dream[] = (data?.value as Dream[]) ?? [];
    const active = all.filter(d => !d.dismissed);

    if (!contextTags || contextTags.length === 0) return active;

    const tagSet = new Set(contextTags.map(t => t.toLowerCase()));
    const relevant = active.filter(d => d.contextTrigger.some(t => tagSet.has(t)));
    return relevant.length > 0 ? relevant : active.slice(0, 2);
  }

  async dismissDream(userId: string, dreamId: string): Promise<void> {
    const all = await this.getDreams(userId);
    await this.storeDreams(userId, all.map(d => d.id === dreamId ? { ...d, dismissed: true } : d));
  }

  /**
   * Context injection for Axiom — top 2 relevant dreams as formatted block.
   */
  async getDreamContext(userId: string, topic: string): Promise<string | null> {
    const tags = tokenize(topic).filter(t => !STOPWORDS.has(t));
    const dreams = await this.getDreams(userId, tags);
    if (dreams.length === 0) return null;

    return `[DREAM PROPOSALS — variation patterns for stalled goals]\n` +
      dreams.slice(0, 2).map(d => `• ${d.proposal} (type: ${d.type})`).join('\n');
  }

  /**
   * Bootstrap schedule for a user — call once on first morning brief / login.
   * Profiles all sectors and sets up initial intervals without generating dreams yet.
   */
  async bootstrapSchedule(userId: string): Promise<void> {
    const existing = await this.getSchedule(userId);
    if (existing.sectors.length > 0) return;  // already bootstrapped

    // Profile without sector filter to get all stalled goals
    const stalled = await this.profileUser(userId);
    if (stalled.length === 0) return;

    await this.updateSectorSchedule(userId, undefined, stalled);
    logger.info(`[DreamEngine] Bootstrap schedule for ${userId}: ${[...new Set(stalled.map(g => g.ayuDomain))].join(', ')}`);
  }
}

export const dreamEngine = new DreamEngine();
