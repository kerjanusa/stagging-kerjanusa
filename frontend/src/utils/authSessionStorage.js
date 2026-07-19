const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
const AUTH_USER_STORAGE_KEY = 'user';

/**
 * Prefer sessionStorage so auth tidak bertahan ketika browser ditutup.
 */
const getPreferredAuthStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.sessionStorage;
    storage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return storage;
  } catch {
    try {
      const fallbackStorage = window.localStorage;
      fallbackStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      return fallbackStorage;
    } catch {
      return null;
    }
  }
};

/**
 * Local storage lama dibersihkan agar sesi auth tidak lagi persisten lintas browser close.
 */
const getLegacyAuthStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const clearLegacyAuthStorage = (activeStorage) => {
  const legacyStorage = getLegacyAuthStorage();

  if (!legacyStorage || legacyStorage === activeStorage) {
    return;
  }

  legacyStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  legacyStorage.removeItem(AUTH_USER_STORAGE_KEY);
};

/**
 * Ambil token auth dari storage aktif.
 */
export const readStoredAuthToken = () => {
  const storage = getPreferredAuthStorage();

  if (!storage) {
    return '';
  }

  return storage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
};

/**
 * Ambil user auth dari storage aktif.
 */
export const readStoredAuthUser = () => {
  const storage = getPreferredAuthStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(AUTH_USER_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

/**
 * Simpan token auth ke storage aktif lalu hapus auth lama yang persisten.
 */
export const writeStoredAuthToken = (token) => {
  const storage = getPreferredAuthStorage();

  if (!storage) {
    return;
  }

  if (token) {
    storage.setItem(AUTH_TOKEN_STORAGE_KEY, String(token));
  } else {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  clearLegacyAuthStorage(storage);
};

/**
 * Simpan user auth ke storage aktif lalu hapus auth lama yang persisten.
 */
export const writeStoredAuthUser = (user) => {
  const storage = getPreferredAuthStorage();

  if (!storage) {
    return;
  }

  if (user) {
    storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    storage.removeItem(AUTH_USER_STORAGE_KEY);
  }

  clearLegacyAuthStorage(storage);
};

/**
 * Bersihkan auth di storage aktif maupun storage lama.
 */
export const clearStoredAuthSession = () => {
  const storage = getPreferredAuthStorage();

  if (storage) {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    storage.removeItem(AUTH_USER_STORAGE_KEY);
  }

  const legacyStorage = getLegacyAuthStorage();

  if (legacyStorage && legacyStorage !== storage) {
    legacyStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    legacyStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
};
