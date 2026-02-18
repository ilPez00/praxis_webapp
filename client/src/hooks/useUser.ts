import { useState, useEffect } from 'react';
import { User } from '../models/User';
import { supabase } from '../lib/supabase'; // Import Supabase client

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          console.error('Error fetching auth user:', authError);
          setUser(null);
          setLoading(false);
          return;
        }

        if (authUser) {
          // Fetch user profile from the 'profiles' table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
            setUser(null);
            setLoading(false);
            return;
          }

          if (profile) {
            const fetchedUser: User = {
              id: profile.id,
              email: authUser.email || '',
              name: profile.name,
              age: profile.age,
              bio: profile.bio,
              avatarUrl: profile.avatar_url,
              is_premium: profile.is_premium, // Include is_premium
              goalTree: [], // This might be fetched separately or not needed here
            };
            setUser(fetchedUser);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Unexpected error in useUser hook:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(); // Re-fetch profile if auth state changes (e.g., login/logout)
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  return { user, loading };
};
