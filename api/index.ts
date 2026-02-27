import app from '../src/app';

export default function handler(req: any, res: any) {
  // Vercel rewrites /api/:path* → /api?_vp=:path*, overwriting req.url.
  // Restore the original path so Express can route to the correct handler.
  const raw: string = req.url || '';
  const qStart = raw.indexOf('?');
  const params = new URLSearchParams(qStart >= 0 ? raw.slice(qStart + 1) : '');
  const vp = params.get('_vp');

  if (vp) {
    params.delete('_vp');
    const qs = params.toString();
    req.url = `/api/${vp}${qs ? '?' + qs : ''}`;
    // Clean up Vercel's pre-parsed query object if present
    if (req.query && '_vp' in req.query) delete req.query._vp;
  }

  return app(req, res);
}
