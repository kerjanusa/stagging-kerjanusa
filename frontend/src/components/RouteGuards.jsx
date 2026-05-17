import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { readCandidateApplyIntent } from '../utils/candidateApplyIntent.js';
import {
  APP_ROUTES,
  getDefaultRouteForRole,
  getLoginRouteForRole,
  normalizeUserRole,
} from '../utils/routeHelpers.js';

/**
 * Mengarahkan user yang sudah login ke halaman yang paling relevan dan mencegah akses ke guest page.
 */
const GuestRoute = ({ children }) => {
  const { user } = useAuth();
  const pendingApplyIntent = readCandidateApplyIntent();

  if (user) {
    if (pendingApplyIntent && normalizeUserRole(user.role) === 'candidate') {
      return <Navigate to={APP_ROUTES.jobs} replace />;
    }

    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
};

/**
 * Memastikan route hanya bisa dibuka user yang sudah login dan memiliki role yang diizinkan.
 */
const ProtectedRoute = ({ children, allowedRoles = [], loginRole }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={getLoginRouteForRole(loginRole)} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
};

export { GuestRoute, ProtectedRoute };
