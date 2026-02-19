import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';

/**
 * PrivateRoute — guards all authenticated routes.
 *
 * Guard logic:
 *   1. While useUser() is loading, renders a plain loading indicator to prevent
 *      a flash-of-redirect while Supabase resolves the session.
 *   2. If no user is authenticated, redirects to /login.
 *   3. Onboarding guard: once the User model includes an `onboarding_completed`
 *      field (fetched from the profiles table via useUser), we can redirect new
 *      users to /onboarding here. Currently the field lives on the profiles row
 *      but not on the User model — add it there to activate the guard (Step 12).
 *   4. Otherwise, renders the nested <Outlet /> (the protected page).
 */
const PrivateRoute: React.FC = () => {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Onboarding guard placeholder — see Step 12 in claude_steps.txt for full implementation.
  // Activate by adding onboarding_completed to the User model and checking it here.

  return <Outlet />;
};

export default PrivateRoute;
