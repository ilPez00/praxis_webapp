import React, { Suspense, useEffect } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import PageSkeleton from './components/common/PageSkeleton';
import Navbar from './components/common/Navbar';
import InstallPwaBanner from './components/common/InstallPwaBanner';
import PrivateRoute from './features/auth/PrivateRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import QuickActionFAB from './components/common/QuickActionFAB';
import { Toaster } from 'react-hot-toast';
import { publicRoutes, privateRoutes } from './config/routes';
import { useLocationSync } from './hooks/useLocationSync';
import { useUser } from './hooks/useUser';
import { useOfflineSync } from './hooks/useOfflineSync';
import { CelebrationProvider } from './hooks/useCelebrations';

const PageLoader = () => <PageSkeleton cards={3} />;

const isElectron = /electron/i.test(navigator.userAgent);
const isWidget = window.location.hash.includes('widget') || window.location.pathname.includes('widget');

const basename = (!isElectron && window.location.hostname === 'ilpez00.github.io')
  ? '/praxis_webapp'
  : '';

/** Root layout rendered for every route — provides navbar, toaster, FAB, and global hooks */
const RootLayout: React.FC = () => {
  const { user } = useUser();

  useLocationSync();
  useOfflineSync();

  // Conditional mobile debug console (Eruda)
  useEffect(() => {
    const isPrivileged = user?.is_admin || ['admin', 'moderator', 'staff'].includes(user?.role || '');
    const eruda = (window as any).eruda;
    if (isPrivileged && eruda) {
      try { eruda.init(); } catch {}
    } else if (!isPrivileged && eruda) {
      try { eruda.destroy(); } catch {}
    }
  }, [user]);

  return (
    <CelebrationProvider>
      {!isWidget && <Navbar />}
      {!isWidget && !isElectron && <InstallPwaBanner />}
      {!isWidget && <QuickActionFAB />}
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </CelebrationProvider>
  );
};

// Wrap each route's element with ErrorBoundary for graceful per-page error recovery
const wrapElement = (el: React.ReactNode) => (
  <ErrorBoundary><>{el}</></ErrorBoundary>
);

const createRouter = isElectron ? createHashRouter : createBrowserRouter;

const router = createRouter(
  [
    {
      element: <RootLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        // Public routes
        ...publicRoutes.map(r => ({
          ...r,
          element: wrapElement(r.element),
          errorElement: <RouteErrorBoundary />,
        })),
        // Private routes (wrapped in PrivateRoute auth guard)
        {
          element: <PrivateRoute />,
          children: privateRoutes.map(r => ({
            ...r,
            element: wrapElement(r.element),
            errorElement: <RouteErrorBoundary />,
          })),
        },
      ],
    },
  ],
  { basename: basename || undefined }
);

const AppRouter: React.FC = () => <RouterProvider router={router} />;

export default AppRouter;
