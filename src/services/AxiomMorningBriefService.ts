/**
 * AxiomMorningBriefService
 *
 * Generates a structured, behavioral morning brief — not a diary summary.
 * Uses goal tree + check-in history + ACT stats to produce:
 *   - Priority goal + concrete action with metric
 *   - One-sentence behavioral context (streak/stagnation/deadline)
 *   - Secondary goal action
 *   - Pattern alert if stagnation or deadline critical
 *
 * Called by GET /axiom/morning-brief. Aura polls this at 7am.
 */

import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import { PRAXIS_ONTOLOGY } from '../models/PraxisOntology';
import { Domain } from '../models/Domain';
import { dreamEngine } from './DreamEngine';
import logger from '../utils/logger';

interface ScoredGoal {
  id: string;
  name: string;
  domain: string;
  progress: number;
  deadline?: string;
  consistency: number;     // check-ins per day last 7 days
  avgGrade: number;        // 0–1
  daysSinceCheckin: number;
  daysToDeadline: number;
  urgency: number;         // composite score — higher = needs attention sooner
}

export interface MorningBrief {
  date: string;
  priority: { id: string; name: string; domain: string; progress: number; deadline?: string };
  action: string;
  why: string;
  secondary?: string;
  patternAlert?: string;
  dreamProposal?: string;  // variation pattern from DreamEngine (only for stalled goals)
  meta: { consistency: number; daysSinceCheckin: number; daysToDeadline: number };
}

export class AxiomMorningBriefService {
  private ai = new AICoachingService();

