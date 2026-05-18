import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface UserPersona {
  userId: string;
  trueWillDomains: string[];
  statedDomains: string[];
  divergenceInsight: string | null;
  emotionalProfile: {
    happinessDrivers: string[];
    stressors: string[];
    peakEnergyTime: 'morning' | 'afternoon' | 'evening' | 'night';
  };
  traits: {
    openness: number;         // 0.0 - 1.0
    conscientiousness: number;
    extroversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  archetypeAlignment: Record<string, number>; // Similarity to Titan seeds
  avoidancePatterns: string[];
  connectionIntent: string[];
  lifeStage: string | null;
  computedAt: string;
}

const TRAIT_MARKERS: Record<string, { trait: keyof UserPersona['traits']; weight: number }> = {
  // Conscientiousness
  'schedule': { trait: 'conscientiousness', weight: 0.1 },
  'routine':  { trait: 'conscientiousness', weight: 0.1 },
  'duty':     { trait: 'conscientiousness', weight: 0.2 },
  'plan':     { trait: 'conscientiousness', weight: 0.1 },
  // Openness
  'new':      { trait: 'openness', weight: 0.1 },
  'idea':     { trait: 'openness', weight: 0.1 },
  'learn':    { trait: 'openness', weight: 0.1 },
  'explore':  { trait: 'openness', weight: 0.2 },
  // Extroversion
  'people':   { trait: 'extroversion', weight: 0.1 },
  'meeting':  { trait: 'extroversion', weight: 0.1 },
  'party':    { trait: 'extroversion', weight: 0.2 },
  'talk':     { trait: 'extroversion', weight: 0.1 },
};

const MOOD_SCORES: Record<string, number> = {
  '😊': 4, '😁': 5, '🥰': 5, '😎': 4, '💪': 4, '🎉': 5, '✅': 4,
  '😐': 3, '🤔': 3, '😴': 2, '😰': 2, '😤': 2, '😫': 2,
  '😢': 1, '😭': 1, '😡': 1, '🤒': 1, '😓': 2,
};

function moodScore(mood: string | null): number {
  if (!mood) return 3;
  return MOOD_SCORES[mood] ?? 3;
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
}

export class AxiomPersonaService {
  async computePersona(userId: string): Promise<UserPersona> {
    const cutoff = thirtyDaysAgo();

    const [notesRes, goalsRes, checkinsRes, profileRes] = await Promise.all([
      supabase
        .from('notebook_entries')
        .select('content, domain, occurred_at, mood')
        .eq('user_id', userId)
        .gte('occurred_at', cutoff)
        .order('occurred_at', { ascending: false })
        .limit(200),
      supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('checkins')
        .select('checked_in_at')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(200),
      supabase
        .from('profiles')
        .select('connection_intent, life_stage, avoidance_patterns')
        .eq('id', userId)
        .single(),
    ]);

    const notes = notesRes.data || [];
    const nodes: any[] = goalsRes.data?.nodes || [];
    const checkins = checkinsRes.data || [];
    const profile = profileRes.data;

    // True Will: domain frequency from actual notes
    const noteDomainCounts: Record<string, number> = {};
    for (const n of notes) {
      if (n.domain) noteDomainCounts[n.domain] = (noteDomainCounts[n.domain] || 0) + 1;
    }
    const trueWillDomains = Object.entries(noteDomainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);

    // Stated domains from goal tree
    const statedDomains = [...new Set(nodes.map((n: any) => n.domain).filter(Boolean))];

    // Divergence: stated priority vs actual engagement
    let divergenceInsight: string | null = null;
    if (trueWillDomains.length > 0 && statedDomains.length > 0) {
      const trueSet = new Set(trueWillDomains);
      const topStatedMissing = statedDomains.find(d => !trueSet.has(d));
      const topTrue = trueWillDomains[0];
      if (topStatedMissing && topTrue) {
        const truePct = Math.round(
          ((noteDomainCounts[topTrue] || 0) / Math.max(notes.length, 1)) * 100
        );
        divergenceInsight = `You declared "${topStatedMissing}" as a goal, but ${truePct}% of your recent notes focus on "${topTrue}". Your true energy lives there.`;
      }
    }

    // Emotional profile: mood correlation by domain
    const moodByDomain: Record<string, number[]> = {};
    for (const n of notes) {
      if (n.domain && n.mood) {
        if (!moodByDomain[n.domain]) moodByDomain[n.domain] = [];
        moodByDomain[n.domain].push(moodScore(n.mood));
      }
    }
    const domainAvgMood = Object.entries(moodByDomain).map(([domain, scores]) => ({
      domain,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));
    const happinessDrivers = domainAvgMood
      .filter(d => d.avg >= 3.5)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(d => d.domain);
    const stressors = domainAvgMood
      .filter(d => d.avg < 2.5)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3)
      .map(d => d.domain);

    // Peak energy: when the user actually logs
    const timeSlots: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const c of checkins) {
      const hour = new Date(c.checked_in_at).getHours();
      if (hour >= 5 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 21) timeSlots.evening++;
      else timeSlots.night++;
    }
    const peakEnergyTime = (Object.entries(timeSlots)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning') as UserPersona['emotionalProfile']['peakEnergyTime'];

    // Big Five Trait Inference
    const traits = { openness: 0.5, conscientiousness: 0.5, extroversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 };
    const textContent = notes.map(n => (n.content || '').toLowerCase()).join(' ');
    
    Object.entries(TRAIT_MARKERS).forEach(([word, config]) => {
      if (textContent.includes(word)) {
        traits[config.trait] = Math.min(1.0, traits[config.trait] + config.weight);
      }
    });

    // Simple Archetype Alignment (Placeholder for deeper vector comparison)
    const archetypeAlignment: Record<string, number> = {};
    if (traits.conscientiousness > 0.7) archetypeAlignment['titan_willink'] = 0.8;
    if (traits.openness > 0.7) archetypeAlignment['titan_feynman'] = 0.8;
    if (traits.neuroticism > 0.7) archetypeAlignment['titan_frankl'] = 0.7;

    return {
      userId,
      trueWillDomains,
      statedDomains,
      divergenceInsight,
      emotionalProfile: { happinessDrivers, stressors, peakEnergyTime },
      traits,
      archetypeAlignment,
      avoidancePatterns: Array.isArray(profile?.avoidance_patterns) ? profile.avoidance_patterns : [],
      connectionIntent: Array.isArray(profile?.connection_intent) ? profile.connection_intent : [],
      lifeStage: profile?.life_stage || null,
      computedAt: new Date().toISOString(),
    };
  }

  async savePersona(persona: UserPersona): Promise<void> {
    const { error } = await supabase.from('axiom_persona').upsert(
      {
        user_id: persona.userId,
        true_will_domains: persona.trueWillDomains,
        stated_domains: persona.statedDomains,
        divergence_insight: persona.divergenceInsight,
        emotional_profile: persona.emotionalProfile,
        avoidance_patterns: persona.avoidancePatterns,
        connection_intent: persona.connectionIntent,
        life_stage: persona.lifeStage,
        computed_at: persona.computedAt,
      },
      { onConflict: 'user_id' }
    );
    if (error) logger.error('[AxiomPersona] Save failed:', error.message);
  }

  async getPersona(userId: string): Promise<UserPersona | null> {
    const { data } = await supabase
      .from('axiom_persona')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (!data) return null;
    return {
      userId: data.user_id,
      trueWillDomains: data.true_will_domains || [],
      statedDomains: data.stated_domains || [],
      divergenceInsight: data.divergence_insight || null,
      emotionalProfile: data.emotional_profile || {
        happinessDrivers: [],
        stressors: [],
        peakEnergyTime: 'morning',
      },
      traits: data.traits || { openness: 0.5, conscientiousness: 0.5, extroversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 },
      archetypeAlignment: data.archetype_alignment || {},
      avoidancePatterns: data.avoidance_patterns || [],
      connectionIntent: data.connection_intent || [],
      lifeStage: data.life_stage || null,
      computedAt: data.computed_at,
    };
  }
}
