import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';

const PrivateRoute: React.FC = () => {
    const { user, loading } = useUser();
    const location = useLocation();

    if (loading) {
        // You can return a loading spinner here if you want
        return <div>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (user.user_metadata && !user.user_metadata.onboarded && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" />;
    }

    return <Outlet />;
};

export default PrivateRoute;
