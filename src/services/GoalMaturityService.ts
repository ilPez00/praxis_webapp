/**
 * GoalMaturityService — implements the four autopoietic loops from ayu.md.
 *
 * Maturity progression: PERSONAL → SPECULATIVE → CANDIDATE → VALIDATED → COMMUNITY
 *
 * Loop 1: Execution-Grade Feedback     — act, grade, adjust weight
 * Loop 2: Collaborative Validation     — shared goals compare outcomes
 * Loop 3: Belief Erosion Detection     — 30-day checkpoints, dormancy on silence
 * Loop 4: Grade-Reality Correction     — external signals vs self-grade divergence
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export type MaturityLevel = 'PERSONAL' | 'SPECULATIVE' | 'CANDIDATE' | 'VALIDATED' | 'COMMUNITY';

const MATURITY_THRESHOLDS = {
  SPECULATIVE: { minActions: 3,  minAvgGrade: 0.5 },
  CANDIDATE:   { minActions: 10, minAvgGrade: 0.6, minCollaborators: 1 },
  VALIDATED:   { minActions: 25, minAvgGrade: 0.7, minCollaborators: 2, externalConfirmed: 1 },
  COMMUNITY:   { minActions: 50, minAvgGrade: 0.75, minCollaborators: 3, externalConfirmed: 3 },
};

const DORMANCY_DAYS    = 30;
const CHECKPOINT_DAYS  = 30;
const DIVERGENCE_THRESHOLD = 0.3;

export class GoalMaturityService {

  /**
   * Main entry point — call after each action record is created.
   * Runs all four loops for the goal linked to the action.
   */
  async evaluateAfterAction(userId: string, goalId: string | null, actionId: string): Promise<void> {
    if (!goalId) return;
    try {
      await this.ensureMaturityRecord(userId, goalId);
      await this.runLoop1(userId, goalId);
      await this.runLoop3(userId, goalId);
      await this.runLoop4(userId, goalId);
      await this.advanceMaturityIfEligible(userId, goalId);
    } catch (err) {
      logger.error('GoalMaturityService.evaluateAfterAction failed', { userId, goalId, err });
    }
  }

  /** Loop 1: Execution-Grade Feedback — recalculate grade trend for this goal. */
  private async runLoop1(userId: string, goalId: string): Promise<void> {
    const { data: actions } = await supabase
      .from('action_records')
      .select('grade, timestamp')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .not('grade', 'is', null)
      .order('timestamp', { ascending: true });

    if (!actions?.length) return;

    const grades = actions.map((a: any) => a.grade as number);
    const avgGrade = grades.reduce((s, g) => s + g, 0) / grades.length;

    // Linear trend: slope of grade over time (positive = improving)
    let gradeTrend = 0;
    if (grades.length >= 3) {
      const n = grades.length;
      const xMean = (n - 1) / 2;
      const yMean = avgGrade;
      let num = 0, den = 0;
      grades.forEach((g, i) => { num += (i - xMean) * (g - yMean); den += (i - xMean) ** 2; });
      gradeTrend = den !== 0 ? num / den : 0;
    }

    await supabase
      .from('goal_maturity')
      .update({
        action_count: actions.length,
        avg_grade: avgGrade,
        grade_trend: gradeTrend,
        last_action_at: new Date().toISOString(),
        dormant: false,
        dormant_since: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('goal_id', goalId);
  }

  /** Loop 3: Belief Erosion Detection — mark dormant if no action in 30 days; schedule checkpoint. */
  async runDormancyCheck(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - DORMANCY_DAYS * 86400_000).toISOString();

    const { data: stale } = await supabase
      .from('goal_maturity')
      .select('goal_id, last_action_at')
      .eq('user_id', userId)
      .eq('dormant', false)
      .or(`last_action_at.lt.${cutoff},last_action_at.is.null`);

    if (!stale?.length) return;

    const now = new Date().toISOString();
    for (const row of stale) {
      await supabase
        .from('goal_maturity')
        .update({ dormant: true, dormant_since: now, updated_at: now })
        .eq('user_id', userId)
        .eq('goal_id', row.goal_id);
    }
    logger.info(`Dormancy: marked ${stale.length} goals dormant for user ${userId}`);
  }

  private async runLoop3(userId: string, goalId: string): Promise<void> {
    const nextCheckpoint = new Date(Date.now() + CHECKPOINT_DAYS * 86400_000).toISOString();
    await supabase
      .from('goal_maturity')
      .update({ checkpoint_due: nextCheckpoint, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('goal_id', goalId);
  }

  /** Loop 4: Grade-Reality Correction — compare self-grade vs external_signals confidence. */
  private async runLoop4(userId: string, goalId: string): Promise<void> {
    const { data: actions } = await supabase
      .from('action_records')
      .select('grade, external_signals')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .not('grade', 'is', null);

    if (!actions?.length) return;

    const grades = actions.map((a: any) => a.grade as number);
    const avgGrade = grades.reduce((s, g) => s + g, 0) / grades.length;

    // Flatten external signal confidences across all actions
    const signals: number[] = [];
    for (const action of actions) {
      const sigs: any[] = action.external_signals ?? [];
      sigs.forEach((s: any) => { if (typeof s.confidence === 'number') signals.push(s.confidence); });
    }
    if (!signals.length) return;

    const avgSignal = signals.reduce((s, c) => s + c, 0) / signals.length;
    const divergence = Math.abs(avgGrade - avgSignal);

    // Imposter: grades high (≥0.7) but external signals low (≤0.4)
    const imposter    = avgGrade >= 0.7 && avgSignal <= 0.4;
    // Delusional: grades low (≤0.4) but external signals high (≥0.7)
    const delusional  = avgGrade <= 0.4 && avgSignal >= 0.7;

    await supabase
      .from('goal_maturity')
      .update({ signal_divergence: divergence, imposter_flag: imposter, delusional_flag: delusional, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('goal_id', goalId);
  }

  /** Advance maturity level if thresholds are met. */
  private async advanceMaturityIfEligible(userId: string, goalId: string): Promise<void> {
    const { data: row } = await supabase
      .from('goal_maturity')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .single();

    if (!row) return;

    const { data: actions } = await supabase
      .from('action_records')
      .select('collaborators, external_signals')
      .eq('user_id', userId)
      .eq('goal_id', goalId);

    const collaboratorSet = new Set<string>();
    let externalConfirmedCount = 0;
    for (const a of (actions ?? [])) {
      (a.collaborators ?? []).forEach((c: string) => collaboratorSet.add(c));
      (a.external_signals ?? []).forEach((s: any) => {
        if (s.verdict === 'CONFIRMED') externalConfirmedCount++;
      });
    }

    const current: MaturityLevel = row.maturity;
    let next: MaturityLevel | null = null;

    if (current === 'PERSONAL') {
      const t = MATURITY_THRESHOLDS.SPECULATIVE;
      if (row.action_count >= t.minActions && (row.avg_grade ?? 0) >= t.minAvgGrade) next = 'SPECULATIVE';
    } else if (current === 'SPECULATIVE') {
      const t = MATURITY_THRESHOLDS.CANDIDATE;
      if (row.action_count >= t.minActions && (row.avg_grade ?? 0) >= t.minAvgGrade && collaboratorSet.size >= t.minCollaborators) next = 'CANDIDATE';
    } else if (current === 'CANDIDATE') {
      const t = MATURITY_THRESHOLDS.VALIDATED;
      if (row.action_count >= t.minActions && (row.avg_grade ?? 0) >= t.minAvgGrade && collaboratorSet.size >= t.minCollaborators && externalConfirmedCount >= t.externalConfirmed) next = 'VALIDATED';
    } else if (current === 'VALIDATED') {
      const t = MATURITY_THRESHOLDS.COMMUNITY;
      if (row.action_count >= t.minActions && (row.avg_grade ?? 0) >= t.minAvgGrade && collaboratorSet.size >= t.minCollaborators && externalConfirmedCount >= t.externalConfirmed) next = 'COMMUNITY';
    }

    if (next) {
      await supabase
        .from('goal_maturity')
        .update({ maturity: next, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('goal_id', goalId);
      logger.info(`Goal ${goalId} advanced: ${current} → ${next}`);
    }
  }

  private async ensureMaturityRecord(userId: string, goalId: string): Promise<void> {
    const { data } = await supabase.from('goal_maturity').select('id').eq('user_id', userId).eq('goal_id', goalId).single();
    if (!data) {
      await supabase.from('goal_maturity').insert({ user_id: userId, goal_id: goalId });
    }
  }
}

export const goalMaturityService = new GoalMaturityService();
