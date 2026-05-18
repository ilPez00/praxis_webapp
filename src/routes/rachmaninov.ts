import { Router, Request, Response } from 'express';
import { PRAXIS_ONTOLOGY, VISUAL_HINTS } from '../models/PraxisOntology';

const router = Router();

const ONTOLOGY_VERSION = '1.0.0';

/**
 * GET /api/rachmaninov/ontology
 *
 * Returns the live PraxisOntology and VISUAL_HINTS.
 * No auth — clients (Aura) cache locally and fall back to bundled copy.
 * ETags enable conditional GET: clients skip parsing if nothing changed.
 */
router.get('/ontology', (_req: Request, res: Response) => {
  const payload = {
    version: ONTOLOGY_VERSION,
    updatedAt: ONTOLOGY_LAST_MODIFIED,
    ontology: Object.fromEntries(
      Object.entries(PRAXIS_ONTOLOGY).map(([domain, def]) => [
        domain,
        {
          ayuDomain:    def.ayuDomain,
          defaultMode:  def.defaultMode,
          scoreAxis:    def.scoreAxis,
          unit:         def.unit,
          contextHints: def.contextHints,
        },
      ])
    ),
    visualHints: VISUAL_HINTS,
  };

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('ETag', `"${ONTOLOGY_VERSION}"`);

  if (_req.headers['if-none-match'] === `"${ONTOLOGY_VERSION}"`) {
    return res.status(304).end();
  }

  res.json(payload);
});

// ISO timestamp — bump when ontology changes to invalidate client caches.
const ONTOLOGY_LAST_MODIFIED = '2026-05-18T00:00:00Z';

export default router;
