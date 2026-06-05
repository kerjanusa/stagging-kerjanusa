export const EXPERIENCE_LEVEL_LABELS = {
  entry: 'Entry Level (Freshgraduate)',
  junior: 'Junior Level (1 - 3 tahun)',
  mid: 'Mid Level (3 - 5 tahun)',
  senior: 'Senior Level (5 + tahun)',
};

export const JOB_TYPE_LABELS = {
  'full-time': 'Fulltime / Tetap',
  'part-time': 'Magang / Paruh waktu',
  contract: 'Kontrak',
  freelance: 'Freelance',
  internship: 'Magang',
};

export const WORK_MODE_LABELS = {
  wfo: 'WFO',
  hybrid: 'Hybrid (Campuran)',
  wfh: 'WFH',
};

export const INTERVIEW_TYPE_LABELS = {
  onsite: 'Tatap muka di lokasi',
  online: 'Online / Video Call',
  phone: 'Telepon',
  hybrid: 'Hybrid (Campuran)',
};

export const VIDEO_SCREENING_LABELS = {
  required: 'Aktif (Video identitas wajib)',
  optional: 'Nonaktif',
};

/**
 * Convert machine-style enum values into a human-readable start-cased fallback label.
 */
const startCase = (value = '') =>
  String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

/**
 * Format a job experience-level enum into a recruiter-friendly label.
 */
export const formatExperienceLevel = (value = '') =>
  EXPERIENCE_LEVEL_LABELS[value] || startCase(value) || '-';

/**
 * Format a job-type enum into a candidate-facing label.
 */
export const formatJobType = (value = '') => JOB_TYPE_LABELS[value] || startCase(value) || '-';

/**
 * Format a work-mode enum into a display label for the UI.
 */
export const formatWorkMode = (value = '') => WORK_MODE_LABELS[value] || startCase(value) || '-';

/**
 * Format an interview-type enum into a display label for the UI.
 */
export const formatInterviewType = (value = '') =>
  INTERVIEW_TYPE_LABELS[value] || startCase(value) || '-';

/**
 * Format the video-screening requirement enum into its short display label.
 */
export const formatVideoScreeningRequirement = (value = '') =>
  VIDEO_SCREENING_LABELS[value] || '';
