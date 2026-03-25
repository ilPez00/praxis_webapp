/**
 * Sentry Frontend Configuration
 * 
 * Setup:
 * 1. Add SENTRY_DSN_REACT to client/.env
 * 2. Create "praxis-frontend" project in Sentry
 */

import * as Sentry from '@sentry/react';

export function initSentryReact() {
  const dsn = import.meta.env.VITE_SENTRY_DSN_REACT;
  
  if (!dsn) {
    console.warn('[Sentry React] DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    
    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Performance traces sample rate
    tracesSampleRate: 0.1, // Capture 10% of transactions
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // Record 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Record 100% of sessions with errors
    
    // Environment
    environment: import.meta.env.MODE || 'development',
    
    // Release tracking
    release: import.meta.env.npm_package_version || 'unknown',
    
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
      
      // React-specific (non-critical)
      /ResizeObserver loop limit exceeded/,
      /Non-Error promise rejection captured/,
    ],
    
    // Before sending event, filter/modify if needed
    beforeSend(event, hint) {
      // Don't send events from localhost
      if (window.location.hostname === 'localhost') {
        return null;
      }
      return event;
    },
  });

  console.log('[Sentry React] Initialized successfully');
}

// Export for use in components
export { Sentry };
