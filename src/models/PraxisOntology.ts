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

/**
 * Visual/verbal object vocabulary → Praxis domain.
 * Mirrored in Kotlin (rachmaninov/PraxisOntology.kt VISUAL_HINTS).
 * Used by PraxisEventBridge to score vision/audio/screen wiki pages.
 * Bump ONTOLOGY_LAST_MODIFIED in rachmaninov.ts when changing this map.
 */
export const VISUAL_HINTS: Record<string, string> = {
  // Body & Fitness
  dumbbell: 'Body & Fitness', barbell: 'Body & Fitness', weights: 'Body & Fitness',
  squat: 'Body & Fitness', 'bench press': 'Body & Fitness', 'pull-up': 'Body & Fitness',
  'push-up': 'Body & Fitness', pushup: 'Body & Fitness', treadmill: 'Body & Fitness',
  'running shoes': 'Body & Fitness', 'yoga mat': 'Body & Fitness', stretching: 'Body & Fitness',
  training: 'Body & Fitness', reps: 'Body & Fitness', sets: 'Body & Fitness',
  protein: 'Body & Fitness', 'gym bag': 'Body & Fitness', sports: 'Body & Fitness',
  fitness: 'Body & Fitness',
  // Health & Longevity
  food: 'Health & Longevity', meal: 'Health & Longevity', plate: 'Health & Longevity',
  salad: 'Health & Longevity', fruit: 'Health & Longevity', vegetable: 'Health & Longevity',
  eating: 'Health & Longevity', lunch: 'Health & Longevity', dinner: 'Health & Longevity',
  breakfast: 'Health & Longevity', restaurant: 'Health & Longevity', cooking: 'Health & Longevity',
  nutrition: 'Health & Longevity', groceries: 'Health & Longevity', vitamin: 'Health & Longevity',
  supplement: 'Health & Longevity', medicine: 'Health & Longevity', prescription: 'Health & Longevity',
  healthy: 'Health & Longevity', diet: 'Health & Longevity',
  // Rest & Recovery
  bed: 'Rest & Recovery', pillow: 'Rest & Recovery', sleeping: 'Rest & Recovery',
  nap: 'Rest & Recovery', resting: 'Rest & Recovery', recovery: 'Rest & Recovery',
  // Mental Balance
  candle: 'Mental Balance', incense: 'Mental Balance', breathing: 'Mental Balance',
  mindfulness: 'Mental Balance', journaling: 'Mental Balance', therapy: 'Mental Balance',
  anxiety: 'Mental Balance',
  // Financial Security
  money: 'Financial Security', cash: 'Financial Security', receipt: 'Financial Security',
  invoice: 'Financial Security', bill: 'Financial Security', wallet: 'Financial Security',
  'credit card': 'Financial Security', transaction: 'Financial Security',
  payment: 'Financial Security', expense: 'Financial Security', salary: 'Financial Security',
  // Career & Craft
  laptop: 'Career & Craft', computer: 'Career & Craft', monitor: 'Career & Craft',
  keyboard: 'Career & Craft', whiteboard: 'Career & Craft', presentation: 'Career & Craft',
  document: 'Career & Craft', 'office desk': 'Career & Craft', terminal: 'Career & Craft',
  coding: 'Career & Craft',
  // Spirit & Purpose
  book: 'Spirit & Purpose', textbook: 'Spirit & Purpose', reading: 'Spirit & Purpose',
  library: 'Spirit & Purpose', pages: 'Spirit & Purpose', studying: 'Spirit & Purpose',
  learning: 'Spirit & Purpose', notes: 'Spirit & Purpose', philosophy: 'Spirit & Purpose',
  knowledge: 'Spirit & Purpose', lecture: 'Spirit & Purpose', class: 'Spirit & Purpose',
  course: 'Spirit & Purpose',
  // Impact & Legacy
  canvas: 'Impact & Legacy', painting: 'Impact & Legacy', drawing: 'Impact & Legacy',
  guitar: 'Impact & Legacy', piano: 'Impact & Legacy', instrument: 'Impact & Legacy',
  studio: 'Impact & Legacy', sketchbook: 'Impact & Legacy', microphone: 'Impact & Legacy',
  camera: 'Impact & Legacy', art: 'Impact & Legacy', creative: 'Impact & Legacy',
  // Friendship & Social
  cafe: 'Friendship & Social', 'coffee shop': 'Friendship & Social',
  gathering: 'Friendship & Social', party: 'Friendship & Social',
  hangout: 'Friendship & Social', 'group photo': 'Friendship & Social',
  // Wealth & Assets
  chart: 'Wealth & Assets', trading: 'Wealth & Assets', investment: 'Wealth & Assets',
  portfolio: 'Wealth & Assets', crypto: 'Wealth & Assets', property: 'Wealth & Assets',
  // Gaming & Esports
  controller: 'Gaming & Esports', console: 'Gaming & Esports', headset: 'Gaming & Esports',
  esports: 'Gaming & Esports', 'gaming chair': 'Gaming & Esports',
  // Environment & Home
  vacuum: 'Environment & Home', cleaning: 'Environment & Home',
  organizing: 'Environment & Home', tools: 'Environment & Home', repair: 'Environment & Home',
  // Community & Contribution
  volunteer: 'Community & Contribution', teaching: 'Community & Contribution',
  charity: 'Community & Contribution', donation: 'Community & Contribution',
  // Romance & Intimacy
  flowers: 'Romance & Intimacy', romantic: 'Romance & Intimacy', couple: 'Romance & Intimacy',
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
