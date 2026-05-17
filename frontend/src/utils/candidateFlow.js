import { formatExperienceLevel } from './jobFormatters.js';
import {
  getApplicationStage,
  getApplicationStageLabel,
  isRecruiterApplicationStageActive,
} from './recruiterFlow.js';

const CANDIDATE_PROFILE_STORAGE_PREFIX = 'candidate_dashboard_profile';
const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
const MIN_EXPERIENCE_YEAR = CURRENT_CALENDAR_YEAR - 50;

/**
 * Create one empty experience item used by the candidate profile form.
 */
const createExperienceItem = () => ({
  company: '',
  position: '',
  year: '',
  startYear: '',
  endYear: '',
  responsibilities: '',
  achievement: '',
  reasonForLeaving: '',
  referenceName: '',
  referencePhone: '',
});

/**
 * Create one empty organization-activity item used by the candidate profile form.
 */
const createOrganizationActivityItem = () => ({
  organizationName: '',
  role: '',
  startYear: '',
  endYear: '',
  description: '',
});

/**
 * Force list-based profile fields to a fixed maximum length of string entries.
 */
const normalizeStringList = (items, maxLength) =>
  Array.from({ length: maxLength }, (_, index) => String(items?.[index] || ''));

/**
 * Normalize arbitrary text input into a trimmed string.
 */
const trimText = (value) => String(value || '').trim();

/**
 * Keep age input numeric and constrained to a sensible range for the profile form.
 */
const normalizeAgeValue = (value) => {
  const digitsOnly = String(value ?? '')
    .replace(/[^\d]/g, '')
    .slice(0, 3);

  if (!digitsOnly) {
    return '';
  }

  const parsedAge = Number.parseInt(digitsOnly, 10);

  if (!Number.isFinite(parsedAge)) {
    return '';
  }

  return String(Math.max(0, Math.min(100, parsedAge)));
};

/**
 * Keep salary input numeric-only for storage and form comparison.
 */
const normalizeSalaryValue = (value) =>
  String(value ?? '')
    .replace(/[^\d]/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 12);

/**
 * Normalize education end-year input while preserving semantic special values.
 */
const normalizeEducationEndYearValue = (value) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (['ongoing', 'in-progress', 'masih pendidikan', 'sedang pendidikan'].includes(normalizedValue)) {
    return 'ongoing';
  }

  if (['not_graduated', 'not-graduated', 'tidak lulus'].includes(normalizedValue)) {
    return 'not_graduated';
  }

  return normalizeExperienceYearValue(value);
};

/**
 * Normalize one year-like value and optionally allow the "current" sentinel.
 */
const normalizeExperienceYearValue = (value, { allowCurrent = false } = {}) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (allowCurrent && ['current', 'now', 'sekarang', 'saat ini', 'present'].includes(normalizedValue)) {
    return 'current';
  }

  const digitsOnly = normalizedValue.replace(/[^\d]/g, '').slice(0, 4);

  if (digitsOnly.length !== 4) {
    return '';
  }

  const parsedYear = Number.parseInt(digitsOnly, 10);

  if (!Number.isFinite(parsedYear)) {
    return '';
  }

  if (parsedYear < MIN_EXPERIENCE_YEAR || parsedYear > CURRENT_CALENDAR_YEAR) {
    return '';
  }

  return String(parsedYear);
};

/**
 * Combine start and end years into the legacy display range used by the UI.
 */
const buildExperienceYearRange = (startYear = '', endYear = '') => {
  const normalizedStartYear = normalizeExperienceYearValue(startYear);
  const normalizedEndYear = normalizeExperienceYearValue(endYear, { allowCurrent: true });

  if (!normalizedStartYear && !normalizedEndYear) {
    return '';
  }

  if (normalizedStartYear && !normalizedEndYear) {
    return normalizedStartYear;
  }

  if (!normalizedStartYear && normalizedEndYear === 'current') {
    return 'Masih bekerja';
  }

  return `${normalizedStartYear || '-'} - ${
    normalizedEndYear === 'current' ? 'Masih bekerja' : normalizedEndYear
  }`;
};

/**
 * Parse older free-form year ranges into the newer structured start/end year shape.
 */
