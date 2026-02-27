import app from '../src/app';

// Catch-all serverless function for all /api/* routes.
// Vercel file-system routing preserves req.url as the original request path
// (e.g., /api/groups, /api/posts), so Express routes everything correctly
// without any URL manipulation.
export default app;
