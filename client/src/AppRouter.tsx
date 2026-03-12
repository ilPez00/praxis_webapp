import React, { Suspense, useEffect } from 'react';
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
import { useUser } from './hooks/useUser';

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
  const { user } = useUser();
  
  // Global background syncs (safe wrapped)
  useLocationSync();

  // ─── Conditional Mobile Debug Console (Eruda) ───
  useEffect(() => {
    const isPrivileged = user?.is_admin || ['admin', 'moderator', 'staff'].includes(user?.role || '');
    const eruda = (window as any).eruda;

    if (isPrivileged && eruda) {
      try {
        eruda.init();
        console.log('[Debug] Eruda initialized for privileged user.');
      } catch (e) {
        console.warn('[Debug] Eruda init failed', e);
      }
    } else if (!isPrivileged && eruda) {
      try {
        // Try to destroy if user is no longer privileged or logged out
        eruda.destroy();
      } catch (e) {}
    }
  }, [user]);

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
