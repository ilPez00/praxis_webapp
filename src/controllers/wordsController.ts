import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, InternalServerError } from '../utils/appErrors';
import logger from '../utils/logger';

const STOP_WORDS = new Set([
  // Articles & Connectors
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'up','out','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can','my',
  'i','me','you','it','its','this','that','these','those','all','not','no','so',
  'as','if','then','than','into','about','more','get','got','use','one','two',
  'also','just','their','they','our','we','his','her','him','who','what','when',
  'how','which','your','per','each','any','well','while','after','before',
  // Common verbs/pronouns
  'want','think','make','made','take','told','took','said','says','saying',
  'about','them','because','under','over','again','once','many','some','every',
  'here','there','where','why','how','very','only','much','such','even','other',
  'been','being','does','did','done','doing','could','might','must','need','needs',
  'own','same','self','show','than','that','their','them','then','there','these',
  'they','this','those','through','under','until','upon','very','well','were','what',
  'when','where','which','while','who','whom','whose','why','with','within','without',
  'your','yours','myself','himself','herself','itself','ourselves','yourselves','themselves',
  'become','became','becomes','becoming','actually','basically','literally','simply','really',
  'already','always','almost','often','maybe','perhaps','probably','usually','never','sometimes',
  'looking','look','find','finding','start','starting','begun','began','begin','keep','kept',
  'using','used','uses','work','working','works','going','went','gone','come','came','comes',
  'take','taken','took','give','given','gave','better','best','great','good','nice','cool',
  'more','most','less','least','much','many','some','every','each','all','both','neither',
  'either','other','another','such','very','quite','rather','really','enough','too','very',
  'new','old','first','last','next','previous','early','late','high','low','big','small',
  'large','long','short','far','near','different','same','important','possible','likely',
]);

/**
 * GET /api/words/frequency
 * Aggregates words from all goal node names + descriptions.
 * Returns top 100 words with counts, plus per-domain breakdown.
 */
export const getWordFrequency = catchAsync(async (_req: Request, res: Response) => {
  const { data: trees } = await supabase.from('goal_trees').select('nodes');

  const freq: Record<string, number> = {};
  const domainFreq: Record<string, Record<string, number>> = {};

  for (const tree of trees ?? []) {
    const nodes: any[] = Array.isArray((tree as any).nodes) ? (tree as any).nodes : [];
    for (const node of nodes) {
      const text = [
        node.name ?? '',
        node.customDetails ?? '',
        node.description ?? '',
        node.completionMetric ?? '',
      ].join(' ').toLowerCase();

      // Find words with 3+ chars
      const words = text.match(/[a-z]{3,}/g) ?? [];
      const domain: string = node.domain ?? 'Other';

      for (const word of words) {
        if (STOP_WORDS.has(word)) continue;
        freq[word] = (freq[word] ?? 0) + 1;
        if (!domainFreq[domain]) domainFreq[domain] = {};
        domainFreq[domain][word] = (domainFreq[domain][word] ?? 0) + 1;
      }
    }
  }

  const sorted = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 100)
    .map(([word, count]) => ({ word, count }));

  return res.json({ words: sorted, byDomain: domainFreq });
});

/**
 * GET /api/words/user-frequency
 * Aggregates words from CURRENT user's goal trees and tracker logs.
 * Returns the most common "juicy" words for personal insight.
 */
export const getUserWordFrequency = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const freq: Record<string, number> = {};

  // 1. Goal Trees
  const { data: trees } = await supabase.from('goal_trees').select('nodes').eq('user_id', userId);
  for (const tree of trees ?? []) {
    const nodes: any[] = Array.isArray((tree as any).nodes) ? (tree as any).nodes : [];
    for (const node of nodes) {
      const text = [
        node.name ?? '',
        node.description ?? '',
        node.customDetails ?? '',
      ].join(' ').toLowerCase();
      const words = text.match(/[a-z]{3,}/g) ?? [];
      for (const word of words) {
        if (STOP_WORDS.has(word)) continue;
        freq[word] = (freq[word] ?? 0) + 1;
      }
    }
  }

  // 2. Tracker Logs / Check-ins
  const { data: checkins } = await supabase.from('checkins').select('notes').eq('user_id', userId);
  for (const checkin of checkins ?? []) {
    if (!checkin.notes) continue;
    const text = checkin.notes.toLowerCase();
    const words = text.match(/[a-z]{3,}/g) ?? [];
    for (const word of words) {
      if (STOP_WORDS.has(word)) continue;
      freq[word] = (freq[word] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }));

  return res.json({ words: sorted });
});

