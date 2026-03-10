import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';

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
