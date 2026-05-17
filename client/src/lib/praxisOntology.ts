/**
 * PraxisOntology — frontend mirror of src/models/PraxisOntology.ts
 * Used for domain color/icon enrichment and score axis display in UI.
 */

export type AyuDomain = 'FABRICATE' | 'STUDY' | 'CONSTRUCT' | 'BOND' | 'HEAL';
export type ActionMode = 'LIFT' | 'WALK' | 'WORK' | 'LEARN' | 'CODE' | 'CREATE' | 'REST';
export type ScoreAxis = 'physical' | 'economic' | 'intellectual' | 'psychological';

export interface DomainDef {
  ayuDomain: AyuDomain;
  defaultMode: ActionMode;
  scoreAxis: ScoreAxis;
  unit: string;
  contextHints: string[];
  color: string;    // UI accent color
  icon: string;     // emoji for quick display
}

export const PRAXIS_ONTOLOGY: Record<string, DomainDef> = {
  'Body & Fitness':           { ayuDomain: 'HEAL',      defaultMode: 'LIFT',   scoreAxis: 'physical',      unit: 'reps',         contextHints: ['gym','lift','sport'],          color: '#FF6B6B', icon: '💪' },
  'Rest & Recovery':          { ayuDomain: 'HEAL',      defaultMode: 'REST',   scoreAxis: 'physical',      unit: 'hours',        contextHints: ['sleep','rest','nap'],          color: '#A78BFA', icon: '😴' },
  'Mental Balance':           { ayuDomain: 'HEAL',      defaultMode: 'REST',   scoreAxis: 'psychological', unit: 'min',          contextHints: ['meditation','journal'],        color: '#60A5FA', icon: '🧘' },
  'Environment & Home':       { ayuDomain: 'CONSTRUCT', defaultMode: 'CREATE', scoreAxis: 'psychological', unit: 'tasks',        contextHints: ['home','clean','organize'],     color: '#34D399', icon: '🏠' },
  'Health & Longevity':       { ayuDomain: 'HEAL',      defaultMode: 'WALK',   scoreAxis: 'physical',      unit: 'steps',        contextHints: ['walk','outside','doctor'],     color: '#10B981', icon: '🏃' },
  'Financial Security':       { ayuDomain: 'FABRICATE', defaultMode: 'WORK',   scoreAxis: 'economic',      unit: '€',            contextHints: ['bank','budget','finance'],      color: '#F59E0B', icon: '💰' },
  'Friendship & Social':      { ayuDomain: 'BOND',      defaultMode: 'REST',   scoreAxis: 'psychological', unit: 'contacts',     contextHints: ['friend','call','meet'],        color: '#F472B6', icon: '👥' },
  'Romance & Intimacy':       { ayuDomain: 'BOND',      defaultMode: 'REST',   scoreAxis: 'psychological', unit: 'quality-time', contextHints: ['partner','date'],              color: '#EC4899', icon: '❤️' },
  'Community & Contribution': { ayuDomain: 'BOND',      defaultMode: 'CREATE', scoreAxis: 'psychological', unit: 'hours',        contextHints: ['volunteer','community'],       color: '#8B5CF6', icon: '🌍' },
  'Career & Craft':           { ayuDomain: 'FABRICATE', defaultMode: 'WORK',   scoreAxis: 'intellectual',  unit: 'deliverables', contextHints: ['desk','ide','code','work'],    color: '#3B82F6', icon: '⚒️' },
  'Wealth & Assets':          { ayuDomain: 'FABRICATE', defaultMode: 'WORK',   scoreAxis: 'economic',      unit: '€',            contextHints: ['invest','portfolio','asset'],  color: '#FBBF24', icon: '📈' },
  'Gaming & Esports':         { ayuDomain: 'STUDY',     defaultMode: 'CREATE', scoreAxis: 'intellectual',  unit: 'hours',        contextHints: ['game','esports','ranked'],     color: '#6366F1', icon: '🎮' },
  'Impact & Legacy':          { ayuDomain: 'CONSTRUCT', defaultMode: 'CREATE', scoreAxis: 'intellectual',  unit: 'projects',     contextHints: ['write','publish','launch'],    color: '#14B8A6', icon: '🚀' },
  'Spirit & Purpose':         { ayuDomain: 'STUDY',     defaultMode: 'LEARN',  scoreAxis: 'psychological', unit: 'pages',        contextHints: ['read','philosophy','reflect'], color: '#E879F9', icon: '✨' },
};

export function resolveDomain(domainStr: string): DomainDef | undefined {
  if (PRAXIS_ONTOLOGY[domainStr]) return PRAXIS_ONTOLOGY[domainStr];
  const key = Object.keys(PRAXIS_ONTOLOGY).find(k =>
    domainStr.toLowerCase().includes(k.toLowerCase().split('&')[0].trim())
  );
  return key ? PRAXIS_ONTOLOGY[key] : undefined;
}

export const SCORE_AXIS_LABELS: Record<ScoreAxis, string> = {
  physical:      'Physical',
  economic:      'Economic',
  intellectual:  'Intellectual',
  psychological: 'Psychological',
};
