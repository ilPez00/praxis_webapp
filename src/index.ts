import app from './app';
import logger from './utils/logger';
import { AxiomScanService } from './services/AxiomScanService';
import { AxiomMonthlySummaryService } from './services/AxiomMonthlySummaryService';
import { startFailsCron } from './services/failsCron';
import { startDuelResolutionCron } from './services/duelResolutionCron';
import { startDreamCron } from './services/DreamCron';
import { supabase } from './lib/supabaseClient';

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('[Shutdown] HTTP server closed');

    try {
      await supabase.auth.signOut();
      logger.info('[Shutdown] Supabase connections closed');
    } catch (err) {
      logger.error('[Shutdown] Error closing Supabase:', err);
    }

    logger.info('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('[Shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start automated background tasks (non-blocking)
try {
  AxiomScanService.start();
  AxiomMonthlySummaryService.start();
  startFailsCron();
  startDuelResolutionCron();
  startDreamCron();
  logger.info('[Startup] Services started successfully');
} catch (error: any) {
  logger.error('[Startup] Failed to start background services:', error.message);
}
