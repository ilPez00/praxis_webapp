import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import PageSkeleton from './components/common/PageSkeleton';
import Navbar from './components/common/Navbar';
import InstallPwaBanner from './components/common/InstallPwaBanner';
import PrivateRoute from './features/auth/PrivateRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import QuickActionFAB from './components/common/QuickActionFAB';
import { Toaster } from 'react-hot-toast';
import routes from './config/routes';
import { useLocationSync } from './hooks/useLocationSync';
import { useUser } from './hooks/useUser';
import { useOfflineSync } from './hooks/useOfflineSync';
import { CelebrationProvider } from './hooks/useCelebrations';

const PageLoader = () => <PageSkeleton cards={3} />;

const isElectron = /electron/i.test(navigator.userAgent);
const Router = isElectron ? HashRouter : BrowserRouter;

const basename = (!isElectron && window.location.hostname === 'ilpez00.github.io')
  ? '/praxis_webapp'
  : '';

const AppRouter: React.FC = () => {
  const { user } = useUser();
  
  // Global background syncs (safe wrapped)
  useLocationSync();
  useOfflineSync();

  // ─── Conditional Mobile Debug Console (Eruda) ───
  useEffect(() => {
    const isPrivileged = user?.is_admin || ['admin', 'moderator', 'staff'].includes(user?.role || '');
    const eruda = (window as any).eruda;

    if (isPrivileged && eruda) {
      try {
        eruda.init();
        console.debug('[Debug] Eruda initialized for privileged user.');
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
      {!isWidget && <QuickActionFAB />}
      <Toaster position="top-right" />
      
      <Suspense fallback={<PageLoader />}>
        <CelebrationProvider>
          <Routes>
            {routes.map((route, index) => {
              const page = (
                <ErrorBoundary>
                  <route.element />
                </ErrorBoundary>
              );
              return route.private ? (
                <Route key={index} element={<PrivateRoute />}>
                  <Route path={route.path} element={page} />
                </Route>
              ) : (
                <Route key={index} path={route.path} element={page} />
              );
            })}
          </Routes>
        </CelebrationProvider>
      </Suspense>
    </Router>
  );
};

export default AppRouter;
