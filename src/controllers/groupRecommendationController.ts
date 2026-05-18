import { supabase } from '../lib/supabaseClient';

/**
 * Recommends groups to users based on their saved goal domains
 * Params: user_id
 * Returns: list of suggested groups with domainScore
 */
export async function recommendGroups(userId: string) {
  // 1. Get user's goal domains
  const { data: goalTrees } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId);

  if (!goalTrees || !goalTrees[0]?.nodes) return [];

  const userDomains = [...new Set(goalTrees[0].nodes.map((n: any) => n.domain))];

  // 2. Fetch groups for each relevant domain
  const groupPromises = userDomains.map((domain: string) => {
    return supabase
      .from('chat_rooms')
      .select('*, chat_room_members(count)')
      .eq('domain', domain)
      .order('created_at', { ascending: false });
  });

  // 3. Process all group results
  const groupResults = await Promise.all(groupPromises);
  const allGroups: any[] = [].concat(...groupResults.map(r => r.data || []));

  return allGroups.map(group => ({
    ...group,
    domainScore: userDomains.includes(group.domain) ? 100 : 50,
  }));
}