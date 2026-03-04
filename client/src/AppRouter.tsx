import React, { Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import Navbar from './components/common/Navbar';
import PrivateRoute from './features/auth/PrivateRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import routes from './config/routes';

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

// For Electron apps loading from file://, HashRouter is necessary.
// We detect Electron via the user agent or a global flag.
const isElectron = /electron/i.test(navigator.userAgent);
const Router = isElectron ? HashRouter : BrowserRouter;

// On GitHub Pages the app is served at /praxis_webapp, so React Router needs
// that as a basename. On Vercel / local dev it runs at the root.
const basename = (!isElectron && window.location.hostname === 'ilpez00.github.io')
  ? '/praxis_webapp'
  : '';

const AppRouter: React.FC = () => {
  return (
    <Router basename={basename}>
      <Navbar />
      <Toaster position="top-right" />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
};

export default AppRouter;
