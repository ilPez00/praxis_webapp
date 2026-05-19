import { Router, Request, Response } from 'express';
import { PRAXIS_ONTOLOGY, VISUAL_HINTS } from '../models/PraxisOntology';
import { supabase } from '../lib/supabaseClient';
import { authenticateToken } from '../middleware/authenticateToken';
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

export default router;
