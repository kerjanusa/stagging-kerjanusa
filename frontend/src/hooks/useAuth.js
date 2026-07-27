import { create } from 'zustand';
import AuthService from '../services/authService';

/**
 * Extract the most useful human-readable error string from a service failure.
 */
const getErrorMessage = (error, fallback) =>
  typeof error === 'string' ? error : error?.message || fallback;

/**
 * Extract backend validation errors into a consistent object shape for forms.
 */
const getValidationErrors = (error) =>
  typeof error === 'object' && error?.errors ? error.errors : {};

/**
 * Centralized auth store for session, validation, and async auth actions.
 */
const useAuthStore = create((set) => ({
  user: AuthService.getStoredUser(),
  token: AuthService.getToken(),
  isLoading: false,
  error: null,
  validationErrors: {},

  // Login action
  login: async (email, password, options = {}) => {
    set({ isLoading: true, error: null, validationErrors: {} });
    try {
      const data = await AuthService.login(email, password, options);
      set({
        user: data.user,
        token: data.token,
        isLoading: false,
        error: null,
        validationErrors: {},
      });
      return data;
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Login failed'),
        validationErrors: getValidationErrors(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // OAuth callback action
  completeOAuthLogin: async (token) => {
    set({ isLoading: true, error: null, validationErrors: {} });
    try {
      const data = await AuthService.completeOAuthLogin(token);
      set({
        user: data.user,
        token: data.token,
        isLoading: false,
        error: null,
        validationErrors: {},
      });
      return data;
    } catch (error) {
      set({
        user: null,
        token: null,
        error: getErrorMessage(error, 'Login Google/Facebook gagal'),
        validationErrors: getValidationErrors(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Register action
  register: async (formData) => {
    set({ isLoading: true, error: null, validationErrors: {} });
    try {
      const data = await AuthService.register(formData);
      set({
        user: data.user,
        token: data.token,
        isLoading: false,
        error: null,
        validationErrors: {},
      });
      return data;
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Registration failed'),
        validationErrors: getValidationErrors(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Logout action
  logout: async () => {
    set({ isLoading: true, error: null, validationErrors: {} });
    try {
      await AuthService.logout();
      set({
        user: null,
        token: null,
        isLoading: false,
        error: null,
        validationErrors: {},
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Logout failed'),
        validationErrors: getValidationErrors(error),
        isLoading: false,
      });
    }
  },

  // Update profile action
  updateProfile: async (data) => {
    set({ isLoading: true, error: null, validationErrors: {} });
    try {
      const response = await AuthService.updateProfile(data);
      set({
        user: response.user,
        isLoading: false,
        error: null,
        validationErrors: {},
      });
      return response;
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Update failed'),
        validationErrors: getValidationErrors(error),
        isLoading: false,
      });
      throw error;
    }
  },

  // Candidate resume autofill action
  autofillCandidateProfileFromResume: async (file) => {
    try {
      return await AuthService.autofillCandidateProfileFromResume(file);
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Autofill CV gagal'),
        validationErrors: getValidationErrors(error),
      });
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    set({ isLoading: true, validationErrors: {} });
    try {
      const user = await AuthService.getCurrentUser();
      set({
        user,
        isLoading: false,
        error: null,
        validationErrors: {},
      });
      return user;
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Failed to fetch user'),
        validationErrors: getValidationErrors(error),
        isLoading: false,
      });
    }
  },

  // Clear error
  clearError: () => set({ error: null, validationErrors: {} }),

  // Check if authenticated
  isAuthenticated: () => !!AuthService.getToken(),
}));

export default useAuthStore;