const parseLegacyExperienceYearRange = (value = '') => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const matchedYears = normalizedValue.match(/\b(19|20)\d{2}\b/g) || [];
  const uniqueYears = [...new Set(matchedYears)];
  const hasCurrentToken = /\b(current|now|sekarang|saat ini|present)\b/.test(normalizedValue);

  if (uniqueYears.length >= 2) {
    return {
      startYear: normalizeExperienceYearValue(uniqueYears[0]),
      endYear: normalizeExperienceYearValue(uniqueYears[1], { allowCurrent: true }),
    };
  }

  if (uniqueYears.length === 1) {
    return {
      startYear: normalizeExperienceYearValue(uniqueYears[0]),
      endYear: hasCurrentToken ? 'current' : '',
    };
  }

  return {
    startYear: '',
    endYear: hasCurrentToken ? 'current' : '',
  };
};

/**
 * Extract a lowercase file extension from a file name.
 */
const getFileExtension = (fileName = '') => String(fileName || '').trim().toLowerCase().split('.').pop() || '';

/**
 * Restrict demo resume storage to PDF-like file names.
 */
const isPdfResumeFileName = (fileName = '') => getFileExtension(fileName) === 'pdf';

/**
 * Return the first non-empty string in one ordered list.
 */
const firstFilledText = (items = []) => items.find((item) => trimText(item)) || '';

/**
 * Auto-generate a lightweight profile summary when the candidate leaves it blank.
 */
const buildAutoProfileSummary = (profile) => {
  const role = trimText(firstFilledText(profile?.preferredRoles));
  const employmentType = trimText(profile?.employmentType);
  const targetIndustry = trimText(profile?.targetIndustry);
  const latestPosition = trimText(profile?.experiences?.[0]?.position);
  const latestCompany = trimText(profile?.experiences?.[0]?.company);
  const currentAddress = trimText(profile?.currentAddress);

  if (
    !role &&
    !employmentType &&
    !targetIndustry &&
    !latestPosition &&
    !latestCompany &&
    !currentAddress
  ) {
    return '';
  }

  const summaryParts = [
    role ? `Menargetkan posisi ${role}` : 'Kandidat profesional aktif',
    employmentType ? `dengan preferensi kerja ${employmentType}` : '',
    targetIndustry ? `di sektor ${targetIndustry}` : '',
    latestPosition || latestCompany
      ? `berbekal pengalaman terakhir sebagai ${latestPosition || 'profesional'}${
          latestCompany ? ` di ${latestCompany}` : ''
        }`
      : '',
    currentAddress ? `dan berdomisili di ${currentAddress}` : '',
  ].filter(Boolean);

  return `${summaryParts.join(' ')}.`;
};

/**
 * Create the full default candidate profile shape used by the dashboard.
 */
export const createCandidateProfile = (user) => ({
  fullName: user?.name || '',
  email: user?.email || '',
  phone: user?.phone || '',
  activeContactName: '',
  placeOfBirth: '',
  dateOfBirth: '',
  currentAddress: '',
  gender: '',
  age: '',
  profileSummary: '',
  employmentType: '',
  targetIndustry: '',
  photoFileName: '',
  photoDataUrl: '',
  linkedin: '',
  instagram: '',
  tiktok: '',
  otherSocial: '',
  education: {
    degree: '',
    institution: '',
    major: '',
    startYear: '',
    endYear: '',
  },
  organizationActivity: createOrganizationActivityItem(),
  experiences: Array.from({ length: 5 }, createExperienceItem),
  skills: Array.from({ length: 5 }, () => ''),
  preferredLocations: Array.from({ length: 5 }, () => ''),
  preferredRoles: Array.from({ length: 5 }, () => ''),
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: 'bulan',
  resumeFiles: [],
  certificateFiles: [],
});

/**
 * Merge stored profile data with defaults while normalizing legacy and free-form fields.
 */
