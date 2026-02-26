import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import PrivateRoute from './features/auth/PrivateRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import routes from './config/routes';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Navbar />
      <Toaster position="top-right" />
      <ErrorBoundary>
        <Routes>
          {routes.map((route, index) => (
            route.private ? (
              <Route key={index} element={<PrivateRoute />}>
                <Route path={route.path} element={<route.element />} />
              </Route>
            ) : (
              <Route key={index} path={route.path} element={<route.element />} />
            )
          ))}
        </Routes>
      </ErrorBoundary>
    </Router>
  );
};

export default AppRouter;
