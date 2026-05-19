import { Router, Request, Response } from 'express';
import { PRAXIS_ONTOLOGY, VISUAL_HINTS } from '../models/PraxisOntology';
import { supabase } from '../lib/supabaseClient';
import { authenticateToken } from '../middleware/authenticateToken';
import { rachmachinovOrchestrator } from '../services/RachmachinovOrchestrator';
import logger from '../utils/logger';

const router = Router();

// Bumped on every PATCH override — forces Aura cache bust via ETag mismatch
let runtimeVersion = 0;

const BASE_VERSION = '1.0.0';

function currentETag(): string {
  return runtimeVersion > 0 ? `"${BASE_VERSION}-r${runtimeVersion}"` : `"${BASE_VERSION}"`;
}

async function getOverrides(): Promise<Record<string, Partial<{
  contextHints: string[];
  unit: string;
  defaultMode: string;
  ayuDomain: string;
}>>> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'rachmaninov_overrides')
      .maybeSingle();
    return (data?.value as any) ?? {};
  } catch {
    return {};
  }
}

/**
 * GET /api/rachmaninov/ontology
 * Returns PRAXIS_ONTOLOGY + VISUAL_HINTS, merged with any admin overrides.
 * No auth. ETag-based conditional GET. Aura falls back to bundled copy.
 */
router.get('/ontology', async (_req: Request, res: Response) => {
  const etag = currentETag();

  if (_req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const overrides = await getOverrides();

  const ontology = Object.fromEntries(
    Object.entries(PRAXIS_ONTOLOGY).map(([domain, def]) => {
      const ov = overrides[domain] ?? {};
      return [
        domain,
        {
          ayuDomain:    ov.ayuDomain    ?? def.ayuDomain,
          defaultMode:  ov.defaultMode  ?? def.defaultMode,
          scoreAxis:    def.scoreAxis,
          unit:         ov.unit         ?? def.unit,
          contextHints: ov.contextHints ?? def.contextHints,
        },
      ];
    })
  );

  const payload = {
    version: etag.replace(/"/g, ''),
    updatedAt: new Date().toISOString(),
    ontology,
    visualHints: VISUAL_HINTS,
  };

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('ETag', etag);
  res.json(payload);
});

/**
 * PATCH /api/rachmaninov/ontology/domain/:domain
 * Admin-only. Override one or more fields of a domain definition.
 * Body: { contextHints?: string[], unit?: string, defaultMode?: string }
 * Bumps runtimeVersion → next GET returns new ETag → Aura cache-busts.
 */
router.patch('/ontology/domain/:domain', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user?.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Admin only.' });
    }

    const domain = String(req.params.domain);
    const { contextHints, unit, defaultMode, ayuDomain } = req.body;

    if (!PRAXIS_ONTOLOGY[domain as keyof typeof PRAXIS_ONTOLOGY]) {
      return res.status(400).json({ error: `Unknown domain: ${domain}` });
    }

    const current = await getOverrides();
    current[domain] = {
      ...(current[domain] ?? {}),
      ...(contextHints !== undefined ? { contextHints } : {}),
      ...(unit         !== undefined ? { unit }         : {}),
      ...(defaultMode  !== undefined ? { defaultMode }  : {}),
      ...(ayuDomain    !== undefined ? { ayuDomain }    : {}),
    };

    await supabase.from('system_config').upsert({
      key: 'rachmaninov_overrides',
      value: current,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    runtimeVersion++;
    const newETag = currentETag();

    logger.info(`[Rachmaninov] Domain ${domain} updated by admin ${req.user?.id} → ETag ${newETag}`);
    res.json({ ok: true, domain, newETag, overrides: current[domain] });
  } catch (err: any) {
    logger.error('[Rachmaninov] PATCH failed:', err.message);
    res.status(500).json({ error: 'Update failed.' });
  }
});

/**
 * GET /api/rachmaninov/ontology/overrides
 * Admin-only. Returns current overrides for the admin UI.
 */
router.get('/ontology/overrides', authenticateToken, async (req: Request, res: Response) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.user?.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Admin only.' });
  }

  const overrides = await getOverrides();
  res.json({ overrides, etag: currentETag() });
});

/**
 * DELETE /api/rachmaninov/ontology/domain/:domain/override
 * Admin-only. Remove override for a domain (revert to static).
 */
