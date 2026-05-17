export const APP_ROUTES = {
  home: '/',
  landing: '/dashboard-awal',
  about: '/about',
  platform: '/platform',
  jobs: '/jobs',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  register: '/register',
  recruiterDashboard: '/recruiter',
  recruiterCreateJob: '/recruiter/jobs/create',
  candidateDashboard: '/candidate',
  adminDashboard: '/admin',
};

/**
 * Normalize legacy role aliases so route decisions use one canonical role set.
 */
export const normalizeUserRole = (role) => (role === 'internal' ? 'superadmin' : role);

const ROLE_HOME_ROUTES = {
  recruiter: APP_ROUTES.recruiterDashboard,
  candidate: APP_ROUTES.candidateDashboard,
  superadmin: APP_ROUTES.adminDashboard,
  internal: APP_ROUTES.adminDashboard,
};

const ROLE_LOGIN_ROUTES = {
  recruiter: `${APP_ROUTES.login}?role=recruiter`,
  candidate: `${APP_ROUTES.login}?role=candidate`,
  superadmin: `${APP_ROUTES.login}?role=superadmin`,
  internal: `${APP_ROUTES.login}?role=superadmin`,
};

/**
 * Return the default landing route for one authenticated role.
 */
export const getDefaultRouteForRole = (role) =>
  ROLE_HOME_ROUTES[normalizeUserRole(role)] || APP_ROUTES.home;

/**
 * Return the login route variant that best matches one expected role.
 */
export const getLoginRouteForRole = (role) =>
  ROLE_LOGIN_ROUTES[normalizeUserRole(role)] || APP_ROUTES.login;
