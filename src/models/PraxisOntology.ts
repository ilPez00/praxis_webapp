/**
 * PraxisOntology — canonical mapping from the 14 Praxis life domains
 * to the ayu action schema (ActionDomain, ActionMode, score axis, unit).
 *
 * Single source of truth shared by:
 *   - AxiomScanService (goal context enrichment)
 *   - actionController (validation + auto-classification)
 *   - Aura/Rachmaninov (mirrored in PraxisOntology.kt)
 *
 * ayu.md § 3.2 domain definitions:
 *   FABRICATE = making/building/producing
 *   STUDY     = learning/research/understanding
 *   CONSTRUCT = infrastructure/systems/environments
 *   BOND      = relationships/community/care
 *   HEAL      = body/mind/recovery
 */

import type { ActionDomain, ActionMode } from './ActionRecord';
import { Domain } from './Domain';

export type ScoreAxis = 'physical' | 'economic' | 'intellectual' | 'psychological';

export interface DomainDef {
  ayuDomain: ActionDomain;
  defaultMode: ActionMode;
  scoreAxis: ScoreAxis;
  unit: string;           // measurement unit for proposals ("reps", "€", "pages", "min")
  contextHints: string[]; // app/location signals Aura uses for context-aware ranking
}

export const PRAXIS_ONTOLOGY: Record<Domain, DomainDef> = {
  [Domain.BODY_FITNESS]: {
    ayuDomain: 'HEAL',
    defaultMode: 'LIFT',
    scoreAxis: 'physical',
    unit: 'reps',
    contextHints: ['gym', 'workout', 'lift', 'sport', 'exercise'],
  },
  [Domain.REST_RECOVERY]: {
    ayuDomain: 'HEAL',
    defaultMode: 'REST',
    scoreAxis: 'physical',
    unit: 'hours',
    contextHints: ['sleep', 'rest', 'nap', 'recovery'],
  },
  [Domain.MENTAL_BALANCE]: {
    ayuDomain: 'HEAL',
    defaultMode: 'REST',
    scoreAxis: 'psychological',
    unit: 'min',
    contextHints: ['meditation', 'journal', 'breathe', 'calm'],
  },
  [Domain.ENVIRONMENT_HOME]: {
    ayuDomain: 'CONSTRUCT',
    defaultMode: 'CREATE',
    scoreAxis: 'psychological',
    unit: 'tasks',
    contextHints: ['home', 'clean', 'organize', 'repair', 'build'],
  },
  [Domain.HEALTH_LONGEVITY]: {
    ayuDomain: 'HEAL',
    defaultMode: 'WALK',
    scoreAxis: 'physical',
    unit: 'steps',
    contextHints: ['walk', 'outside', 'doctor', 'pharmacy', 'checkup'],
  },
  [Domain.FINANCIAL_SECURITY]: {
    ayuDomain: 'FABRICATE',
    defaultMode: 'WORK',
    scoreAxis: 'economic',
    unit: '€',
    contextHints: ['spreadsheet', 'bank', 'budget', 'invoice', 'finance'],
  },
  [Domain.FRIENDSHIP_SOCIAL]: {
    ayuDomain: 'BOND',
    defaultMode: 'REST',
    scoreAxis: 'psychological',
    unit: 'contacts',
    contextHints: ['message', 'call', 'friend', 'meet', 'social'],
  },
  [Domain.ROMANCE_INTIMACY]: {
    ayuDomain: 'BOND',
    defaultMode: 'REST',
    scoreAxis: 'psychological',
    unit: 'quality-time',
    contextHints: ['partner', 'date', 'intimacy', 'together'],
  },
  [Domain.COMMUNITY_CONTRIBUTION]: {
    ayuDomain: 'BOND',
    defaultMode: 'CREATE',
    scoreAxis: 'psychological',
    unit: 'hours',
    contextHints: ['volunteer', 'community', 'contribute', 'teach'],
  },
  [Domain.CAREER_CRAFT]: {
    ayuDomain: 'FABRICATE',
    defaultMode: 'WORK',
    scoreAxis: 'intellectual',
    unit: 'deliverables',
    contextHints: ['desk', 'office', 'ide', 'code', 'work', 'project'],
  },
  [Domain.WEALTH_ASSETS]: {
    ayuDomain: 'FABRICATE',
    defaultMode: 'WORK',
    scoreAxis: 'economic',
    unit: '€',
    contextHints: ['trading', 'invest', 'portfolio', 'asset', 'crypto'],
  },
  [Domain.GAMING_ESPORTS]: {
    ayuDomain: 'STUDY',
    defaultMode: 'CREATE',
    scoreAxis: 'intellectual',
    unit: 'hours',
    contextHints: ['game', 'esports', 'practice', 'ranked', 'stream'],
  },
  [Domain.IMPACT_LEGACY]: {
    ayuDomain: 'CONSTRUCT',
    defaultMode: 'CREATE',
    scoreAxis: 'intellectual',
    unit: 'projects',
    contextHints: ['write', 'publish', 'create', 'launch', 'build'],
  },
  [Domain.SPIRIT_PURPOSE]: {
    ayuDomain: 'STUDY',
    defaultMode: 'LEARN',
    scoreAxis: 'psychological',
    unit: 'pages',
    contextHints: ['read', 'philosophy', 'reflect', 'meaning', 'purpose'],
  },
};

/** Resolve a Praxis domain string → DomainDef. Fuzzy-matches on partial string. */
export function resolveDomain(domainStr: string): DomainDef | null {
  const key = Object.keys(PRAXIS_ONTOLOGY).find(
    k => k.toLowerCase() === domainStr.toLowerCase() ||
         domainStr.toLowerCase().includes(k.toLowerCase().split('&')[0].trim()),
  ) as Domain | undefined;
  return key ? PRAXIS_ONTOLOGY[key] : null;
}

/** Summarize goals with ontology tags for LLM context injection. */
export function enrichGoalsContext(nodes: Array<{ name: string; domain: string; progress: number }>): string {
  return nodes.map(n => {
    const def = resolveDomain(n.domain);
    const tag = def
      ? `[${def.ayuDomain}/${def.defaultMode} → ${def.scoreAxis} +${def.unit}]`
      : '[GENERAL]';
    return `• "${n.name}" ${tag} progress=${Math.round(n.progress * 100)}%`;
  }).join('\n');
}
