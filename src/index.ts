import app from './app';
import { AxiomScanService } from './services/AxiomScanService';
import { AxiomMonthlySummaryService } from './services/AxiomMonthlySummaryService';
import { startFailsCron } from './services/failsCron';
import { startDuelResolutionCron } from './services/duelResolutionCron';
import { supabase } from './lib/supabaseClient';

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${port}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Shutdown] Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('[Shutdown] HTTP server closed');
    
    try {
      await supabase.auth.signOut();
      console.log('[Shutdown] Supabase connections closed');
    } catch (err) {
      console.error('[Shutdown] Error closing Supabase:', err);
    }
    
    console.log('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout');
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
  console.log('[Startup] Services started successfully');
} catch (error: any) {
  console.error('[Startup] Failed to start background services:', error.message);
}