export const mergeCandidateProfile = (user, savedProfile) => {
  const baseProfile = createCandidateProfile(user);

  if (!savedProfile || typeof savedProfile !== 'object') {
    return baseProfile;
  }

  const normalizedPreferredLocations = normalizeStringList(savedProfile.preferredLocations, 5);
  const normalizedSkills = normalizeStringList(savedProfile.skills, 5);

  if (!firstFilledText(normalizedPreferredLocations) && trimText(savedProfile.currentAddress)) {
    normalizedPreferredLocations[0] = trimText(savedProfile.currentAddress);
  }

  if (!firstFilledText(normalizedSkills)) {
    normalizedSkills[0] =
      trimText(savedProfile.targetIndustry) || trimText(savedProfile.education?.major);
  }

  const profileSummary =
    trimText(savedProfile.profileSummary) || buildAutoProfileSummary(savedProfile);

  return {
    ...baseProfile,
    ...savedProfile,
    fullName: savedProfile.fullName || user?.name || '',
    email: savedProfile.email || user?.email || '',
    phone: savedProfile.phone || user?.phone || '',
    gender: trimText(savedProfile.gender),
    age: normalizeAgeValue(savedProfile.age),
    photoFileName: trimText(savedProfile.photoFileName),
    photoDataUrl: trimText(savedProfile.photoDataUrl),
    profileSummary,
    education: {
      ...baseProfile.education,
      ...(savedProfile.education || {}),
      startYear: normalizeExperienceYearValue(savedProfile.education?.startYear),
      endYear: normalizeEducationEndYearValue(savedProfile.education?.endYear),
    },
    organizationActivity: {
      ...baseProfile.organizationActivity,
      ...(savedProfile.organizationActivity || {}),
      organizationName: trimText(savedProfile.organizationActivity?.organizationName),
      role: trimText(savedProfile.organizationActivity?.role),
      startYear: normalizeExperienceYearValue(savedProfile.organizationActivity?.startYear),
      endYear: normalizeExperienceYearValue(savedProfile.organizationActivity?.endYear, {
        allowCurrent: true,
      }),
      description: trimText(savedProfile.organizationActivity?.description),
    },
    experiences: baseProfile.experiences.map((item, index) => {
      const savedExperience = savedProfile.experiences?.[index] || {};
      const parsedLegacyYearRange = parseLegacyExperienceYearRange(savedExperience.year);
      const startYear = normalizeExperienceYearValue(
        savedExperience.startYear || parsedLegacyYearRange.startYear
      );
      const endYear = normalizeExperienceYearValue(
        savedExperience.endYear || parsedLegacyYearRange.endYear,
        { allowCurrent: true }
      );

      return {
        ...item,
        ...savedExperience,
        startYear,
        endYear,
        year: buildExperienceYearRange(startYear, endYear),
      };
    }),
    skills: normalizedSkills,
    preferredLocations: normalizedPreferredLocations,
    preferredRoles: normalizeStringList(savedProfile.preferredRoles, 5),
    resumeFiles: Array.isArray(savedProfile.resumeFiles)
      ? savedProfile.resumeFiles.filter(isPdfResumeFileName).slice(0, 3)
      : [],
    certificateFiles: Array.isArray(savedProfile.certificateFiles)
      ? savedProfile.certificateFiles.slice(0, 5)
      : [],
  };
};

/**
 * Build the storage key used for one candidate's local profile draft.
 */
export const getCandidateProfileStorageKey = (userId) =>
  `${CANDIDATE_PROFILE_STORAGE_PREFIX}:${userId || 'guest'}`;

/**
 * Resolve the best available candidate profile source from backend data and local draft data.
 */
const getCandidateProfileSource = (user, options = {}) => {
  const preferStoredDraft = options.preferStoredDraft ?? true;
  const backendProfile =
    user?.candidate_profile && typeof user.candidate_profile === 'object'
      ? user.candidate_profile
      : null;

  if (!preferStoredDraft) {
    return mergeCandidateProfile(user, backendProfile);
  }

  if (typeof window === 'undefined') {
    return mergeCandidateProfile(user, backendProfile);
  }

  try {
    const storedProfile = localStorage.getItem(getCandidateProfileStorageKey(user?.id));
    const parsedStoredProfile = storedProfile ? JSON.parse(storedProfile) : null;

    return mergeCandidateProfile(user, {
      ...(backendProfile || {}),
      ...(parsedStoredProfile && typeof parsedStoredProfile === 'object' ? parsedStoredProfile : {}),
    });
  } catch {
    return mergeCandidateProfile(user, backendProfile);
  }
};

/**
 * Read the current candidate profile view model for one logged-in user.
 */