// Domain keyword banks for targeting scores
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  fitness: ['gym', 'run', 'running', 'workout', 'lift', 'cardio', 'yoga', 'pilates', 'swim', 'cycling', 'hike', 'walk', 'exercise', 'strength', 'stretch', 'marathon', 'sport', 'train', 'training', 'muscle', 'weight', 'diet', 'protein', 'calorie', 'fasting', 'keto', 'vegan', 'nutrition', 'sleep', 'rest', 'recovery'],
  career: ['work', 'job', 'career', 'startup', 'business', 'company', 'salary', 'promotion', 'interview', 'resume', 'skill', 'learn', 'course', 'certification', 'coding', 'programming', 'design', 'writing', 'client', 'project', 'deadline', 'meeting', 'network', 'mentor', 'boss', 'colleague', 'office', 'remote', 'freelance', 'side'],
  wellness: ['meditation', 'mindful', 'therapy', 'counsel', 'mental', 'anxiety', 'stress', 'calm', 'breath', 'journal', 'gratitude', 'mood', 'emotion', 'heal', 'self', 'love', 'kind', 'accept', 'peace', 'happy', 'joy', 'purpose', 'meaning', 'reflect', 'growth'],
  finance: ['money', 'save', 'saving', 'invest', 'investment', 'budget', 'debt', 'loan', 'mortgage', 'stock', 'crypto', 'bank', 'account', 'income', 'passive', 'wealth', 'retire', 'retirement', 'fund', 'financial', 'spend', 'expense', 'tax', 'insurance'],
  learning: ['read', 'reading', 'book', 'study', 'learn', 'course', 'class', 'lesson', 'practice', 'skill', 'knowledge', 'educate', 'education', 'school', 'university', 'degree', 'research', 'paper', 'article', 'essay', 'write', 'writing', 'language', 'spanish', 'code', 'coding', 'tutorial'],
  social: ['friend', 'friendship', 'family', 'partner', 'date', 'relationship', 'community', 'group', 'connect', 'social', 'party', 'event', 'meet', 'call', 'phone', 'message', 'chat', 'love', 'romance', 'intimacy', 'marriage', 'parent', 'child'],
};

const POSITIVE_WORDS = new Set(['happy', 'joy', 'grateful', 'love', 'amazing', 'great', 'wonderful', 'excellent', 'success', 'proud', 'blessed', 'beautiful', 'fantastic', 'awesome', 'good', 'better', 'best', 'strong', 'confident', 'energized', 'motivated', 'inspired', 'hopeful', 'peace', 'calm', 'excited', 'thrilled', 'accomplished', 'progress', 'win', 'victory']);
const NEGATIVE_WORDS = new Set(['sad', 'angry', 'frustrated', 'tired', 'exhausted', 'stressed', 'anxious', 'depressed', 'lonely', 'guilty', 'ashamed', 'afraid', 'worry', 'worried', 'hate', 'terrible', 'awful', 'bad', 'worst', 'weak', 'lazy', 'failure', 'lost', 'confused', 'overwhelm', 'burnout', 'pain', 'hurt', 'struggle', 'suffer', 'cry']);
const ASPIRATIONAL_WORDS = new Set(['goal', 'dream', 'vision', 'future', 'plan', 'aim', 'target', 'aspire', 'ambition', 'purpose', 'mission', 'become', 'build', 'create', 'achieve', 'reach', 'improve', 'grow', 'develop', 'level', 'transform', 'master']);
const REFLECTIVE_WORDS = new Set(['think', 'thought', 'realize', 'reflect', 'lesson', 'learn', 'understand', 'insight', 'perspective', 'consider', 'wonder', 'question', 'meaning', 'review', 'look', 'back', 'experience', 'noticed', 'notice', 'aware', 'mindful']);

