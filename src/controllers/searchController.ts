import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';

// GET /search?q=<query>&type=users|coaches|groups|all
export const search = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { q = '', type = 'all' } = req.query as { q?: string; type?: string };
  const query = q.trim();

  if (!query) {
    return res.status(200).json({ users: [], coaches: [], groups: [] });
  }

  const results: { users?: any[]; coaches?: any[]; groups?: any[] } = {};

  if (type === 'all' || type === 'users') {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, bio')
      .ilike('name', `%${query}%`)
      .limit(10);

    results.users = users ?? [];
  }

  if (type === 'all' || type === 'coaches') {
    const { data: allCoaches } = await supabase
      .from('coach_profiles')
      .select('*, profiles(id, name, avatar_url, is_premium)')
      .eq('is_available', true)
      .limit(50);

    if (allCoaches) {
      const lq = query.toLowerCase();
      results.coaches = allCoaches.filter((c: any) => {
        const bioMatch = c.bio?.toLowerCase().includes(lq);
        const skillsMatch = Array.isArray(c.skills) && c.skills.some((s: string) => s.toLowerCase().includes(lq));
        const domainsMatch = Array.isArray(c.domains) && c.domains.some((d: string) => d.toLowerCase().includes(lq));
        const nameMatch = c.profiles?.name?.toLowerCase().includes(lq);
        return bioMatch || skillsMatch || domainsMatch || nameMatch;
      }).slice(0, 10);
    } else {
      results.coaches = [];
    }
  }

  if (type === 'all' || type === 'groups') {
    const { data: groups } = await supabase
      .from('chat_rooms')
      .select('id, name, description, domain, created_at')
      .ilike('name', `%${query}%`)
      .limit(10);

    results.groups = groups ?? [];
  }

  return res.status(200).json(results);
});