export const readCandidateProfile = (user, options = {}) => {
  return getCandidateProfileSource(user, options);
};

/**
 * Normalize and persist one candidate profile draft to local storage.
 */
export const saveCandidateProfile = (user, profile) => {
  const normalizedProfile = mergeCandidateProfile(user, {
    ...profile,
    fullName: trimText(profile?.fullName),
    email: trimText(profile?.email) || user?.email || '',
    phone: trimText(profile?.phone),
    currentAddress: trimText(profile?.currentAddress),
    gender: trimText(profile?.gender),
    age: normalizeAgeValue(profile?.age),
    employmentType: trimText(profile?.employmentType),
    targetIndustry: trimText(profile?.targetIndustry),
    salaryMin: normalizeSalaryValue(profile?.salaryMin),
    salaryMax: normalizeSalaryValue(profile?.salaryMax),
    photoFileName: trimText(profile?.photoFileName),
    photoDataUrl: trimText(profile?.photoDataUrl),
    profileSummary: trimText(profile?.profileSummary) || buildAutoProfileSummary(profile),
  });

  if (typeof window === 'undefined') {
    return normalizedProfile;
  }

  try {
    localStorage.setItem(
      getCandidateProfileStorageKey(user?.id),
      JSON.stringify(normalizedProfile)
    );
  } catch {
    // Keep the profile usable even when the browser cannot persist the draft locally.
  }

  return normalizedProfile;
};

/**
 * Count how many entries in one simple string list are meaningfully filled.
 */
export const countFilledItems = (items = []) =>
  items.filter((item) => String(item || '').trim()).length;

/**
 * Build the candidate profile checklist used by readiness and completeness indicators.
 */
export const getCandidateProfileChecklist = (profile) => {
  const hasLatestEducation =
    Boolean(profile.education?.institution?.trim()) || Boolean(profile.education?.major?.trim());
  const hasExperience = profile.experiences.some(
    (item) => item.company?.trim() || item.position?.trim()
  );

  return [
    { key: 'fullName', label: 'Nama lengkap', isComplete: Boolean(profile.fullName?.trim()), required: true },
    { key: 'phone', label: 'Nomor telepon aktif', isComplete: Boolean(profile.phone?.trim()), required: true },
    { key: 'email', label: 'Email akun', isComplete: Boolean(profile.email?.trim()), required: true },
    {
      key: 'currentAddress',
      label: 'Domisili / alamat saat ini',
      isComplete: Boolean(profile.currentAddress?.trim()),
      required: true,
    },
    {
      key: 'preferredRoles',
      label: 'Posisi yang diminati',
      isComplete: countFilledItems(profile.preferredRoles) > 0,
      required: true,
    },
    {
      key: 'employmentType',
      label: 'Tipe pekerjaan',
      isComplete: Boolean(trimText(profile.employmentType)),
      required: true,
    },
    {
      key: 'targetIndustry',
      label: 'Industri target',
      isComplete: Boolean(trimText(profile.targetIndustry)),
      required: true,
    },
    {
      key: 'educationOrExperience',
      label: 'Pendidikan atau pengalaman terbaru',
      isComplete: hasLatestEducation || hasExperience,
      required: true,
    },
    {
      key: 'resumeFiles',
      label: 'CV / resume',
      isComplete: profile.resumeFiles.length > 0,
      required: true,
    },
    {
      key: 'photoFileName',
      label: 'Foto profil',
      isComplete: Boolean(profile.photoDataUrl || profile.photoFileName),
      required: false,
    },
    {
      key: 'salaryExpectation',
      label: 'Ekspektasi gaji',
      isComplete: Boolean(profile.salaryMin?.trim()) && Boolean(profile.salaryMax?.trim()),
      required: false,
    },
    {
      key: 'certificates',
      label: 'Dokumen pendukung',
      isComplete: profile.certificateFiles.length > 0,
      required: false,
    },
  ];
};

/**
 * Summarize candidate profile completeness and required-field readiness percentages.
 */
