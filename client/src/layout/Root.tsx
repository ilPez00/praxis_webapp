import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import HomePage from '../features/home/HomePage';

const Root: React.FC = () => {
    const { user, loading } = useUser();

    if (loading) {
        return <div>Loading...</div>;
    }

    return user ? <Navigate to="/dashboard" /> : <HomePage />;
};

export default Root;
