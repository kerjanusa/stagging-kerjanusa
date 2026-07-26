import axios from 'axios';
import {
  clearStoredAuthSession,
  readStoredAuthToken,
  readStoredAuthUser,
} from './authSessionStorage.js';
import { getLoginRouteForRole } from './routeHelpers.js';
import { resolvedApiUrl } from './mockMode.js';

export const API_BASE_URL = resolvedApiUrl || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Detect auth endpoints that must never receive an existing bearer token automatically.
 */
const isPublicAuthRequest = (url = '') => {
  if (typeof url !== 'string') {
    return false;
  }

  return (
    url.endsWith('/login') ||
    url.endsWith('/register') ||
    url.endsWith('/forgot-password') ||
    url.endsWith('/reset-password')
  );
};

/**
 * Clear the current browser session and redirect the user to the role-appropriate login page.
 */
const clearSessionAndRedirectToLogin = () => {
  let userRole = null;

  try {
    userRole = readStoredAuthUser()?.role || null;
  } catch {
    userRole = null;
  }

  clearStoredAuthSession();
  window.location.replace(getLoginRouteForRole(userRole));
};

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = readStoredAuthToken();

  if (token && !isPublicAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const shouldRedirectToLogin =
      error.response?.status === 401 &&
      !isPublicAuthRequest(error.config?.url) &&
      Boolean(error.config?.headers?.Authorization || readStoredAuthToken());

    if (shouldRedirectToLogin) {
      clearSessionAndRedirectToLogin();
    }

    if (error.response?.status === 403 && error.response?.data?.reason === 'account_suspended') {
      clearSessionAndRedirectToLogin();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