  async generate(userId: string): Promise<MorningBrief | null> {
    try {
      // Bootstrap dream schedule lazily on first brief (fire-and-forget)
      dreamEngine.bootstrapSchedule(userId).catch(() => {});

      const [tree, checkinData] = await Promise.all([
        supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
        supabase
          .from('checkins')
          .select('goal_node_id, created_at, progress_delta, grade')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const nodes: any[] = Array.isArray(tree.data?.nodes) ? tree.data.nodes : [];
      const active = nodes.filter(n => (n.progress ?? 0) < 1 && n.status !== 'completed');
      if (active.length === 0) return null;

      const checkins = checkinData.data || [];
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;

      const scored: ScoredGoal[] = active.map(goal => {
        const gCheckins = checkins.filter(c => c.goal_node_id === goal.id);
        const recent = gCheckins.filter(c => new Date(c.created_at).getTime() > sevenDaysAgo);
        const consistency = recent.length / 7;
        const avgGrade = gCheckins.length > 0
          ? gCheckins.slice(0, 10).reduce((s, c) => s + (c.grade ?? 0.5), 0) / Math.min(gCheckins.length, 10)
          : 0.5;

        const lastCheckinMs = gCheckins[0]?.created_at
          ? new Date(gCheckins[0].created_at).getTime()
          : 0;
        const daysSinceCheckin = lastCheckinMs ? (now - lastCheckinMs) / 86400000 : 999;

        const daysToDeadline = goal.deadline
          ? (new Date(goal.deadline).getTime() - now) / 86400000
          : 999;

        let urgency = 0;
        if (daysSinceCheckin > 3) urgency += 3;
        if (daysSinceCheckin > 7) urgency += 3;
        if (daysToDeadline < 7)  urgency += 5;
        if (daysToDeadline < 14) urgency += 2;
        if ((goal.progress ?? 0) < 0.3) urgency += 2;
        if (consistency < 0.3) urgency += 2; // < 2 check-ins/week

        return {
          id: goal.id,
          name: goal.name || 'Unnamed goal',
          domain: goal.domain || '',
          progress: goal.progress ?? 0,
          deadline: goal.deadline,
          consistency,
          avgGrade,
          daysSinceCheckin,
          daysToDeadline,
          urgency,
        };
      });

      scored.sort((a, b) => b.urgency - a.urgency);
      const top = scored[0];
      const second = scored[1];

      const domainDef = PRAXIS_ONTOLOGY[top.domain as Domain];
      const stagnating = top.daysSinceCheckin > 5;
      const deadlineCritical = top.daysToDeadline < 7;

      const prompt = `You are Axiom. Output a morning brief in EXACTLY this format — no extra text, no markdown:

ACTION: [one concrete sentence with specific metric. Examples: "5×5 barbell squat at 82.5kg", "Write 500 words of chapter 3", "30min box breathing — 4-7-8 pattern, 4 cycles". Match the unit: ${domainDef?.unit ?? 'sessions'}]
WHY: [one sentence referencing data below — direct, no encouragement]
SECONDARY: [one action sentence for the second goal, or skip if none]
${stagnating || deadlineCritical ? 'ALERT: [one sentence pattern warning]' : ''}

DATA:
GOAL: "${top.name}"
DOMAIN: ${top.domain || 'GENERAL'} → ${domainDef?.ayuDomain ?? '?'} / ${domainDef?.defaultMode ?? '?'}
PROGRESS: ${Math.round(top.progress * 100)}%
DEADLINE: ${top.daysToDeadline < 900 ? `${Math.round(top.daysToDeadline)} days` : 'none'}
DAYS SINCE LAST CHECK-IN: ${top.daysSinceCheckin < 900 ? Math.round(top.daysSinceCheckin) : 'never checked in'}
WEEKLY CONSISTENCY: ${Math.round(top.consistency * 7 * 10) / 10} sessions/week
AVG GRADE: ${Math.round(top.avgGrade * 100)}%
${stagnating ? '⚠ STAGNATION: no check-in for 5+ days' : ''}
${deadlineCritical ? '⚠ DEADLINE CRITICAL: under 7 days remaining' : ''}
SECONDARY GOAL: ${second ? `"${second.name}" | domain: ${second.domain} | progress: ${Math.round(second.progress * 100)}%` : 'none'}`;

      const response = await this.ai.runWithFallback(prompt);
      const lines = response.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const get = (prefix: string) => {
        const l = lines.find(l => l.startsWith(prefix));
        return l ? l.slice(prefix.length).trim() : '';
      };

      const action = get('ACTION:');
      const why = get('WHY:');
      if (!action) {
        // Fallback: return raw response as action
        return this.buildFallback(top, second, response);
      }

      // Inject dream proposal for stalled goals (>3 days without checkin)
      let dreamProposal: string | undefined;
      if (top.daysSinceCheckin > 3) {
        dreamProposal = (await dreamEngine.getDreamContext(userId, top.name)) ?? undefined;
      }

      return {
        date: new Date().toISOString().slice(0, 10),
        priority: { id: top.id, name: top.name, domain: top.domain, progress: top.progress, deadline: top.deadline },
        action,
        why: why || `${top.name} at ${Math.round(top.progress * 100)}% — check in to maintain momentum.`,
        secondary: get('SECONDARY:') || undefined,
        patternAlert: get('ALERT:') || undefined,
        dreamProposal,
        meta: {
          consistency: top.consistency,
          daysSinceCheckin: top.daysSinceCheckin,
          daysToDeadline: top.daysToDeadline,
        },
      };
    } catch (err) {
      logger.error('[AxiomMorningBrief] Failed:', err);
      return null;
    }
  }

  private buildFallback(top: ScoredGoal, second: ScoredGoal | undefined, rawResponse: string): MorningBrief {
    const domainDef = PRAXIS_ONTOLOGY[top.domain as Domain];
    return {
      date: new Date().toISOString().slice(0, 10),
      priority: { id: top.id, name: top.name, domain: top.domain, progress: top.progress, deadline: top.deadline },
      action: rawResponse.slice(0, 200) || `Complete one ${domainDef?.unit ?? 'session'} of "${top.name}"`,
      why: `${Math.round(top.consistency * 7 * 10) / 10} sessions this week. ${top.daysSinceCheckin < 900 ? `Last check-in ${Math.round(top.daysSinceCheckin)} days ago.` : ''}`,
      secondary: second ? `Work on "${second.name}" (${Math.round(second.progress * 100)}% done)` : undefined,
      patternAlert: top.daysSinceCheckin > 5 ? `No check-in for ${Math.round(top.daysSinceCheckin)} days on "${top.name}" — stagnation risk.` : undefined,
      meta: { consistency: top.consistency, daysSinceCheckin: top.daysSinceCheckin, daysToDeadline: top.daysToDeadline },
    };
  }
}
