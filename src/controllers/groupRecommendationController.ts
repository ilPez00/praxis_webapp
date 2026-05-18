import { supabase } from '../lib/supabaseClient';

/**
 * Recommends groups to users based on their saved goal domains.
 * Returns list of suggested groups with domainScore.
 */
export async function recommendGroups(userId: string): Promise<any[]> {
  const { data: goalTrees } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId);

  if (!goalTrees || !goalTrees[0]?.nodes) return [];

  const userDomains: string[] = [
    ...new Set<string>((goalTrees[0].nodes as any[]).map((n: any) => n.domain as string)),
  ];

  const groupResults = await Promise.all(
    userDomains.map((domain: string) =>
      supabase
        .from('chat_rooms')
        .select('*, chat_room_members(count)')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
    )
  );

  const allGroups: any[] = ([] as any[]).concat(
    ...groupResults.map(r => r.data || [])
  );

  return allGroups.map(group => ({
    ...group,
    domainScore: userDomains.includes(group.domain) ? 100 : 50,
  }));
}
