import { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { GuestRoute, ProtectedRoute } from './components/RouteGuards.jsx';
import WhatsAppFloatingButton from './components/WhatsAppFloatingButton.jsx';
import useScrollReveal from './hooks/useScrollReveal.js';
import { APP_ROUTES } from './utils/routeHelpers.js';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const PlatformPage = lazy(() => import('./pages/PlatformPage.jsx'));
const JobListPage = lazy(() => import('./pages/JobListPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const RecruiterDashboardPage = lazy(() => import('./pages/RecruiterDashboardPage.jsx'));
const RecruiterJobCreatePage = lazy(() => import('./pages/RecruiterJobCreatePage.jsx'));
const CandidateDashboardPage = lazy(() => import('./pages/CandidateDashboardPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.jsx'));

const FORCE_SCROLL_TOP_PATHS = new Set([
  APP_ROUTES.landing,
  APP_ROUTES.about,
  APP_ROUTES.platform,
  APP_ROUTES.candidateDashboard,
  APP_ROUTES.adminDashboard,
]);

/**
 * Menormalkan posisi scroll ke bagian atas agar perpindahan halaman konsisten di semua browser.
 */
const scrollWindowToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

/**
 * Menampilkan fallback ringan saat chunk route lazy masih dimuat.
 */
const AppRouteFallback = () => (
  <main className="app-container">
    <div className="loading">Memuat halaman...</div>
  </main>
);

/**
 * Mengatur shell routing, perilaku scroll, dan visibilitas navbar per halaman.
 */
function AppLayout() {
  const location = useLocation();
  const shouldForceScrollTop = FORCE_SCROLL_TOP_PATHS.has(location.pathname);
  useScrollReveal(location.pathname);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (location.hash) {
      const targetElement = document.getElementById(location.hash.slice(1));

      if (targetElement) {
        const frameId = window.requestAnimationFrame(() => {
          targetElement.scrollIntoView({ block: 'start' });
        });

        return () => {
          window.cancelAnimationFrame(frameId);
        };
      }
    }

    scrollWindowToTop();
    return undefined;
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (typeof window === 'undefined' || location.hash || !shouldForceScrollTop) {
      return undefined;
    }

    const supportsManualScrollRestoration =
      typeof window.history !== 'undefined' && 'scrollRestoration' in window.history;
    const previousScrollRestoration = supportsManualScrollRestoration
      ? window.history.scrollRestoration
      : null;

    if (supportsManualScrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }

    const restoreScrollTop = () => {
      scrollWindowToTop();
      window.requestAnimationFrame(scrollWindowToTop);
    };

    const timeoutId = window.setTimeout(restoreScrollTop, 120);
    const handlePageShow = () => {
      restoreScrollTop();
    };
    const handleBeforeUnload = () => {
      scrollWindowToTop();
    };

    restoreScrollTop();
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (supportsManualScrollRestoration && previousScrollRestoration !== null) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, [location.hash, location.pathname, shouldForceScrollTop]);

  const hideNavbar =
    location.pathname === APP_ROUTES.register ||
    location.pathname.startsWith(APP_ROUTES.recruiterDashboard) ||
    location.pathname === APP_ROUTES.candidateDashboard ||
    location.pathname === APP_ROUTES.adminDashboard;
  const loginShellClassName =
    location.pathname === APP_ROUTES.login ||
    location.pathname === APP_ROUTES.forgotPassword ||
    location.pathname === APP_ROUTES.resetPassword
      ? 'auth-shell auth-shell-with-navbar'
      : 'auth-shell';

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Suspense fallback={<AppRouteFallback />}>
        <Routes>
          <Route
            path={APP_ROUTES.home}
            element={
              <GuestRoute>
                <Navigate to="/login?role=recruiter" replace />
              </GuestRoute>
            }
          />
          <Route path={APP_ROUTES.landing} element={<HomePage />} />
          <Route path={APP_ROUTES.about} element={<AboutPage />} />
          <Route path={APP_ROUTES.platform} element={<PlatformPage />} />
          <Route
            path={APP_ROUTES.jobs}
            element={
              <main className="app-container app-container-jobs">
                <JobListPage />
              </main>
            }
          />
          <Route
            path={APP_ROUTES.login}
            element={
              <GuestRoute>
                <main className={loginShellClassName}>
                  <LoginPage />
                </main>
              </GuestRoute>
            }
          />
          <Route
            path={APP_ROUTES.forgotPassword}
            element={
              <GuestRoute>
                <main className={loginShellClassName}>
                  <ForgotPasswordPage />
                </main>
              </GuestRoute>
            }
          />
          <Route
            path={APP_ROUTES.resetPassword}
            element={
              <main className={loginShellClassName}>
                <ResetPasswordPage />
              </main>
            }
          />
          <Route
            path={APP_ROUTES.register}
            element={
              <GuestRoute>
                <main className="auth-shell">
                  <RegisterPage />
                </main>
              </GuestRoute>
            }
          />
          <Route
            path={APP_ROUTES.candidateDashboard}
            element={
              <ProtectedRoute allowedRoles={['candidate']} loginRole="candidate">
                <CandidateDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={APP_ROUTES.adminDashboard}
            element={
              <ProtectedRoute allowedRoles={['superadmin']} loginRole="superadmin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={APP_ROUTES.recruiterCreateJob}
            element={
              <ProtectedRoute allowedRoles={['recruiter']} loginRole="recruiter">
                <RecruiterJobCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={APP_ROUTES.recruiterDashboard}
            element={
              <ProtectedRoute allowedRoles={['recruiter']} loginRole="recruiter">
                <RecruiterDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to={APP_ROUTES.home} replace />} />
        </Routes>
      </Suspense>
      <WhatsAppFloatingButton />
    </>
  );
}

/**
 * Menjadi root router untuk seluruh aplikasi React.
 */
function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
