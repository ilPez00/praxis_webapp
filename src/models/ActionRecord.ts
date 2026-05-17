/** Action record per ayu.md schema — the PDCA primitive. */

export type ActionDomain  = 'FABRICATE' | 'STUDY' | 'CONSTRUCT' | 'BOND' | 'HEAL';
export type ActionMode    = 'LIFT' | 'WALK' | 'WORK' | 'LEARN' | 'CODE' | 'CREATE' | 'REST';
export type ActionScope   = 'PERSONAL' | 'COLLABORATIVE' | 'COMMUNAL';
export type ActionTrigger = 'PROPOSAL' | 'SELF' | 'EXTERNAL';
export type OutcomeType   = 'COMPLETION' | 'PROGRESS' | 'DISCOVERY' | 'MAINTENANCE';
export type GradeRationale = 'COMPLETENESS' | 'EFFORT' | 'OUTCOME' | 'CONSISTENCY';

export interface ExternalSignal {
  signal_type: 'THIRD_PARTY' | 'MARKET' | 'HEALTH' | 'SOCIAL' | 'MILESTONE';
  confidence: number;
  source: string;
  verdict: 'CONFIRMED' | 'CONTRADICTS' | 'NEUTRAL';
}

export interface ActionRecord {
  id: string;
  action_id: string;
  timestamp: string;
  user_id: string;

  domain: ActionDomain;
  mode: ActionMode;
  scope: ActionScope;

  duration_min: number;
  trigger: ActionTrigger;
  action_text: string;

  grade?: number;
  grade_rationale?: GradeRationale;
  tags: string[];

  goal_id?: string;
  external_signals: ExternalSignal[];

  outcome_type?: OutcomeType;
  collaborators: string[];

  location?: string;
  created_at: string;
}

export interface CreateActionRecordInput {
  action_id?: string;
  timestamp?: string;
  domain: ActionDomain;
  mode: ActionMode;
  scope?: ActionScope;
  duration_min: number;
  trigger?: ActionTrigger;
  action_text: string;
  grade?: number;
  grade_rationale?: GradeRationale;
  tags?: string[];
  goal_id?: string;
  external_signals?: ExternalSignal[];
  outcome_type?: OutcomeType;
  collaborators?: string[];
  location?: string;
}
