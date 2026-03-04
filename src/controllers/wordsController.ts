import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'up','out','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can','my',
  'i','me','you','it','its','this','that','these','those','all','not','no','so',
  'as','if','then','than','into','about','more','get','got','use','one','two',
  'also','just','their','they','our','we','his','her','him','who','what','when',
  'how','which','your','per','each','any','well','while','after','before',
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
