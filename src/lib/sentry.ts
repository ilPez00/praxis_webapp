/**
 * Sentry Error Tracking Configuration
 * 
 * Setup:
 * 1. Create Sentry account at https://sentry.io
 * 2. Create two projects: "praxis-backend" and "praxis-frontend"
 * 3. Add SENTRY_DSN and SENTRY_DSN_REACT to .env
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('[Sentry] DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions
    
    // Error Sampling (reduce noise in production)
    sampleRate: 1.0, // Capture all errors
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Release tracking
    release: process.env.npm_package_version || 'unknown',
    
    // Integrations
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(), // Auto-instrument HTTP requests
    ],
    
    // Profiling
    profilesSampleRate: 0.1, // Profile 10% of sampled transactions
    
    // Filter out health check transactions
    beforeSendTransaction(event) {
      if (event.transaction?.includes('GET /') || 
          event.transaction?.includes('health')) {
        return null;
      }
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      /top\.globals/,
      /chrome-extension:/i,
      /moz-extension:/i,
      
      // Network errors
      /NetworkError/,
      /Network request failed/,
      
      // Random plugins/extensions
      /atomicFindClose/,
      /fb_xd_fragment/,
      
      // Other plugins
      /CanvasRenderingContext2D/,
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

// Export Sentry for manual error reporting
export { Sentry };
