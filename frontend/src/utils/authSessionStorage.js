const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
const AUTH_USER_STORAGE_KEY = 'user';

/**
 * Ambil storage browser dengan fallback aman untuk mode private/SSR.
 */
const getAuthStorage = (storageName) => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window[storageName];
    storage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
};

/**
 * Login default menyimpan sesi persisten karena user memilih "Ingat perangkat ini".
 */
const getPersistentAuthStorage = () => getAuthStorage('localStorage');

/**
 * Session pendek dipakai saat user mematikan pilihan "Ingat perangkat ini".
 */
const getShortLivedAuthStorage = () => getAuthStorage('sessionStorage');

const getKnownAuthStorages = () => [
  getPersistentAuthStorage(),
  getShortLivedAuthStorage(),
].filter(Boolean);

const storageHasAuthToken = (storage) => Boolean(storage?.getItem(AUTH_TOKEN_STORAGE_KEY));

const storageHasAuthUser = (storage) => Boolean(storage?.getItem(AUTH_USER_STORAGE_KEY));

/**
 * Pakai storage yang sudah memegang sesi aktif. Jika belum ada, fallback ke localStorage.
 */
const getActiveAuthStorage = () => {
  const persistentStorage = getPersistentAuthStorage();
  const shortLivedStorage = getShortLivedAuthStorage();

  if (storageHasAuthToken(persistentStorage)) {
    return persistentStorage;
  }

  if (storageHasAuthToken(shortLivedStorage)) {
    return shortLivedStorage;
  }

  if (storageHasAuthUser(persistentStorage)) {
    return persistentStorage;
  }

  if (storageHasAuthUser(shortLivedStorage)) {
    return shortLivedStorage;
  }

  return persistentStorage || shortLivedStorage;
};

const getWritableAuthStorage = (options = {}) => {
  if (typeof options.persistent === 'boolean') {
    const preferredStorage = options.persistent
      ? getPersistentAuthStorage()
      : getShortLivedAuthStorage();
    const fallbackStorage = options.persistent
      ? getShortLivedAuthStorage()
      : getPersistentAuthStorage();

    return preferredStorage || fallbackStorage;
  }

  return getActiveAuthStorage();
};

const clearInactiveAuthStorages = (activeStorage) => {
  getKnownAuthStorages().forEach((storage) => {
    if (storage === activeStorage) {
      return;
    }

    storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    storage.removeItem(AUTH_USER_STORAGE_KEY);
  });
};

/**
 * Ambil token auth dari storage aktif.
 */
export const readStoredAuthToken = () => {
  const storage = getActiveAuthStorage();

  if (!storage) {
    return '';
  }

  return storage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
};

/**
 * Ambil user auth dari storage aktif.
 */
export const readStoredAuthUser = () => {
  const storage = getActiveAuthStorage();

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
 * Simpan token auth ke storage aktif lalu hapus salinan auth di storage lain.
 */
export const writeStoredAuthToken = (token, options = {}) => {
  const storage = getWritableAuthStorage(options);

  if (!storage) {
    return;
  }

  if (token) {
    storage.setItem(AUTH_TOKEN_STORAGE_KEY, String(token));
  } else {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  clearInactiveAuthStorages(storage);
};

/**
 * Simpan user auth ke storage aktif lalu hapus salinan auth di storage lain.
 */
export const writeStoredAuthUser = (user, options = {}) => {
  const storage = getWritableAuthStorage(options);

  if (!storage) {
    return;
  }

  if (user) {
    storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    storage.removeItem(AUTH_USER_STORAGE_KEY);
  }

  clearInactiveAuthStorages(storage);
};

/**
 * Bersihkan auth di storage persisten maupun sesi pendek.
 */
export const clearStoredAuthSession = () => {
  getKnownAuthStorages().forEach((storage) => {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    storage.removeItem(AUTH_USER_STORAGE_KEY);
  });
};