export const getCandidateProfileCompletion = (profile) => {
  const checklist = getCandidateProfileChecklist(profile);
  const requiredChecklist = checklist.filter((item) => item.required);
  const completedItems = checklist.filter((item) => item.isComplete).length;
  const completedRequiredItems = requiredChecklist.filter((item) => item.isComplete).length;
  const completionPercent = Math.round((completedItems / checklist.length) * 100);
  const readinessPercent = Math.round((completedRequiredItems / requiredChecklist.length) * 100);
  const missingRequiredItems = requiredChecklist
    .filter((item) => !item.isComplete)
    .map((item) => item.label);

  return {
    checklist,
    requiredChecklist,
    completedItems,
    totalItems: checklist.length,
    completedRequiredItems,
    totalRequiredItems: requiredChecklist.length,
    completionPercent,
    readinessPercent,
    isReady: missingRequiredItems.length === 0,
    missingRequiredItems,
  };
};

/**
 * Convert profile completion metrics into one short candidate-facing status label.
 */
export const getCandidateProfileStatusLabel = (completion) => {
  if (completion.isReady) {
    return 'Siap melamar';
  }

  if (completion.readinessPercent >= 70) {
    return 'Hampir siap melamar';
  }

  return 'Belum siap melamar';
};

/**
 * Normalize comparison text used by the candidate job-matching helpers.
 */
const normalizeText = (value = '') => String(value).trim().toLowerCase();

/**
 * Check whether any candidate keyword appears in a normalized text haystack.
 */
const includesAnyText = (haystack, needles) => {
  const normalizedHaystack = normalizeText(haystack);

  return needles.some((needle) => {
    const normalizedNeedle = normalizeText(needle);
    return normalizedNeedle && normalizedHaystack.includes(normalizedNeedle);
  });
};

/**
 * Score one job against the candidate profile and return a few human-readable reasons.
 */
export const getCandidateJobMatchScore = (job, profile) => {
  let score = 0;
  const reasons = [];
  const preferredRoles = profile.preferredRoles.filter((item) => item.trim());
  const preferredLocations = profile.preferredLocations.filter((item) => item.trim());
  const skills = profile.skills.filter((item) => item.trim());

  if (includesAnyText(`${job.title} ${job.category}`, preferredRoles)) {
    score += 4;
    reasons.push('Posisi sesuai minat Anda');
  }

  if (includesAnyText(job.location, preferredLocations)) {
    score += 3;
    reasons.push('Lokasi cocok dengan preferensi');
  }

  if (includesAnyText(job.description, skills)) {
    score += 2;
    reasons.push('Kebutuhan lowongan relevan dengan skill Anda');
  }

  if (profile.experiences.some((item) => includesAnyText(`${item.position} ${item.company}`, [job.title, job.category]))) {
    score += 2;
    reasons.push('Ada pengalaman yang mendekati posisi ini');
  }

  if (job.experience_level === 'entry') {
    score += 1;
    reasons.push('Cocok untuk kandidat yang masih tahap awal karier');
  }

  return {
    score,
    reasons: reasons.slice(0, 3),
  };
};

/**
 * Sort jobs into a candidate-facing recommendation order and annotate match metadata.
 */
export const sortCandidateRecommendedJobs = (jobs, profile, applications = []) => {
  const appliedJobIds = new Set(applications.map((application) => Number(application.job_id)));

  return [...jobs]
    .filter((job) => job.status !== 'inactive')
    .map((job) => ({
      ...job,
      candidate_match: getCandidateJobMatchScore(job, profile),
      alreadyApplied: appliedJobIds.has(Number(job.id)),
    }))
    .sort((firstJob, secondJob) => {
      if (secondJob.candidate_match.score !== firstJob.candidate_match.score) {
        return secondJob.candidate_match.score - firstJob.candidate_match.score;
      }

      return Number(secondJob.id) - Number(firstJob.id);
    });
};

