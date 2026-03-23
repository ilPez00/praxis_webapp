import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError } from '../utils/appErrors';

const VALID_SEARCH_TYPES = ['all', 'users', 'coaches', 'groups', 'events', 'places', 'notes'];
const MAX_QUERY_LENGTH = 100;

// GET /search?q=<query>&type=users|coaches|groups|events|places|notes|all
export const search = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { q = '', type = 'all' } = req.query as { q?: string; type?: string };
  const query = q.trim().slice(0, MAX_QUERY_LENGTH);

  if (!query) {
    return res.status(200).json({ users: [], coaches: [], groups: [], events: [], places: [], notes: [] });
  }

  if (!VALID_SEARCH_TYPES.includes(type)) {
    throw new BadRequestError(`Invalid type. Valid types: ${VALID_SEARCH_TYPES.join(', ')}`);
  }

  const results: { users?: any[]; coaches?: any[]; groups?: any[]; events?: any[]; places?: any[]; notes?: any[] } = {};

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

  if (type === 'all' || type === 'events') {
    const { data: events } = await supabase
      .from('events')
      .select('id, title, description, event_date, event_time, city, location, creator:profiles!creator_id(name)')
      .ilike('title', `%${query}%`)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
      .limit(10);

    results.events = events ?? [];
  }

  if (type === 'all' || type === 'places') {
    const { data: places } = await supabase
      .from('places')
      .select('id, name, type, address, city, latitude, longitude, description')
      .or(`name.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(15);

    results.places = places ?? [];
  }

  if (type === 'all' || type === 'notes') {
    const { data: notes } = await supabase
      .from('notebook_entries')
      .select('id, entry_type, title, content, domain, tags, occurred_at')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('occurred_at', { ascending: false })
      .limit(15);

    results.notes = notes ?? [];
  }

  return res.status(200).json(results);
});
