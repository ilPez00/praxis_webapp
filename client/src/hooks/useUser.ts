import { useState, useEffect } from 'react';
import { User } from '../models/User'; // Assuming User model is available

// This is a placeholder hook for authentication.
// In a real application, this would fetch the authenticated user's data.
export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching user data
    const fetchUser = async () => {
      // For now, return a mock user
      const mockUser: User = {
        id: 'mock-user-id',
        email: 'mock@example.com',
        name: 'Mock User',
        age: 30,
        bio: 'This is a mock user for development purposes.',
        goalTree: [],
      };
      setUser(mockUser);
      setLoading(false);
    };

    fetchUser();
  }, []);

  return { user, loading };
};
