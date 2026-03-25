import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /health
 * Health check endpoint for uptime monitoring
 * Returns basic service status
 */
router.get('/', async (_req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'development',
  };

  res.json(health);
});

/**
 * GET /health/ready
 * Readiness check - verifies database connectivity
 * Use for Kubernetes readiness probes or load balancer health checks
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Test database connectivity with a simple query
    const { error } = await supabase.from('profiles').select('id').limit(1);

    if (error) {
      logger.error('Health check failed: Database connection error', error);
      return res.status(503).json({
        status: 'unhealthy',
        error: 'Database connection failed',
        details: error.message,
      });
    }

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err: any) {
    logger.error('Health check failed:', err.message);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      details: err.message,
    });
  }
});

/**
 * GET /health/live
 * Liveness check - basic process health
 * Use for Kubernetes liveness probes
 */
router.get('/live', (_req: Request, res: Response) => {
  // Basic check - if the server responds, it's alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
  });
});

export default router;
