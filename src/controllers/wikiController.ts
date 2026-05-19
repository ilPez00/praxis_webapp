import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AxiomWikiSearchService } from '../services/AxiomWikiSearchService';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

const wikiSearch = new AxiomWikiSearchService();

const PAGE_ICONS: Record<string, string> = {
  'persona.md':        '🧠',
  'goals.md':          '🎯',
  'recent_themes.md':  '🔖',
  'mood_trends.md':    '📊',
  'narrative.md':      '📖',
};

/**
 * GET /wiki/pages
 * List all wiki pages for the authenticated user.
 * Returns metadata only — no content (zero token cost for listing).
 */
export const listWikiPages = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('axiom_wiki_pages')
    .select('page_path, frontmatter, token_count, generated_by, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return res.json({ pages: [] });

  const pages = (data || []).map((row: any) => ({
    path: row.page_path,
    title: row.frontmatter?.title || row.page_path.replace('.md', '').replace('_', ' '),
    description: row.frontmatter?.description || '',
    tags: row.frontmatter?.tags || [],
    confidence: row.frontmatter?.confidence,
    tokenCount: row.token_count || 0,
    generatedBy: row.generated_by,
    updatedAt: row.updated_at,
    icon: PAGE_ICONS[row.page_path] || '📄',
  }));

  res.json({ pages });
});

/**
 * GET /wiki/pages/:path
 * Return full content of one wiki page.
 * Content is full markdown — for human reading, not AI context.
 */
export const getWikiPage = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const pagePath = decodeURIComponent(String(req.params.path));

  const { data, error } = await supabase
    .from('axiom_wiki_pages')
    .select('page_path, frontmatter, content, token_count, generated_by, updated_at')
    .eq('user_id', userId)
    .eq('page_path', pagePath)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Page not found.' });

  res.json({
    path: data.page_path,
    title: data.frontmatter?.title || pagePath,
    description: data.frontmatter?.description || '',
    tags: data.frontmatter?.tags || [],
    confidence: data.frontmatter?.confidence,
    tokenCount: data.token_count || 0,
    generatedBy: data.generated_by,
    updatedAt: data.updated_at,
    icon: PAGE_ICONS[data.page_path] || '📄',
    content: data.content,
  });
});

/**
 * GET /wiki/search?q=text&limit=5
 * Snippet-only search — uberwiki style: ≤400 tokens total, segmented by page.
 * Never returns full page content.
 */
export const searchWiki = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });

  const limit = Math.min(Number(req.query.limit) || 5, 10);

  // Use existing service — already token-capped at ~50 tokens/snippet
  const snippets = await wikiSearch.search(userId, q, limit);

  const results = snippets.map(s => ({
    path: s.pagePath,
    snippet: s.snippet.slice(0, 300), // hard cap per snippet
    score: s.score,
    icon: PAGE_ICONS[s.pagePath] || '📄',
  }));

  res.json({ results, query: q });
});
