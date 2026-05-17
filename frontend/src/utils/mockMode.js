const PRODUCTION_API_FALLBACK = 'https://kerjanusa-backend.vercel.app/api';

/**
 * Resolve the backend API base URL from env configuration or the production fallback.
 */
export const resolvedApiUrl =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PRODUCTION_API_FALLBACK : '');

/**
 * Decide whether the frontend should run in mock-data mode for the current environment.
 */
export const shouldUseMockData = import.meta.env.PROD
  ? !resolvedApiUrl
  : import.meta.env.VITE_USE_MOCK_DATA === 'true' || !resolvedApiUrl;
