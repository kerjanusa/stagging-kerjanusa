import apiClient from '../utils/apiClient';
import { shouldUseMockData } from '../utils/mockMode';
import { clearCandidateApplyIntent } from '../utils/candidateApplyIntent.js';
import { normalizeUserRole } from '../utils/routeHelpers.js';

const MOCK_USERS_STORAGE_KEY = 'mock_auth_users';
const MOCK_PASSWORD_RESET_STORAGE_KEY = 'mock_password_reset_tokens';
const DEFAULT_DEMO_PASSWORD = 'password123';

const defaultMockUsers = [
  {
    id: 1,
    name: 'Recruiter Demo',
    account_status: 'active',
    email: 'recruiter@example.com',
    phone: '081234567890',
    role: 'recruiter',
    company_name: 'KerjaNusa Studio',
    recruiter_profile: null,
    password: DEFAULT_DEMO_PASSWORD,
  },
  {
    id: 2,
    name: 'Candidate Demo',
    account_status: 'active',
    email: 'candidate@example.com',
    phone: '089876543210',
    role: 'candidate',
    company_name: '',
    candidate_profile: null,
    password: DEFAULT_DEMO_PASSWORD,
  },
  {
    id: 3,
    name: 'Superadmin KerjaNusa',
    account_status: 'active',
    email: 'superadmin@kerjanusa.com',
    phone: '081122334455',
    role: 'superadmin',
    company_name: 'KerjaNusa Superadmin',
    password: DEFAULT_DEMO_PASSWORD,
  },
];

/**
 * Normalize one auth user payload so role values stay consistent across mock and API flows.
 */
const normalizeAuthUser = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }

  return {
    ...user,
    role: normalizeUserRole(user.role),
  };
};

/**
 * Remove the transient password field before user data is persisted to session storage.
 */
const stripPassword = ({ password, ...user }) => normalizeAuthUser(user);

/**
 * Restore the seeded demo password for built-in demo accounts when stored data drifts.
 */
const syncDemoUserPassword = (user) => {
  const normalizedUser = normalizeAuthUser(user);

  if (!normalizedUser || typeof normalizedUser !== 'object') {
    return normalizedUser;
  }

  const normalizedEmail = normalizedUser.email?.trim().toLowerCase();
  const isDemoUser =
    normalizedEmail === 'recruiter@example.com' ||
    normalizedEmail === 'candidate@example.com' ||
    normalizedEmail === 'superadmin@kerjanusa.com';

  if (!isDemoUser || normalizedUser.password === DEFAULT_DEMO_PASSWORD) {
    return normalizedUser;
  }

  return {
    ...normalizedUser,
    password: DEFAULT_DEMO_PASSWORD,
  };
};

/**
 * Load mock auth users from storage and upgrade them with any missing seeded accounts.
 */
const getMockUsers = () => {
  const storedUsers = localStorage.getItem(MOCK_USERS_STORAGE_KEY);

  if (storedUsers) {
    try {
      const parsedUsers = JSON.parse(storedUsers);
      if (Array.isArray(parsedUsers)) {
        const normalizedUsers = parsedUsers.map(syncDemoUserPassword);
        const existingEmails = new Set(
          normalizedUsers.map((user) => user?.email?.trim().toLowerCase()).filter(Boolean)
        );
        const missingDefaultUsers = defaultMockUsers.filter(
          (user) => !existingEmails.has(user.email.toLowerCase())
        );
        const mergedUsers = [...normalizedUsers, ...missingDefaultUsers];
        const shouldPersistUpgrade =
          mergedUsers.length !== parsedUsers.length ||
          normalizedUsers.some((user, index) => user !== parsedUsers[index]);

        if (shouldPersistUpgrade) {
          saveMockUsers(mergedUsers);
        }

        return mergedUsers;
      }
    } catch (error) {
      // Fall back to the seeded mock users.
    }
  }

  localStorage.setItem(MOCK_USERS_STORAGE_KEY, JSON.stringify(defaultMockUsers));
  return defaultMockUsers;
};

/**
 * Persist mock auth users back to storage after role normalization.
 */
const saveMockUsers = (users) => {
  localStorage.setItem(
    MOCK_USERS_STORAGE_KEY,
    JSON.stringify(users.map((user) => normalizeAuthUser(user)))
  );
};

/**
 * Load mock password-reset tokens from storage.
 */
