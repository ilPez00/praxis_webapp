import app from './app';
import { AxiomScanService } from './services/AxiomScanService';

const port = process.env.PORT || 3001;

// Start server first
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${port}`);
});

// Start automated background tasks (non-blocking)
try {
  AxiomScanService.start();
  console.log('[Startup] AxiomScanService started successfully');
} catch (error: any) {
  console.error('[Startup] Failed to start AxiomScanService:', error.message);
  // Don't crash the server - this is non-critical
}
