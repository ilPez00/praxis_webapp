import { supabase } from '../src/lib/supabaseClient';
import { Domain } from '../src/models/Domain';

const SEED_DATA = [
  // --- LEADERSHIP & POWER ---
  {
    domain: Domain.IMPACT_LEGACY,
    source: 'titan_machiavelli',
    scores: { intellectual: 0.90, psychological: 0.95, economic: 0.70, physical: 0.30 },
    tags: ['realism', 'power-dynamics'],
    content: 'Pattern: Strategic Realist. Focus on power as it is, not as it should be. Match if: User is "naive", "in corporate politics", or "seeks influence".'
  },
  {
    domain: Domain.CAREER_CRAFT,
    source: 'titan_shackleton',
    scores: { psychological: 1.0, physical: 0.80, intellectual: 0.70, economic: 0.20 },
    tags: ['crisis-leadership', 'endurance'],
    content: 'Pattern: The Crisis Captain. Leadership via shared suffering and relentless optimism in total failure. Match if: User is "in chaos", "facing bankruptcy", or "leading a failing team".'
  },

  // --- EASTERN MASTERY ---
  {
    domain: Domain.BODY_FITNESS,
    source: 'titan_musashi',
    scores: { physical: 1.0, intellectual: 0.90, psychological: 0.90, economic: 0.10 },
    tags: ['strategy', 'detachment', 'mastery'],
    content: 'Pattern: The Lone Sword (Musashi). Do nothing which is of no use. Strategy is the same for 1 vs 1 or 1 vs 1000. Match if: User is "obsessive", "into martial arts", or "technical specialist".'
  },
  {
    domain: Domain.SPIRIT_PURPOSE,
    source: 'titan_laozi',
    scores: { psychological: 1.0, intellectual: 0.80, physical: 0.40, economic: 0.0 },
    tags: ['wu-wei', 'flow', 'simplicity'],
    content: 'Pattern: The Water Flow. Mastery via non-action (Wu-wei). Victory by yielding. Match if: User is "over-controlling", "burnt out", or "high-stress".'
  },
  {
    domain: Domain.COMMUNITY_CONTRIBUTION,
    source: 'titan_confucius',
    scores: { psychological: 0.80, intellectual: 0.90, economic: 0.40, physical: 0.20 },
    tags: ['ritual', 'filial-piety', 'social-order'],
    content: 'Pattern: The Social Architect. Order in the world begins with order in the heart and family. Match if: User seeks "structure", "family peace", or "community respect".'
  },

  // --- SPIRITUAL & MYSTIC ---
  {
    domain: Domain.MENTAL_BALANCE,
    source: 'titan_buddha',
    scores: { psychological: 1.0, intellectual: 0.70, physical: 0.30, economic: 0.0 },
    tags: ['detachment', 'mindfulness', 'cessation'],
    content: 'Pattern: The Awakened. Suffering = Attachment. Observe the observer. Match if: User is "in pain", "materialistic", or "seeking enlightenment".'
  },
  {
    domain: Domain.SPIRIT_PURPOSE,
    source: 'titan_rumi',
    scores: { psychological: 1.0, intellectual: 0.60, physical: 0.40, economic: 0.10 },
    tags: ['devotion', 'love', 'mysticism'],
    content: 'Pattern: The Ecstatic Lover. Truth is found in the heart, not the head. Match if: User feels "cold", "isolated", or "over-analytical".'
  },

  // --- SOCIAL REFORM & TRUTH ---
  {
    domain: Domain.IMPACT_LEGACY,
    source: 'titan_malcolm_x',
    scores: { psychological: 1.0, intellectual: 0.90, physical: 0.60, economic: 0.20 },
    tags: ['self-reinvention', 'radical-honesty'],
    content: 'Pattern: The Reconstructed Rebel. Complete identity death and rebirth. High-speed self-education in prison. Match if: User is "starting over", "seeking justice", or "ex-con".'
  },
  {
    domain: Domain.COMMUNITY_CONTRIBUTION,
    source: 'titan_gandhi',
    scores: { psychological: 1.0, physical: 0.50, intellectual: 0.80, economic: 0.10 },
    tags: ['non-violence', 'self-discipline', 'moral-force'],
    content: 'Pattern: The Moral Multiplier. Power via extreme self-restraint and public sacrifice. Match if: User is "fighting a giant", "seeks moral clarity", or "activist".'
  },

  // --- CREATIVE & SENSITIVE ---
  {
    domain: Domain.IMPACT_LEGACY,
    source: 'titan_woolf',
    scores: { intellectual: 1.0, psychological: 0.90, economic: 0.30, physical: 0.20 },
    tags: ['interiority', 'subjectivity', 'depth'],
    content: 'Pattern: The Stream of Mind. Truth in the internal moment, not external events. Match if: User is "highly sensitive", "writer", or "introspective".'
  },
  {
    domain: Domain.IMPACT_LEGACY,
    source: 'titan_kahlo',
    scores: { physical: 0.30, psychological: 1.0, intellectual: 0.70, economic: 0.40 },
    tags: ['pain-as-art', 'vibrancy', 'authenticity'],
    content: 'Pattern: The Alchemist of Suffering. Transform physical agony into aesthetic dominance. Match if: User is "chronically ill", "disabled", or "uses art as therapy".'
  },

  // --- SCIENCE & INNOVATION ---
  {
    domain: Domain.SPIRIT_PURPOSE,
    source: 'titan_tesla',
    scores: { intellectual: 1.0, physical: 0.40, psychological: 0.70, economic: 0.10 },
    tags: ['visionary', 'eccentricity', 'future-anchor'],
    content: 'Pattern: The Lightning Weaver. Working on technology 100 years ahead of time. Total isolation for innovation. Match if: User is "inventor", "eccentric", or "misunderstood genius".'
  },
  {
    domain: Domain.CAREER_CRAFT,
    source: 'titan_lovelace',
    scores: { intellectual: 1.0, psychological: 0.80, economic: 0.40, physical: 0.30 },
    tags: ['poetic-science', 'abstract-logic'],
    content: 'Pattern: The Poetic Programmer. Linking mathematical logic to musical and metaphysical structures. Match if: User is "female coder", "abstract thinker", or "cross-domain polymath".'
  },

  // --- SOCIAL & BACKGROUND TYPES ---
  {
    domain: Domain.WEALTH_ASSETS,
    source: 'bg_immigrant_hustler',
    scores: { economic: 0.90, physical: 0.70, psychological: 0.95, intellectual: 0.60 },
    tags: ['grit', 'zero-safety-net', 'frugality'],
    content: 'Pattern: The Zero-Floor Hustler. Success via necessity. Working 3 jobs while learning a new language. High resilience, low ego. Match if: User is "immigrant", "first-gen", or "broke but hungry".'
  },
  {
    domain: Domain.CAREER_CRAFT,
    source: 'bg_quiet_craftsman',
    scores: { physical: 0.60, intellectual: 0.80, psychological: 0.90, economic: 0.40 },
    tags: ['deep-work', 'humility', 'perfection'],
    content: 'Pattern: The Master of One. 30 years on a single craft. No desire for fame, only for the perfect joint/line of code. Match if: User is "introverted", "skilled trade", or "hates marketing".'
  },
  {
    domain: Domain.SPIRIT_PURPOSE,
    source: 'bg_tribal_elder',
    scores: { psychological: 1.0, intellectual: 0.80, community: 0.90, physical: 0.40 },
    tags: ['legacy', 'mentorship', 'wisdom'],
    content: 'Pattern: The Wisdom Keeper. Life as a service to the next generation. Focus on stories and oral history. Match if: User is "older", "seeks to mentor", or "values tradition".'
  },

  // --- PHILOSOPHICAL EXTREMES ---
  {
    domain: Domain.ENVIRONMENT_HOME,
    source: 'titan_diogenes',
    scores: { psychological: 1.0, intellectual: 0.90, physical: 0.80, economic: -1.0 },
    tags: ['cynicism', 'minimalism', 'shamelessness'],
    content: 'Pattern: The Honest Dog. Own nothing, say everything. Radical rejection of social status. Match if: User is "minimalist", "anti-consumerist", or "hates hypocrisy".'
  },
  {
    domain: Domain.SPIRIT_PURPOSE,
    source: 'pdca_edison',
    scores: { intellectual: 1.0, psychological: 0.90, physical: 0.60, economic: 0.80 },
    tags: ['iterative-testing', 'failure-mining', 'empirical-patience'],
    content: 'PDCA Pattern (Edison): High-frequency iteration. "I have not failed. I have found 10,000 ways that dont work." Check method: Treat every action as an experiment. If result != goal, pivot the variable, not the intent. Match if: User is "frustrated by failure" or "stuck on a technical problem".'
  },
  {
    domain: Domain.WEALTH_ASSETS,
    source: 'pdca_walker',
    scores: { economic: 1.0, psychological: 1.0, intellectual: 0.80, physical: 0.70 },
    tags: ['community-feedback', 'pivot-to-scale', 'resilience'],
    content: 'PDCA Pattern (C.J. Walker): Feedback-driven growth. Plan: solve personal hair loss. Do: sell door-to-door. Check: listen to every customer complaint. Act: Build training schools to scale the solution. Match if: User is "starting small", "scaling a service", or "overcoming systemic barriers".'
  },
  {
    domain: Domain.CAREER_CRAFT,
    source: 'pdca_grant',
    scores: { physical: 0.70, intellectual: 0.90, psychological: 0.95, economic: 0.30 },
    tags: ['logistical-recovery', 'quiet-persistence', 'unconditional-surrender'],
    content: 'PDCA Pattern (Grant): Pragmatic recovery. After failure (business/pre-war), simplify the goal to "Logistics first." Don\'t wait for perfection. Move the supplies, then move the men. If blocked, bypass. Match if: User is "recovering from disgrace/failure" or "over-complicating strategy".'
  },
  {
    domain: Domain.BODY_FITNESS,
    source: 'pdca_musashi',
    scores: { physical: 1.0, psychological: 1.0, intellectual: 0.90, economic: 0.10 },
    tags: ['post-action-review', 'spirit-of-thing', 'void'],
    content: 'PDCA Pattern (Musashi): The Review after the Strike. After every engagement, examine the "spirit" of the movement. Did the feet move before the mind? Correct the stance in the next void. Match if: User is "making the same mistakes", "into precision skills", or "lacks reflection".'
  },
  {
    domain: Domain.MENTAL_BALANCE,
    source: 'pdca_frankl',
    scores: { psychological: 1.0, intellectual: 0.80, spiritual: 1.0, physical: 0.40 },
    tags: ['meaning-pivot', 'last-freedom', 'attitude-adjustment'],
    content: 'PDCA Pattern (Frankl): The Attitude Pivot. Plan: survive. Do: work. Check: find oneself broken. Act: Change the "Why." Tether survival to a future task. Man is the being who can adjust to any condition by changing his inner state. Match if: User is "in extremis" or "suffering without reason".'
  }
];

async function seed() {
  console.log('🌌 Seeding Complete Human Pantheon (40+ Archetypes)...');
  const rows = SEED_DATA.map(d => ({
    user_id: null, 
    source_type: d.source,
    confidence: 1.0,
    scores: d.scores,
    tags: d.tags,
    content: d.content,
    logged_at: new Date().toISOString()
  }));
  const { error } = await supabase.from('community_wiki_aggregates').insert(rows);
  if (error) console.error('❌ Fail:', error.message);
  else console.log(`✅ Pantheon indexed. Total: ${rows.length} patterns.`);
}
seed();