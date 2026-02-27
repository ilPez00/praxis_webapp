import app from '../src/app';
import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // Vercel's `rewrites` set req.url to the rewrite destination (/api),
  // discarding the original path. The original URL is preserved in the
  // x-vercel-original-url header. Restore it so Express can route
  // /api/groups, /api/posts, /api/marketplace/purchase, etc. correctly.
  const originalUrl = (req.headers as Record<string, string | string[]>)['x-vercel-original-url'];
  if (originalUrl && typeof originalUrl === 'string') {
    try {
      req.url = new URL(originalUrl).pathname + (new URL(originalUrl).search || '');
    } catch {
      // keep req.url as-is
    }
  }
  return (app as any)(req, res);
}
