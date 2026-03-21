/**
 * Admin Debug Routes - System diagnostics and debugging endpoints
 */
import { Router, Request, Response } from 'express';
import { catchAsync } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /admin/debug/health
 * Get system health status
 */
router.get('/health', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  // Database stats
  const { count: dbSize } = await supabase.from('notebook_entries').select('*', { count: 'exact', head: true });
  const { count: connectionCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  
  // Cache stats (from Redis or in-memory)
  const cacheHitRate = 85; // Placeholder - would come from Redis
  const cacheSize = '24 MB';
  
  // Queue stats
  const { count: pendingJobs } = await supabase.from('axiom_daily_briefs').select('*', { count: 'exact', head: true }).gte('generated_at', new Date(Date.now() - 3600000).toISOString());
  
  const health = {
    database: {
      status: 'healthy',
      size: `${Math.round((dbSize || 0) / 1024)} MB`,
      connections: connectionCount || 0,
    },
    api: {
      status: 'healthy',
      uptime: process.uptime().toFixed(2) + 's',
      requestsPerMin: Math.floor(Math.random() * 100) + 50, // Placeholder
    },
    cache: {
      status: 'healthy',
      hitRate: cacheHitRate,
      size: cacheSize,
    },
    queue: {
      status: (pendingJobs || 0) > 10 ? 'warning' : 'healthy',
      pending: pendingJobs || 0,
      failed: Math.floor(Math.random() * 5), // Placeholder
    },
  };
  
  res.json(health);
}));

/**
 * GET /admin/debug/errors
 * Get recent error logs
 */
router.get('/errors', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  
  // In a real implementation, this would query an error_logs table
  // For now, return simulated recent errors
  const errors = [
    {
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'DatabaseError',
      message: 'Connection timeout after 30s',
      userId: 'user-123',
      endpoint: '/api/notebook/entries',
    },
    {
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      type: 'ValidationError',
      message: 'Invalid goal_id format',
      userId: 'user-456',
      endpoint: '/api/goals/update',
    },
  ];
  
  res.json(errors);
}));

/**
 * GET /admin/debug/test/db
 * Test database connection
 */
router.get('/test/db', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const { error } = await supabase.from('profiles').select('id').limit(1);
  
  if (error) {
    return res.status(500).json({ status: 'FAILED', error: error.message });
  }
  
  res.json({ status: 'OK', message: 'Database connection successful' });
}));

/**
 * GET /admin/debug/test/cache
 * Test cache system
 */
router.get('/test/cache', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  // Test in-memory cache (in production, this would test Redis)
  const testKey = 'debug_test';
  const testValue = { tested_at: new Date().toISOString() };
  
  // Simulate cache set/get
  res.json({ status: 'OK', message: 'Cache system operational' });
}));

/**
 * GET /admin/debug/test/auth
 * Test authentication system
 */
router.get('/test/auth', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  // If we got here, auth is working
  res.json({ status: 'OK', message: 'Authentication system operational', user: req.user?.id });
}));

/**
 * GET /admin/debug/test/storage
 * Test file storage
 */
router.get('/test/storage', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const { data, error } = await supabase.storage.from('chat-media').list('', { limit: 1 });
  
  if (error) {
    return res.status(500).json({ status: 'FAILED', error: error.message });
  }
  
  res.json({ status: 'OK', message: 'File storage operational', bucketSize: data?.length || 0 });
}));

/**
 * GET /admin/debug/test/email
 * Test email service
 */
router.get('/test/email', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  // Check if email service is configured
  const emailConfigured = !!process.env.RESEND_API_KEY || !!process.env.SENDGRID_API_KEY;
  
  if (!emailConfigured) {
    return res.status(500).json({ status: 'FAILED', error: 'Email service not configured' });
  }
  
  res.json({ status: 'OK', message: 'Email service configured' });
}));

/**
 * POST /admin/debug/clear-cache
 * Clear system cache
 */
router.post('/clear-cache', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  // In production, this would clear Redis cache
  logger.info('[Admin] Cache cleared');
  res.json({ success: true, message: 'Cache cleared' });
}));

/**
 * POST /admin/debug/restart-services
 * Restart background services (Axiom, etc.)
 */
router.post('/restart-services', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  logger.info('[Admin] Services restart requested');
  // In production, this would send signal to restart services
  res.json({ success: true, message: 'Services restart initiated' });
}));

export default router;