router.delete('/ontology/domain/:domain/override', authenticateToken, async (req: Request, res: Response) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.user?.id)
    .maybeSingle();

  if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only.' });

  const domain = String(req.params.domain);
  const current = await getOverrides();
  delete current[domain];

  await supabase.from('system_config').upsert({
    key: 'rachmaninov_overrides',
    value: current,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  runtimeVersion++;
  res.json({ ok: true, domain, removed: true, newETag: currentETag() });
});

/**
 * GET /api/rachmaninov/bridge
 * Aura wiki bridge — returns user's Axiom wiki pages + goal entities
 * in uberwiki notes/bridge JSON format, ready for WikiNotesImporter.
 *
 * Auth: PAT (x-api-key: pk_live_...) or Supabase JWT (Bearer ...).
 * ETag: ISO timestamp of most-recently updated wiki page.
 * 304 returned when Aura's cached ETag matches — no body sent.
 */
router.get('/bridge', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const [wikiRes, goalsRes] = await Promise.all([
      supabase
        .from('axiom_wiki_pages')
        .select('page_path, frontmatter, content, token_count, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const pages = wikiRes.data || [];
    const nodes: any[] = goalsRes.data?.nodes || [];

    // ETag = most recent wiki updated_at (changes once per nightly write)
    const latestAt = pages[0]?.updated_at ?? new Date().toISOString();
    const etag = `"wiki-${latestAt}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    // notes array — uberwiki notes-export format
    const notes = pages.map((p: any) => ({
      title:     p.frontmatter?.title   || p.page_path.replace('.md', ''),
      body:      p.content              || '',
      tags:      [...(p.frontmatter?.tags || []), p.page_path.replace('.md', ''), 'axiom', 'wiki'],
      source:    'axiom',
      kind:      'synthesis',
      timestamp: new Date(p.updated_at).getTime(),
    }));

    // entities array — goal nodes as named entities
    const entities = nodes
      .filter((n: any) => n.name || n.title)
      .map((n: any) => ({
        name: n.name || n.title,
        tags: [n.domain || 'goal', 'goal', 'praxis'],
      }));

    const payload = {
      version:   etag.replace(/"/g, ''),
      updatedAt: latestAt,
      notes,
      entities,
      relations: [],
    };

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.json(payload);

  } catch (err: any) {
    logger.error('[Rachmaninov] /bridge failed:', err.message);
    res.status(500).json({ error: 'Bridge generation failed.' });
  }
});

// ── Per-user ontology overrides ───────────────────────────────────────────────

async function getUserOverrides(userId: string): Promise<Record<string, any>> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', `rachmaninov_overrides_${userId}`)
      .maybeSingle();
    return (data?.value as any) ?? {};
  } catch {
    return {};
  }
}

/**
 * GET /api/rachmaninov/user-ontology
 * Returns PRAXIS_ONTOLOGY merged with this user's own overrides.
 */
router.get('/user-ontology', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const overrides = await getUserOverrides(userId);

  const ontology = Object.fromEntries(
    Object.entries(PRAXIS_ONTOLOGY).map(([domain, def]) => {
      const ov = overrides[domain] ?? {};
      return [domain, {
        ayuDomain:    ov.ayuDomain    ?? def.ayuDomain,
        defaultMode:  ov.defaultMode  ?? def.defaultMode,
        scoreAxis:    def.scoreAxis,
        unit:         ov.unit         ?? def.unit,
        contextHints: ov.contextHints ?? def.contextHints,
        color:        (def as any).color ?? '#6366F1',
        icon:         (def as any).icon  ?? '◈',
      }];
    })
  );

  res.json({ ontology, overrides, updatedAt: new Date().toISOString() });
});

/**
 * PATCH /api/rachmaninov/user-ontology/domain/:domain
 * Any authenticated user can override their own domain definitions.
 */
router.patch('/user-ontology/domain/:domain', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const domain = String(req.params.domain);
  if (!PRAXIS_ONTOLOGY[domain as keyof typeof PRAXIS_ONTOLOGY]) {
    return res.status(400).json({ error: `Unknown domain: ${domain}` });
  }

  const { contextHints, unit, defaultMode, ayuDomain } = req.body;
  const current = await getUserOverrides(userId);

  current[domain] = {
    ...(current[domain] ?? {}),
    ...(contextHints !== undefined ? { contextHints } : {}),
    ...(unit         !== undefined ? { unit }         : {}),
    ...(defaultMode  !== undefined ? { defaultMode }  : {}),
    ...(ayuDomain    !== undefined ? { ayuDomain }    : {}),
  };

  await supabase.from('system_config').upsert({
    key: `rachmaninov_overrides_${userId}`,
    value: current,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  logger.info(`[Rachmaninov] User ${userId} updated domain ${domain}`);
  res.json({ ok: true, domain, overrides: current[domain] });
});

/**
 * DELETE /api/rachmaninov/user-ontology/domain/:domain
 * Remove user's override for a domain (revert to global default).
 */
router.delete('/user-ontology/domain/:domain', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const domain = String(req.params.domain);
  const current = await getUserOverrides(userId);
  delete current[domain];

  await supabase.from('system_config').upsert({
    key: `rachmaninov_overrides_${userId}`,
    value: current,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  res.json({ ok: true, domain, removed: true });
});

// ── Orchestrator endpoints ────────────────────────────────────────────────────

/**
 * GET /api/rachmaninov/context?query=<text>
 * Assembles goal snapshot + wiki snippets + dream proposals for Aura.
 * Returns OrchestratorContext JSON + pre-formatted [RACHMANINOV CONTEXT] block.
 */
router.get('/context', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const query = String(req.query.query || '').trim();

  try {
    const ctx = await rachmachinovOrchestrator.assembleContext(userId, query);
    const block = rachmachinovOrchestrator.formatContextBlock(ctx);
    res.json({ ...ctx, contextBlock: block });
  } catch (err: any) {
    logger.error('[Rachmaninov] /context failed:', err.message);
    res.status(500).json({ error: 'Context assembly failed.' });
  }
});

/**
 * GET /api/rachmaninov/community-patterns?sector=HEAL&k=20
 * Returns sterile community flows for a sector — seeds Aura's local DreamEngine corpus.
 * sector: ayuDomain (HEAL | CONSTRUCT | FABRICATE | STUDY | BOND). Omit for all.
 * k: max flows returned (default 20, max 50).
 */
router.get('/community-patterns', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const sector = String(req.query.sector || '').trim().toUpperCase() || undefined;
  const k = Math.min(Number(req.query.k) || 20, 50);

  const validSectors = new Set(['HEAL', 'CONSTRUCT', 'FABRICATE', 'STUDY', 'BOND']);
  if (sector && !validSectors.has(sector)) {
    return res.status(400).json({ error: `Unknown sector: ${sector}. Must be one of ${[...validSectors].join(', ')}.` });
  }

  try {
    const flows = await rachmachinovOrchestrator.getCommunityPatterns(sector, k);
    res.json({ flows, sector: sector ?? 'ALL', count: flows.length });
  } catch (err: any) {
    logger.error('[Rachmaninov] /community-patterns failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch community patterns.' });
  }
});

/**
 * POST /api/rachmaninov/checkin-signal
 * Called after every goal checkin. Triggers PDCA-aware side-effects:
 *   - Pushes sterile flow to community_flows on goal success (grade >= 0.85, progress >= 1.0)
 *   - Suppresses dreaming for 8h on this sector when goal is confirmed working (grade >= 0.7)
 *
 * Body: { goalId, goalName, goalDomain, grade, progressDelta, currentProgress, recentAction? }
 */
router.post('/checkin-signal', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const { goalId, goalName, goalDomain, grade, progressDelta, currentProgress, recentAction } = req.body;

  if (!goalId || typeof grade !== 'number') {
    return res.status(400).json({ error: 'goalId and grade (number) required.' });
  }

  try {
    const result = await rachmachinovOrchestrator.onCheckin(
      userId,
      String(goalId),
      String(goalName ?? ''),
      String(goalDomain ?? ''),
      Number(grade),
      Number(progressDelta ?? 0),
      Number(currentProgress ?? 0),
      recentAction ? String(recentAction) : undefined,
    );
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error('[Rachmaninov] /checkin-signal failed:', err.message);
    res.status(500).json({ error: 'Checkin signal failed.' });
  }
});

export default router;