function classifyTone(words: Record<string, number>): string {
  let pos = 0, neg = 0, asp = 0, ref = 0;
  for (const w of Object.keys(words)) {
    if (POSITIVE_WORDS.has(w)) pos++;
    if (NEGATIVE_WORDS.has(w)) neg++;
    if (ASPIRATIONAL_WORDS.has(w)) asp++;
    if (REFLECTIVE_WORDS.has(w)) ref++;
  }
  const total = pos + neg + asp + ref;
  if (total === 0) return 'neutral';
  const scores = [
    { label: 'positive', score: pos / total },
    { label: 'struggling', score: neg / total },
    { label: 'aspirational', score: asp / total },
    { label: 'reflective', score: ref / total },
  ];
  scores.sort((a, b) => b.score - a.score);
  return scores[0].label;
}

function extractWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z]{3,}/g)?.filter(w => !STOP_WORDS.has(w)) ?? [];
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sq / (values.length - 1));
}

function modeValue(values: number[]): number {
  if (values.length === 0) return 12;
  const freq: Record<number, number> = {};
  for (const v of values) freq[v] = (freq[v] ?? 0) + 1;
  let mode = 12, maxCount = 0;
  for (const [h, c] of Object.entries(freq)) {
    if (c > maxCount) { maxCount = c; mode = Number(h); }
  }
  return mode;
}

/**
 * GET /api/admin/users/:id/vocabulary-stats
 * Per-user vocabulary and semantic metrics for admin inspection.
 * Admin-only. No auth check here (handled by route middleware).
 */