const getMockPasswordResetTokens = () => {
  const storedTokens = localStorage.getItem(MOCK_PASSWORD_RESET_STORAGE_KEY);

  if (!storedTokens) {
    return [];
  }

  try {
    const parsedTokens = JSON.parse(storedTokens);
    return Array.isArray(parsedTokens) ? parsedTokens : [];
  } catch {
    return [];
  }
};

/**
 * Persist the mock password-reset token list to storage.
 */
const saveMockPasswordResetTokens = (tokens) => {
  localStorage.setItem(MOCK_PASSWORD_RESET_STORAGE_KEY, JSON.stringify(tokens));
};

/**
 * Generate a unique demo reset token that behaves like an emailed reset link.
 */
const buildMockResetToken = () =>
  `mock-reset-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Persist a mock login session and return the synthetic auth token.
 */
const persistMockSession = (user) => {
  const sessionToken = `mock-token-${user.id}`;
  const normalizedUser = stripPassword(user);
  localStorage.setItem('auth_token', sessionToken);
  localStorage.setItem('user', JSON.stringify(normalizedUser));

  return sessionToken;
};

/**
 * Persist the authenticated API session payload to browser storage.
 */
const persistApiSession = (user, token) => {
  const normalizedUser = normalizeAuthUser(user);

  if (token) {
    localStorage.setItem('auth_token', token);
  }

  if (normalizedUser) {
    localStorage.setItem('user', JSON.stringify(normalizedUser));
  }

  return normalizedUser;
};

/**
 * Detect browser file-like values so profile updates can switch to multipart payloads only when needed.
 */
const isFileLike = (value) =>
  (typeof File !== 'undefined' && value instanceof File) ||
  (typeof Blob !== 'undefined' && value instanceof Blob);

/**
 * Check recursively whether one payload contains binary values.
 */
const payloadContainsBinary = (value) => {
  if (isFileLike(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => payloadContainsBinary(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => payloadContainsBinary(item));
  }

  return false;
};

/**
 * Append one nested value into FormData using PHP-friendly bracket notation.
 */
const appendFormDataValue = (formData, key, value) => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    formData.append(key, '');
    return;
  }

  if (isFileLike(value)) {
    formData.append(key, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormDataValue(formData, `${key}[${index}]`, item);
    });
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      appendFormDataValue(formData, `${key}[${nestedKey}]`, nestedValue);
    });
    return;
  }

  formData.append(key, String(value));
};

/**
 * Build the final request payload for profile updates while preserving the old JSON flow when possible.
 */
const buildProfileUpdateRequestPayload = (data) => {
  if (!payloadContainsBinary(data)) {
    return data;
  }

  const formData = new FormData();
  formData.append('_method', 'PUT');

  Object.entries(data || {}).forEach(([key, value]) => {
    appendFormDataValue(formData, key, value);
  });

  return formData;
};

/**
 * Normalize mock profile updates so uploaded company documents become serializable metadata.
 */
const normalizeMockProfileUpdatePayload = (data) => {
  const recruiterProfile =
    data?.recruiter_profile && typeof data.recruiter_profile === 'object'
      ? { ...data.recruiter_profile }
      : data?.recruiter_profile;
  const normalizedPayload = {
    ...data,
    recruiter_profile: recruiterProfile,
  };
  const companyLegalDocument = data?.company_legal_document;

  if (isFileLike(companyLegalDocument)) {
    normalizedPayload.recruiter_profile = {
      ...(normalizedPayload.recruiter_profile || {}),
      companyLegalDocumentName:
        normalizedPayload.recruiter_profile?.companyLegalDocumentName ||
        companyLegalDocument.name ||
        'dokumen-perusahaan',
      companyLegalDocumentMimeType:
        normalizedPayload.recruiter_profile?.companyLegalDocumentMimeType ||
        companyLegalDocument.type ||
        '',
      companyLegalDocumentSize:
        Number(
          normalizedPayload.recruiter_profile?.companyLegalDocumentSize ||
            companyLegalDocument.size ||
            0
        ) || 0,
      companyLegalDocumentUploadedAt:
        normalizedPayload.recruiter_profile?.companyLegalDocumentUploadedAt ||
        new Date().toISOString(),
      companyLegalDocumentPath:
        normalizedPayload.recruiter_profile?.companyLegalDocumentPath ||
        `mock/company-legal-documents/${companyLegalDocument.name || 'dokumen-perusahaan'}`,
    };
  }

  delete normalizedPayload.company_legal_document;

  return normalizedPayload;
};

class AuthService {
  /**
   * Register new user
   */
  static async register(data) {
    if (shouldUseMockData) {
      if (data.password !== data.password_confirmation) {
        throw { message: 'Konfirmasi password tidak cocok.' };
      }

      const users = getMockUsers();
      const email = data.email?.trim().toLowerCase();
      const phone = data.phone?.trim();

      if (users.some((user) => user.email.toLowerCase() === email)) {
        throw { message: 'Email sudah terdaftar di mode demo.' };
      }

      if (!phone) {
        throw { message: 'Nomor telepon wajib diisi.' };
      }

      if (users.some((user) => (user.phone || '').trim() === phone)) {
        throw { message: 'Nomor telepon sudah digunakan. Gunakan nomor telepon lain.' };
      }

      const nextUser = {
        id: users.reduce((largestId, user) => Math.max(largestId, user.id), 0) + 1,
        name: data.name?.trim() || 'User Demo',
        email,
        phone,
        role: data.role || 'recruiter',
        company_name: data.company_name || '',
        account_status: 'active',
        candidate_profile: data.role === 'candidate' ? data.candidate_profile || null : null,
        recruiter_profile: data.role === 'recruiter' ? data.recruiter_profile || null : null,
        password: data.password,
      };

      const updatedUsers = [...users, nextUser];
      saveMockUsers(updatedUsers);

      return {
        user: stripPassword(nextUser),
        token: persistMockSession(nextUser),
      };
    }

    try {
      const response = await apiClient.post('/register', data);
      if (response.data.token) {
        const normalizedUser = persistApiSession(response.data.user, response.data.token);
        return {
          ...response.data,
          user: normalizedUser,
        };
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Login user
   */
  static async login(email, password) {
    if (shouldUseMockData) {
      const users = getMockUsers();
      const matchingUser = users.find(
        (user) => user.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (!matchingUser) {
        throw {
          message: 'Email tidak terdaftar.',
          errors: {
            email: ['Email tidak terdaftar.'],
          },
        };
      }

      if (matchingUser.password !== password) {
        throw {
          message: 'Password salah. Periksa kembali password Anda.',
          errors: {
            password: ['Password salah. Periksa kembali password Anda.'],
          },
        };
      }

      if (matchingUser.account_status === 'suspended') {
        throw {
          message:
            'Akun Anda sedang dinonaktifkan. Hubungi superadmin KerjaNusa untuk bantuan lebih lanjut.',
        };
      }

      return {
        user: stripPassword(matchingUser),
        token: persistMockSession(matchingUser),
      };
    }

    try {
      const response = await apiClient.post('/login', { email, password });
      if (response.data.token) {
        const normalizedUser = persistApiSession(response.data.user, response.data.token);
        return {
          ...response.data,
          user: normalizedUser,
        };
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Logout user
   */
  static async logout() {
    if (shouldUseMockData) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      clearCandidateApplyIntent();
      return;
    }

    try {
      await apiClient.post('/logout');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      clearCandidateApplyIntent();
    } catch (error) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      clearCandidateApplyIntent();
      throw error.response?.data || error.message;
    }
  }

  /**
   * Send forgot password link
   */
  static async forgotPassword(email) {
    if (shouldUseMockData) {
      const normalizedEmail = email?.trim().toLowerCase();
      const users = getMockUsers();
      const matchingUser = users.find((user) => user.email.toLowerCase() === normalizedEmail);

      if (matchingUser) {
        const nextToken = {
          email: normalizedEmail,
          token: buildMockResetToken(),
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
        const existingTokens = getMockPasswordResetTokens().filter(
          (entry) => entry.email !== normalizedEmail
        );

        saveMockPasswordResetTokens([...existingTokens, nextToken]);
      }

      return {
        message: 'Jika email terdaftar, link reset password telah dikirim ke email Anda.',
      };
    }

    try {
      const response = await apiClient.post('/forgot-password', { email });
      return response.data;
    } catch (error) {
      const responseData = error.response?.data;

      if (typeof responseData === 'string' && /<html|<!doctype/i.test(responseData)) {
        throw {
          message:
            'Layanan reset password sedang bermasalah. Coba lagi beberapa saat atau hubungi admin.',
        };
      }

      throw responseData || error.message;
    }
  }

  /**
   * Reset password using email link token
   */
  static async resetPassword(data) {
    if (shouldUseMockData) {
      const normalizedEmail = data.email?.trim().toLowerCase();
      const tokens = getMockPasswordResetTokens();
      const matchingToken = tokens.find(
        (entry) =>
          entry.email === normalizedEmail &&
          entry.token === data.token &&
          Number(entry.expiresAt) > Date.now()
      );

      if (!matchingToken) {
        throw {
          message: 'Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru.',
          errors: {
            token: ['Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru.'],
          },
        };
      }

      if (data.password !== data.password_confirmation) {
        throw {
          message: 'Konfirmasi password harus sama dengan password baru.',
          errors: {
            password_confirmation: ['Konfirmasi password harus sama dengan password baru.'],
          },
        };
      }

      const users = getMockUsers();
      const userIndex = users.findIndex((user) => user.email.toLowerCase() === normalizedEmail);

      if (userIndex === -1) {
        throw {
          message: 'Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru.',
          errors: {
            token: ['Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru.'],
          },
        };
      }

      users[userIndex] = {
        ...users[userIndex],
        password: data.password,
      };
      saveMockUsers(users);
      saveMockPasswordResetTokens(
        tokens.filter((entry) => !(entry.email === normalizedEmail && entry.token === data.token))
      );

      const storedUser = this.getStoredUser();
      if (storedUser?.email?.trim().toLowerCase() === normalizedEmail) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }

      return {
        message: 'Password berhasil diubah. Silakan login dengan password baru Anda.',
      };
    }

    try {
      const response = await apiClient.post('/reset-password', data);
      const storedUser = this.getStoredUser();
      if (storedUser?.email?.trim().toLowerCase() === data.email?.trim().toLowerCase()) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser() {
    if (shouldUseMockData) {
      const user = this.getStoredUser();

      if (!user) {
        throw { message: 'Anda belum login.' };
      }

      return user;
    }

    try {
      const response = await apiClient.get('/me');
      return persistApiSession(response.data.user);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Update profile
   */
  static async updateProfile(data) {
    if (shouldUseMockData) {
      const currentUser = this.getStoredUser();

      if (!currentUser) {
        throw { message: 'Anda belum login.' };
      }

      const normalizedPayload = normalizeMockProfileUpdatePayload(data);
      const updatedUser = normalizeAuthUser({ ...currentUser, ...normalizedPayload });
      const users = getMockUsers().map((user) =>
        user.id === currentUser.id ? normalizeAuthUser({ ...user, ...normalizedPayload }) : user
      );

      saveMockUsers(users);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      return { user: updatedUser };
    }

    try {
      const requestPayload = buildProfileUpdateRequestPayload(data);
      const response =
        requestPayload instanceof FormData
          ? await apiClient.post('/profile', requestPayload, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            })
          : await apiClient.put('/profile', requestPayload);
      const normalizedUser = persistApiSession(response.data.user);
      return {
        ...response.data,
        user: normalizedUser,
      };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Change password
   */
  static async changePassword(oldPassword, newPassword, newPasswordConfirmation) {
    if (shouldUseMockData) {
      const currentUser = this.getStoredUser();

      if (!currentUser) {
        throw { message: 'Anda belum login.' };
      }

      if (newPassword !== newPasswordConfirmation) {
        throw { message: 'Konfirmasi password baru tidak cocok.' };
      }

      const users = getMockUsers();
      const matchingUser = users.find((user) => user.id === currentUser.id);

      if (!matchingUser || matchingUser.password !== oldPassword) {
        throw { message: 'Password lama tidak cocok.' };
      }

      matchingUser.password = newPassword;
      saveMockUsers([...users]);

      return { message: 'Password demo berhasil diperbarui.' };
    }

    try {
      const response = await apiClient.put('/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get token from storage
   */
  static getToken() {
    return localStorage.getItem('auth_token');
  }

  /**
   * Get stored user
   */
  static getStoredUser() {
    const user = localStorage.getItem('user');

    if (!user) {
      return null;
    }

    try {
      const parsedUser = JSON.parse(user);
      const normalizedUser = normalizeAuthUser(parsedUser);

      if (normalizedUser?.role !== parsedUser?.role) {
        localStorage.setItem('user', JSON.stringify(normalizedUser));
      }

      return normalizedUser;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated() {
    return !!this.getToken();
  }
}

export default AuthService;
