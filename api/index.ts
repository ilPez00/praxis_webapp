import app from '../src/app';

// Handles requests to exactly /api (no trailing path).
// All /api/* routes are handled by api/[...slug].ts.
export default app;
