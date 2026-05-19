import React, { Suspense, useEffect } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom';
import PageSkeleton from './components/common/PageSkeleton';
import InstallPwaBanner from './components/common/InstallPwaBanner';
import PrivateRoute from './features/auth/PrivateRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { publicRoutes, privateRoutes } from './config/routes';
import { useLocationSync } from './hooks/useLocationSync';
import { useUser } from './hooks/useUser';
import { useOfflineSync } from './hooks/useOfflineSync';
import { CelebrationProvider } from './hooks/useCelebrations';
import BottomNav from './layout/BottomNav';
import TopBar from './layout/TopBar';

// Routes that get the old top navbar (admin, special pages)
const LEGACY_NAV_PATHS = ['/admin', '/lattice', '/go-live', '/stream', '/desktop-widget', '/mobile-widget'];

const PageLoader = () => <PageSkeleton cards={3} />;

const isElectron = /electron/i.test(navigator.userAgent);
const isWidget = window.location.hash.includes('widget') || window.location.pathname.includes('widget');

const basename = (!isElectron && window.location.hostname === 'ilpez00.github.io')
  ? '/praxis_webapp'
  : '';

/** Root layout — new bottom-tab shell replacing MUI Navbar */
const RootLayout: React.FC = () => {
  const { user } = useUser();
  const { pathname } = useLocation();

  useLocationSync();
  useOfflineSync();

  useEffect(() => {
    const isPrivileged = user?.is_admin || ['admin', 'moderator', 'staff'].includes(user?.role || '');
    const eruda = (window as any).eruda;
    if (isPrivileged && eruda) {
      try { eruda.init(); } catch {}
    } else if (!isPrivileged && eruda) {
      try { eruda.destroy(); } catch {}
    }
  }, [user]);

  const isLegacy = LEGACY_NAV_PATHS.some(p => pathname.startsWith(p));
  const hideShell = isWidget || isLegacy;

  return (
    <CelebrationProvider>
      <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
        {!hideShell && <TopBar />}
        {!hideShell && !isElectron && <InstallPwaBanner />}
        <Toaster position="top-center" toastOptions={{
          style: { background: '#1a1a1a', color: '#eee', border: '1px solid #333', fontFamily: 'monospace', fontSize: '12px' },
        }} />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
        {!hideShell && <BottomNav />}
      </div>
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
