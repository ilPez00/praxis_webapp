import { supabase } from '../lib/supabaseClient';
import logger from './logger';

/**
 * Keyword sets used to classify free-text content into a Praxis domain.
 * Scoring: count of matching keywords — highest wins.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'Career': ['work', 'job', 'career', 'business', 'startup', 'salary', 'promotion', 'boss', 'professional', 'entrepreneur', 'client', 'company', 'interview', 'revenue', 'hiring', 'fired', 'resign', 'office', 'manager', 'colleague'],
  'Investing / Financial Growth': ['money', 'invest', 'stock', 'crypto', 'finance', 'portfolio', 'savings', 'budget', 'wealth', 'dividend', 'fund', 'market', 'return', 'etf', 'bond', 'asset', 'net worth', 'compound', 'index'],
  'Fitness': ['gym', 'workout', 'run', 'exercise', 'training', 'marathon', 'lift', 'muscle', 'diet', 'nutrition', 'sport', 'cardio', 'yoga', 'swim', 'race', 'pb', 'squat', 'deadlift', 'bench', 'hiit', 'cycling', 'rowing'],
  'Academics': ['study', 'learn', 'school', 'university', 'research', 'paper', 'degree', 'course', 'knowledge', 'exam', 'academic', 'lecture', 'professor', 'thesis', 'dissertation', 'scholarship', 'grade', 'certificate', 'mooc'],
  'Mental Health': ['mental', 'therapy', 'meditation', 'mindfulness', 'anxiety', 'stress', 'depression', 'wellbeing', 'peace', 'journal', 'sleep', 'emotion', 'burnout', 'trauma', 'cbt', 'breathe', 'calm', 'resilience', 'self-care'],
  'Philosophical Development': ['philosophy', 'stoic', 'meaning', 'values', 'ethics', 'existence', 'truth', 'wisdom', 'consciousness', 'purpose', 'virtue', 'epictetus', 'marcus', 'nietzsche', 'plato', 'aristotle', 'free will', 'moral'],
  'Culture / Hobbies / Creative Pursuits': ['art', 'music', 'paint', 'creative', 'hobby', 'film', 'write', 'cook', 'culture', 'photography', 'draw', 'craft', 'poetry', 'theatre', 'dance', 'guitar', 'reading', 'novel', 'museum', 'exhibition'],
  'Intimacy / Romantic Exploration': ['love', 'partner', 'relationship', 'dating', 'girlfriend', 'boyfriend', 'romantic', 'marriage', 'date', 'couple', 'intimacy', 'attraction', 'heartbreak', 'commitment', 'trust', 'vulnerability'],
  'Friendship / Social Engagement': ['friend', 'social', 'community', 'meetup', 'event', 'connect', 'network', 'party', 'club', 'hangout', 'group', 'volunteering', 'community service', 'neighbour', 'gathering'],
  'Personal Goals': ['adventure', 'travel', 'bucket', 'dream', 'goal', 'challenge', 'milestone', 'experience', 'journey', 'explore', 'achieve', 'skydive', 'climb', 'expedition', 'solo', 'bucket list'],
};

/**
 * Classify a piece of text into the most likely Praxis domain.
 * Returns null if no domain scores above zero.
 */
export function classifyPostDomain(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = domain; }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Increment a user's domain proficiency by `amount` (capped at 100).
 * Reads the current JSONB, adds the delta, writes back — best-effort (non-fatal).
 */
export async function bumpDomainProficiency(userId: string, domain: string, amount: number): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('domain_proficiency')
      .eq('id', userId)
      .single();

    const current: Record<string, number> = (profile?.domain_proficiency as Record<string, number>) ?? {};
    const newValue = Math.min(100, parseFloat(((current[domain] ?? 0) + amount).toFixed(3)));

    await supabase
      .from('profiles')
      .update({ domain_proficiency: { ...current, [domain]: newValue } })
      .eq('id', userId);
  } catch (e) {
    logger.warn(`bumpDomainProficiency non-fatal error for user ${userId} domain ${domain}:`, e);
  }
}