const APPLICATION_STAGE_META = {
  applied: {
    label: 'Sedang direview',
    summary: 'Lamaran sudah terkirim dan sedang ditinjau recruiter.',
    nextAction: 'Pantau status secara berkala. Pastikan nomor telepon Anda aktif.',
    tone: 'warning',
    progressStep: 1,
  },
  screening: {
    label: 'Sedang discreening',
    summary: 'Recruiter sedang memeriksa kecocokan awal profil Anda dengan kebutuhan lowongan.',
    nextAction: 'Pastikan profil, CV, dan kontak Anda tetap aktif dan mudah dihubungi.',
    tone: 'warning',
    progressStep: 1,
  },
  shortlisted: {
    label: 'Lolos seleksi awal',
    summary: 'Profil Anda masuk shortlist dan menunggu proses lanjutan dari recruiter.',
    nextAction: 'Siapkan diri untuk dihubungi recruiter terkait interview atau instruksi berikutnya.',
    tone: 'success',
    progressStep: 2,
  },
  interview: {
    label: 'Masuk tahap interview',
    summary: 'Recruiter membawa Anda ke tahap interview untuk proses seleksi berikutnya.',
    nextAction: 'Cek email dan telepon secara berkala agar jadwal interview tidak terlewat.',
    tone: 'success',
    progressStep: 2,
  },
  offering: {
    label: 'Masuk tahap offering',
    summary: 'Anda sudah masuk tahap penawaran kerja untuk lowongan ini.',
    nextAction: 'Siapkan dokumen tambahan dan periksa detail penawaran dari recruiter.',
    tone: 'success',
    progressStep: 2,
  },
  hired: {
    label: 'Diterima',
    summary: 'Recruiter memilih Anda untuk mengisi lowongan ini.',
    nextAction: 'Pastikan komunikasi onboarding dan dokumen kerja Anda berjalan lancar.',
    tone: 'success',
    progressStep: 3,
  },
  rejected: {
    label: 'Tidak lanjut',
    summary: 'Recruiter memutuskan untuk tidak melanjutkan proses pada lowongan ini.',
    nextAction: 'Gunakan profil yang sama untuk melamar lowongan serupa lainnya.',
    tone: 'danger',
    progressStep: 3,
  },
  withdrawn: {
    label: 'Dibatalkan',
    summary: 'Lamaran dibatalkan dan tidak lagi diproses.',
    nextAction: 'Anda bisa fokus ke lowongan lain yang lebih cocok.',
    tone: 'muted',
    progressStep: 3,
  },
};

/**
 * Format the current application stage into the short label shown to candidates.
 */
export const formatCandidateApplicationStatus = (status, application = null) =>
  APPLICATION_STAGE_META[getApplicationStage(application || { status })]?.label ||
  getApplicationStageLabel(getApplicationStage(application || { status })) ||
  'Status belum dikenal';

/**
 * Return the candidate-facing meta block for one application stage.
 */
export const getCandidateApplicationMeta = (status, application = null) => {
  const stage = getApplicationStage(application || { status });

  return APPLICATION_STAGE_META[stage] || {
    label: getApplicationStageLabel(stage) || status || 'Status belum dikenal',
    summary: 'Status lamaran belum tersedia.',
    nextAction: 'Periksa kembali nanti.',
    tone: 'muted',
    progressStep: 0,
  };
};

/**
 * Build the simplified candidate application timeline based on the current stage.
 */
export const getCandidateApplicationTimeline = (status, application = null) => {
  const stage = getApplicationStage(application || { status });
  const { progressStep } = getCandidateApplicationMeta(status, application);
  const finalLabel =
    stage === 'hired'
      ? 'Diterima'
      : stage === 'rejected'
        ? 'Tidak lanjut'
        : stage === 'withdrawn'
          ? 'Dibatalkan'
          : 'Proses lanjut';

  return [
    { key: 'submitted', label: 'Terkirim', done: progressStep >= 0, current: progressStep === 0 },
    { key: 'review', label: 'Direview', done: progressStep >= 1, current: progressStep === 1 },
    {
      key: 'result',
      label: progressStep >= 2 ? finalLabel : 'Menunggu hasil',
      done: progressStep >= 2,
      current: progressStep === 2,
    },
  ];
};

/**
 * Check whether an application stage is still considered active for the candidate.
 */
export const isCandidateApplicationActive = (status, application = null) =>
  isRecruiterApplicationStageActive(getApplicationStage(application || { status }));

/**
 * Choose a short career-stage label from the candidate's saved profile.
 */
export const formatCandidateCareerStage = (profile) => {
  const latestRole = profile.preferredRoles.find((item) => item.trim());
  const hasExperience = profile.experiences.some((item) => item.company?.trim() || item.position?.trim());

  if (latestRole) {
    return latestRole;
  }

  if (hasExperience) {
    return 'Kandidat berpengalaman';
  }

  return formatExperienceLevel('entry');
};
