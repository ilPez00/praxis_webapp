import { createLogger, format, transports } from 'winston';
import * as crypto from 'crypto';
const { combine, timestamp, printf, colorize, json } = format;

// Simple UUID v4 generator using Node.js crypto (avoids ESM uuid package)
const generateUUID = () => {
  return crypto.randomUUID();
};

// Custom format for human-readable logs (development)
const devFormat = printf(({ level, message, timestamp, stack, traceId, userId, method, path, durationMs }) => {
  const meta = [
    traceId && `[${traceId}]`,
    userId && `(user:${userId})`,
    method && path && `${method} ${path}`,
    durationMs && `${durationMs}ms`,
  ].filter(Boolean).join(' ');
  
  return `${timestamp} ${level}: ${stack || message} ${meta ? '- ' + meta : ''}`;
});

// JSON format for production (structured logging)
const prodFormat = json();

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info', // Minimum level to log
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production' ? prodFormat : combine(colorize(), devFormat)
  ),
  defaultMeta: {
    service: 'praxis-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new transports.Console(), // Log to console
    // Uncomment for file logging:
    // new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new transports.File({ filename: 'logs/combined.log' }),
  ],
  exceptionHandlers: [
    new transports.Console(),
    // new transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.Console(),
    // new transports.File({ filename: 'logs/rejections.log' })
  ]
});

// ============================================================================
// Request Tracing Middleware
// ============================================================================

/**
 * Express middleware to add request tracing
 * Adds traceId to every request and logs request/response details
 */
export const requestTracer = (req: any, res: any, next: () => void) => {
  // Generate or extract trace ID
  const traceId = req.headers['x-trace-id'] as string || generateUUID();
  req.traceId = traceId;
  
  // Add trace ID to response headers
  res.setHeader('X-Trace-ID', traceId);
  
  // Record start time
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    traceId,
    userId: req.user?.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  // Log response on finish
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      traceId,
      userId: req.user?.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  
  // Log errors
  res.on('error', (err: Error) => {
    logger.error('Request error', {
      traceId,
      userId: req.user?.id,
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
    });
  });
  
  next();
};

// ============================================================================
// Security Audit Helper
// ============================================================================

/**
 * Check for service-role key exposure in client code
 * Run this on startup to warn about potential security issues
 */
export const auditSecurity = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  
  // Check if service key looks valid
  if (serviceKey && !serviceKey.startsWith('eyJ')) {
    logger.warn('SECURITY: Supabase service role key may be invalid or missing');
  }
  
  // Check if anon key is being used as service key (common mistake)
  if (serviceKey && serviceKey.startsWith('sb_')) {
    logger.error('SECURITY CRITICAL: Service role key appears to be anon/publishable key!');
    logger.error('This is a major security risk. Check your .env file immediately.');
  }
  
  // Log key types (not the keys themselves!)
  logger.info('Security audit', {
    serviceKeyConfigured: !!serviceKey,
    serviceKeyType: serviceKey.startsWith('eyJ') ? 'JWT (correct)' : serviceKey.startsWith('sb_') ? 'ANON (WRONG!)' : 'unknown',
    anonKeyConfigured: !!anonKey,
    nodeEnv: process.env.NODE_ENV,
  });
};

/**
 * Validate Stripe configuration on startup. Logs the state of each required
 * env var so production misconfigurations surface immediately in Railway logs
 * instead of failing silently the first time a customer tries to pay.
 */
export const auditStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  if (!secret) {
    logger.info('Stripe audit: STRIPE_SECRET_KEY not set — payments disabled');
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const mode = secret.startsWith('sk_live_') ? 'live' : secret.startsWith('sk_test_') ? 'test' : 'unknown';
  const monthlyPrice = process.env.STRIPE_PRICE_ID || '';
  const annualPrice = process.env.STRIPE_PRICE_ID_ANNUAL || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const clientUrl = process.env.CLIENT_URL || '';

  const issues: string[] = [];
  if (!monthlyPrice) issues.push('STRIPE_PRICE_ID missing (monthly subscription will 500)');
  if (!annualPrice) issues.push('STRIPE_PRICE_ID_ANNUAL missing (annual subscription will 500)');
  if (!webhookSecret) issues.push('STRIPE_WEBHOOK_SECRET missing (webhooks will 500)');
  if (!clientUrl) issues.push('CLIENT_URL missing (checkout success/cancel redirects will be malformed)');

  if (isProd && mode !== 'live') {
    issues.push(`STRIPE_SECRET_KEY is ${mode}, expected sk_live_* in production`);
  }
  if (isProd && monthlyPrice && !monthlyPrice.startsWith('price_')) {
    issues.push('STRIPE_PRICE_ID does not look like a Stripe price ID (price_…)');
  }
  if (isProd && webhookSecret && !webhookSecret.startsWith('whsec_')) {
    issues.push('STRIPE_WEBHOOK_SECRET does not look like a webhook secret (whsec_…)');
  }

  logger.info('Stripe audit', {
    mode,
    monthlyPriceConfigured: !!monthlyPrice,
    annualPriceConfigured: !!annualPrice,
    webhookSecretConfigured: !!webhookSecret,
    clientUrlConfigured: !!clientUrl,
    nodeEnv: process.env.NODE_ENV,
  });

  for (const msg of issues) {
    if (isProd) logger.error(`Stripe config: ${msg}`);
    else logger.warn(`Stripe config: ${msg}`);
  }
};

// ============================================================================
// Rate Limit Logging
// ============================================================================

/**
 * Log rate limit hits for monitoring
 */
export const logRateLimit = (req: any, retryAfter: number) => {
  logger.warn('Rate limit exceeded', {
    traceId: req.traceId,
    userId: req.user?.id,
    ip: req.ip,
    path: req.path,
    method: req.method,
    retryAfterSeconds: retryAfter,
  });
};

export default logger;