export const getUserVocabularyStats = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const startTime = Date.now();

  const freq: Record<string, number> = {};

  // 1. Goal trees
  const { data: trees } = await supabase.from('goal_trees').select('nodes').eq('user_id', userId);
  for (const tree of trees ?? []) {
    const nodes: any[] = Array.isArray((tree as any).nodes) ? (tree as any).nodes : [];
    for (const node of nodes) {
      const text = [node.name, node.customDetails, node.description, node.completionMetric]
        .filter(Boolean).join(' ').toLowerCase();
      for (const w of extractWords(text)) freq[w] = (freq[w] ?? 0) + 1;
    }
  }

  // 2. Diary entries (non-private, last 50)
  const { data: diaryEntries } = await supabase
    .from('diary_entries')
    .select('content, mood, occurred_at')
    .eq('user_id', userId)
    .eq('is_private', false)
    .not('content', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(50);
  const moods: number[] = [];
  const hours: number[] = [];
  let totalEntryChars = 0;
  let entryCount = 0;
  for (const e of diaryEntries ?? []) {
    if (e.content) {
      for (const w of extractWords(e.content)) freq[w] = (freq[w] ?? 0) + 1;
      totalEntryChars += e.content.length;
      entryCount++;
    }
    if (e.mood != null) moods.push(Number(e.mood));
    if (e.occurred_at) hours.push(new Date(e.occurred_at).getHours());
  }

  // 3. Notebook entries (non-private, last 50)
  const { data: notebookEntries } = await supabase
    .from('notebook_entries')
    .select('content, mood, occurred_at')
    .eq('user_id', userId)
    .eq('is_private', false)
    .not('content', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(50);
  for (const e of notebookEntries ?? []) {
    if (e.content) {
      for (const w of extractWords(e.content)) freq[w] = (freq[w] ?? 0) + 1;
      totalEntryChars += e.content.length;
      entryCount++;
      if (e.occurred_at) hours.push(new Date(e.occurred_at).getHours());
    }
  }

  // 4. Check-in notes (last 100)
  const { data: checkins } = await supabase
    .from('checkins')
    .select('notes, checked_in_at')
    .eq('user_id', userId)
    .not('notes', 'is', null)
    .order('checked_in_at', { ascending: false })
    .limit(100);
  for (const c of checkins ?? []) {
    if (c.notes) {
      for (const w of extractWords(c.notes)) freq[w] = (freq[w] ?? 0) + 1;
      if (c.checked_in_at) hours.push(new Date(c.checked_in_at).getHours());
    }
  }

  // Compute vocabulary metrics
  const allWords = Object.entries(freq);
  const totalWords = allWords.reduce((s, [, c]) => s + c, 0);
  const uniqueWords = allWords.length;

  const sortedWords = allWords.sort(([, a], [, b]) => b - a);
  const top10Sum = sortedWords.slice(0, 10).reduce((s, [, c]) => s + c, 0);
  const topWords = sortedWords.slice(0, 30).map(([word, count]) => ({ word, count }));

  const vocabularyRichness = totalWords > 0 ? uniqueWords / totalWords : 0;
  const variationIndex = totalWords > 0 ? 1 - (top10Sum / totalWords) : 0;

  // Interest tags: use top words that map to domain keywords
  const interestTags: string[] = [];
  const tagScores: Record<string, number> = {};
  for (const [word, count] of sortedWords.slice(0, 50)) {
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.includes(word)) {
        tagScores[domain] = (tagScores[domain] ?? 0) + count;
      }
    }
  }
  const sortedTags = Object.entries(tagScores).sort(([, a], [, b]) => b - a);
  for (const [tag] of sortedTags.slice(0, 10)) {
    interestTags.push(tag);
  }

  // Targeting scores: per-domain ratio of domain-relevant words to total
  const targetingScores: Record<string, number> = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let domainHits = 0;
    for (const [word, count] of allWords) {
      if (keywords.includes(word)) domainHits += count;
    }
    targetingScores[domain] = totalWords > 0 ? +(domainHits / totalWords).toFixed(3) : 0;
  }

  // Mood stats
  const avgMood = moods.length > 0 ? +(moods.reduce((s, v) => s + v, 0) / moods.length).toFixed(1) : 0;
  const moodVariance = moods.length > 0 ? +stdDev(moods).toFixed(2) : 0;

  // Tone & positivity
  const dominantTone = classifyTone(freq);
  let posCount = 0, negCount = 0;
  for (const w of Object.keys(freq)) {
    if (POSITIVE_WORDS.has(w)) posCount += freq[w];
    if (NEGATIVE_WORDS.has(w)) negCount += freq[w];
  }
  const totalEmo = posCount + negCount;
  const positivityRatio = totalEmo > 0 ? +(posCount / totalEmo).toFixed(3) : 0.5;

  // Text affinity
  let textAffinityUsers: { userId: string; name: string; textAffinity: number }[] = [];
  let avgTextAffinityScore = 0;
  try {
    const { data: affinityMatches } = await supabase.rpc('match_profiles_by_text', {
      query_user_id: userId,
      match_limit: 5,
    });
    if (affinityMatches && affinityMatches.length > 0) {
      const affinityIds = affinityMatches.map((m: any) => m.matched_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', affinityIds);

      const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.name]));
      textAffinityUsers = affinityMatches.map((m: any) => ({
        userId: m.matched_user_id,
        name: nameMap.get(m.matched_user_id) ?? 'Unknown',
        textAffinity: +(m.text_score ?? 0).toFixed(3),
      }));

      const scores = affinityMatches.map((m: any) => m.text_score ?? 0).filter(Boolean);
      avgTextAffinityScore = scores.length > 0
        ? +(scores.reduce((s: number, v: number) => s + v, 0) / scores.length).toFixed(3)
        : 0;
    }
  } catch {
    // text affinity unavailable — skip
  }

  // Activity
  const mostActiveHour = modeValue(hours);
  const writingFrequency = entryCount > 0 ? +((entryCount / 30) * 7).toFixed(1) : 0;
  const avgEntryLength = entryCount > 0 ? Math.round(totalEntryChars / entryCount) : 0;

  logger.info(`[VocabStats] Computed for ${userId} (${Date.now() - startTime}ms, ${totalWords} tokens)`);

  res.json({
    totalWords,
    uniqueWords,
    vocabularyRichness: +vocabularyRichness.toFixed(3),
    variationIndex: +variationIndex.toFixed(3),
    topWords,
    interestTags,
    targetingScores,
    avgMood,
    moodVariance,
    dominantTone,
    positivityRatio: +positivityRatio.toFixed(3),
    topAffinityUsers: textAffinityUsers,
    avgTextAffinityScore,
    mostActiveHour,
    writingFrequency,
    avgEntryLength,
  });
});
