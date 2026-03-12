import React, { Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Navbar from './components/common/Navbar';
import InstallPwaBanner from './components/common/InstallPwaBanner';
import PrivateRoute from './features/auth/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import routes from './config/routes';
import { useLocationSync } from './hooks/useLocationSync';

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

const isElectron = /electron/i.test(navigator.userAgent);
const Router = isElectron ? HashRouter : BrowserRouter;

const basename = (!isElectron && window.location.hostname === 'ilpez00.github.io')
  ? '/praxis_webapp'
  : '';

const AppRouter: React.FC = () => {
  // Global background syncs (safe wrapped)
  useLocationSync();

  const isWidget = window.location.hash.includes('widget') || window.location.pathname.includes('widget');

  return (
    <Router basename={basename}>
      {!isWidget && <Navbar />}
      {!isWidget && !isElectron && <InstallPwaBanner />}
      <Toaster position="top-right" />
      
      {/* ErrorBoundary moved deep to catch route-level crashes only */}
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </Router>
  );
};

export default AppRouter;
