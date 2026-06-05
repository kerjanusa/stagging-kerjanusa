const CANDIDATE_APPLY_INTENT_STORAGE_KEY = 'candidate_apply_intent';
const CANDIDATE_APPLY_INTENT_TTL_MS = 30 * 60 * 1000;
const ALLOWED_FILTER_KEYS = [
  'search',
  'company_name',
  'job_type',
  'experience_level',
  'location',
  'salary_minimum',
  'saved_only',
  'recent_only',
];

/**
 * Return sessionStorage only when the code runs in a browser context.
 */
const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
};

/**
 * Normalize one optional string field into a trimmed value.
 */
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Persist only the allowed filter keys used by the apply-intent flow.
 */
const normalizeFilters = (filters) =>
  ALLOWED_FILTER_KEYS.reduce((normalizedFilters, key) => {
    const nextValue = normalizeString(filters?.[key]);

    if (nextValue) {
      normalizedFilters[key] = nextValue;
    }

    return normalizedFilters;
  }, {});

/**
 * Remove any stored apply intent when it is invalid, stale, or consumed.
 */
const clearStoredValue = () => {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(CANDIDATE_APPLY_INTENT_STORAGE_KEY);
  } catch {
    // Ignore storage errors and keep the apply flow usable.
  }
};

/**
 * Read the saved apply intent when it is still valid and within the configured TTL.
 */
export const readCandidateApplyIntent = () => {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(CANDIDATE_APPLY_INTENT_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    const jobId = Number(parsedValue?.jobId);
    const page = Math.max(1, Math.floor(Number(parsedValue?.page) || 1));
    const createdAt = Number(parsedValue?.createdAt) || 0;
    const filters = normalizeFilters(parsedValue?.filters);
    const selectedLocation =
      normalizeString(parsedValue?.selectedLocation) || filters.location || '';

    if (!Number.isFinite(jobId) || jobId <= 0) {
      clearStoredValue();
      return null;
    }

    if (!createdAt || Date.now() - createdAt > CANDIDATE_APPLY_INTENT_TTL_MS) {
      clearStoredValue();
      return null;
    }

    return {
      jobId,
      page,
      filters,
      selectedLocation,
      createdAt,
    };
  } catch {
    clearStoredValue();
    return null;
  }
};

/**
 * Save enough navigation state to bring a candidate back to the job they intended to apply for.
 */
export const saveCandidateApplyIntent = (intent) => {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  const jobId = Number(intent?.jobId);

  if (!Number.isFinite(jobId) || jobId <= 0) {
    return;
  }

  const filters = normalizeFilters(intent?.filters);
  const selectedLocation = normalizeString(intent?.selectedLocation) || filters.location || '';
  const normalizedIntent = {
    jobId,
    page: Math.max(1, Math.floor(Number(intent?.page) || 1)),
    filters,
    selectedLocation,
    createdAt: Date.now(),
  };

  try {
    storage.setItem(CANDIDATE_APPLY_INTENT_STORAGE_KEY, JSON.stringify(normalizedIntent));
  } catch {
    // Ignore storage errors and keep navigation working.
  }
};

export const clearCandidateApplyIntent = clearStoredValue;
