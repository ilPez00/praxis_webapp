import { useState, useEffect, useCallback } from 'react';
import { User } from '../models/User';
import { supabase } from '../lib/supabase';

/**
 * Custom hook providing the authenticated user's full profile.
 *
 * Two-step flow:
 *   1. supabase.auth.getUser() — authoritative auth identity
 *   2. supabase.from('profiles').select() — app-level profile row
 *
 * Subscribes to onAuthStateChange; only re-fetches on SIGNED_IN / SIGNED_OUT
 * (not on every TOKEN_REFRESHED) to avoid unnecessary DB queries.
 */
export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setUser(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profile) {
        setUser(null);
        return;
      }

      setUser({
        id: profile.id,
        email: authUser.email || '',
        name: profile.name,
        age: profile.age,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        is_premium: profile.is_premium,
        onboarding_completed: profile.onboarding_completed,
        goal_tree_edit_count: profile.goal_tree_edit_count ?? 0,
        current_streak: profile.current_streak ?? 0,
        last_activity_date: profile.last_activity_date ?? undefined,
        praxis_points: profile.praxis_points ?? 0,
        streak_shield: profile.streak_shield ?? false,
        profile_boosted_until: profile.profile_boosted_until ?? undefined,
        badge: profile.badge ?? undefined,
        is_admin: profile.is_admin ?? false,
        goalTree: [],
      });
    } catch (error) {
      console.error('Unexpected error in useUser:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only re-fetch on meaningful auth transitions, not silent token refreshes
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchUserProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  return { user, loading, refetch: fetchUserProfile };
};
