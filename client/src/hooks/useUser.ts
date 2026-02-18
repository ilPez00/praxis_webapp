import { useState, useEffect } from 'react';
import { User } from '../models/User'; // Import the User interface
import { supabase } from '../lib/supabase'; // Import the Supabase client

/**
 * @description Custom React hook to manage and provide the authenticated user's data.
 * It fetches the user's authentication state and their associated profile from Supabase,
 * including premium status.
 * @returns An object containing the user object, and a loading state.
 */
export const useUser = () => {
  const [user, setUser] = useState<User | null>(null); // State to store the authenticated user's data
  const [loading, setLoading] = useState(true); // State to indicate if user data is being loaded

  useEffect(() => {
    /**
     * @description Fetches the authenticated user's profile from Supabase.
     * This involves getting the auth user and then their corresponding profile entry.
     */
    const fetchUserProfile = async () => {
      setLoading(true); // Set loading to true at the start of fetch
      try {
        // First, get the authentication user from Supabase
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          console.error('Error fetching auth user:', authError);
          setUser(null); // Clear user if authentication fails
          setLoading(false);
          return;
        }

        if (authUser) {
          // If an authenticated user exists, fetch their detailed profile from the 'profiles' table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*') // Select all columns from the profile
            .eq('id', authUser.id) // Match profile by auth user's ID
            .single(); // Expect a single result

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
            setUser(null); // Clear user if profile fetching fails
            setLoading(false);
            return;
          }

          if (profile) {
            // Construct the User object, combining auth data and profile data
            const fetchedUser: User = {
              id: profile.id,
              email: authUser.email || '', // Fallback for email if not present
              name: profile.name,
              age: profile.age,
              bio: profile.bio,
              avatarUrl: profile.avatar_url, // Use avatar_url from profile
              is_premium: profile.is_premium, // Include the premium status
              goalTree: [], // Goal tree is typically fetched separately if needed in detail
            };
            setUser(fetchedUser);
          } else {
            setUser(null); // No profile found for authenticated user
          }
        } else {
          setUser(null); // No authenticated user
        }
      } catch (error) {
        console.error('Unexpected error in useUser hook:', error);
        setUser(null);
      } finally {
        setLoading(false); // Set loading to false once fetching is complete
      }
    };

    fetchUserProfile(); // Initial fetch when the component mounts

    // Set up a listener for authentication state changes (login, logout, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(); // Re-fetch profile if authentication state changes (e.g., user logs in)
      } else {
        setUser(null); // Clear user if logged out
        setLoading(false);
      }
    });

    // Cleanup function to unsubscribe from the auth listener when the component unmounts
    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  return { user, loading }; // Provide the user object and loading state
};
