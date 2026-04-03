import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook that fetches and caches the current user's Praxis Points.
 *
 * Usage:
 *   const { points, loading, refresh } = useUserPoints(userId);
 *
 * Returns:
 *   - points: number | null (null while loading/error)
 *   - loading: boolean
 *   - refresh: function to manually refetch
 *   - spend: async function to deduct points (optimistic update + rollback on error)
 */
export const useUserPoints = (userId: string | null | undefined) => {
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPoints = useCallback(async () => {
    if (!userId) {
      setPoints(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('praxis_points')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[useUserPoints] Error fetching points:', error);
        setPoints(0);
      } else {
        setPoints(data?.praxis_points ?? 0);
      }
    } catch (err) {
      console.error('[useUserPoints] Fetch error:', err);
      setPoints(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  /**
   * Optimistically deduct points from the local state.
   * If the API call fails, rolls back to the previous value.
   *
   * @param amount - points to spend
   * @param endpoint - API endpoint to call (e.g. '/bets', '/points/spend')
   * @param body - request body for the API call
   * @returns the API response data, or null on failure
   */
  const spend = async (
    amount: number,
    endpoint: string,
    body?: Record<string, any>,
  ): Promise<any | null> => {
    if (points === null || points < amount) return null;

    const previous = points;
    setPoints(prev => (prev !== null ? prev - amount : null));

    try {
      const api = (await import('../lib/api')).default;
      const res = await api.post(endpoint, { points: amount, ...body });

      // Refresh from server to ensure consistency
      await fetchPoints();
      return res.data;
    } catch (err) {
      console.error('[useUserPoints] Spend error:', err);
      // Rollback
      setPoints(previous);
      return null;
    }
  };

  return { points, loading, refresh: fetchPoints, spend };
};
