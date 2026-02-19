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
// Routes that a new user is allowed to visit before completing onboarding
const ONBOARDING_ALLOWED_PATHS = ['/onboarding', '/goal-selection'];

const PrivateRoute: React.FC = () => {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Onboarding guard: redirect new users to onboarding until they complete setup.
  // Exempt /onboarding and /goal-selection so the flow itself isn't blocked.
  if (
    user.onboarding_completed === false &&
    !ONBOARDING_ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
