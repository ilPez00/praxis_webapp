import app from './app';
import { AxiomScanService } from './services/AxiomScanService';

const port = process.env.PORT || 3001;

// Start automated background tasks
AxiomScanService.start();

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
