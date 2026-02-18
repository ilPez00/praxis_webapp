import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../hooks/useUser';

const PrivateRoute: React.FC = () => {
    const { user, loading } = useUser();

    if (loading) {
        // You can return a loading spinner here if you want
        return <div>Loading...</div>;
    }

    return user ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;
