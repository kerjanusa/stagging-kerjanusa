import { mergeRecruiterPlanData } from './recruiterPlans.js';

const RECRUITER_COMPANY_PROFILE_STORAGE_PREFIX = 'recruiter_company_profile';
const RECRUITER_JOB_WORKFLOW_STORAGE_KEY = 'recruiter_job_workflow_state';
const RECRUITER_APPLICATION_STAGE_STORAGE_KEY = 'recruiter_application_stage_state';

export const RECRUITER_SECTION_OPTIONS = [
  { value: 'overview', label: 'Dashboard' },
  { value: 'company', label: 'Profil Perusahaan' },
  { value: 'jobs', label: 'Posting Lowongan' },
  { value: 'candidates', label: 'Pelamar' },
  { value: 'talent', label: 'Kolam Pelamar' },
  { value: 'messages', label: 'Chat' },
  { value: 'package', label: 'Paket' },
];

export const RECRUITER_PRIMARY_SECTION_OPTIONS = [
  { value: 'company', label: 'Profil Perusahaan', mobileLabel: 'Profil' },
  { value: 'jobs', label: 'Posting Lowongan', mobileLabel: 'Lowongan' },
  { value: 'candidates', label: 'Pelamar', mobileLabel: 'Pelamar' },
  { value: 'messages', label: 'Chat', mobileLabel: 'Chat' },
];

export const RECRUITER_COMPANY_EMPLOYEE_RANGE_OPTIONS = [
  '1 - 50 Tenaga Kerja',
  '51 - 255 Tenaga Kerja',
  '256 - 650 Tenaga Kerja',
  '650 - 3.000 Tenaga Kerja',
  'Lebih dari 3000 Tenaga Kerja',
];

export const RECRUITER_COMPANY_VERIFICATION_STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
};

export const RECRUITER_JOB_WORKFLOW_OPTIONS = [
  { value: 'draft', label: 'Tersimpan' },
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Nonaktif' },
  { value: 'closed', label: 'Ditutup' },
  { value: 'review', label: 'Dalam Review' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'filled', label: 'Hiring Selesai' },
];

export const APPLICATION_STAGE_OPTIONS = [
  { value: 'applied', label: 'Pelamar Masuk' },
  { value: 'screening', label: 'Screening' },
  { value: 'shortlisted', label: 'Shortlist' },
  { value: 'interview', label: 'Interview' },
  { value: 'offering', label: 'Offering' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Tidak lanjut' },
  { value: 'withdrawn', label: 'Dibatalkan kandidat' },
];

/**
 * Create the default recruiter company profile shape used by the dashboard form.
 */
const createRecruiterCompanyProfile = (user) => ({
  recruiterName: user?.name || '',
  companyName: user?.company_name || '',
  legalCompanyName: '',
  companyEmail: user?.email || '',
  phone: user?.phone || '',
  companyAddress: '',
  companyLocation: '',
  industry: '',
  employeeRange: '',
  companyDescription: '',
  companyLogoFileName: '',
  companyLogoDataUrl: '',
  website: '',
  companyLegalDocumentName: '',
  companyLegalDocumentPath: '',
  companyLegalDocumentMimeType: '',
  companyLegalDocumentSize: 0,
  companyLegalDocumentUploadedAt: '',
  verificationStatus: 'draft',
  verificationNotes: '',
  verificationSubmittedAt: '',
  verifiedAt: '',
  contactRole: '',
  hiringFocus: '',
  plan_code: 'starter',
  kn_credit: 0,
});

/**
 * Merge stored recruiter company data with defaults and normalized package data.
 */
const mergeRecruiterCompanyProfile = (user, savedProfile) => {
  const baseProfile = createRecruiterCompanyProfile(user);

  if (!savedProfile || typeof savedProfile !== 'object') {
    return baseProfile;
  }

  return mergeRecruiterPlanData({
    ...baseProfile,
    ...savedProfile,
    recruiterName: savedProfile.recruiterName || user?.name || '',
    companyName: savedProfile.companyName || user?.company_name || '',
    legalCompanyName: savedProfile.legalCompanyName || '',
    companyEmail: savedProfile.companyEmail || user?.email || '',
    phone: savedProfile.phone || user?.phone || '',
    companyAddress: savedProfile.companyAddress || savedProfile.companyLocation || '',
    companyLocation: savedProfile.companyLocation || savedProfile.companyAddress || '',
    industry: savedProfile.industry || '',
    employeeRange: savedProfile.employeeRange || '',
    companyLegalDocumentName: savedProfile.companyLegalDocumentName || '',
    companyLegalDocumentPath: savedProfile.companyLegalDocumentPath || '',
    companyLegalDocumentMimeType: savedProfile.companyLegalDocumentMimeType || '',
    companyLegalDocumentSize: Number(savedProfile.companyLegalDocumentSize || 0),
    companyLegalDocumentUploadedAt: savedProfile.companyLegalDocumentUploadedAt || '',
    verificationStatus:
      savedProfile.verificationStatus === 'verified' || savedProfile.verificationStatus === 'pending'
        ? savedProfile.verificationStatus
        : 'draft',
    verificationNotes: savedProfile.verificationNotes || '',
    verificationSubmittedAt: savedProfile.verificationSubmittedAt || '',
    verifiedAt: savedProfile.verifiedAt || '',
  });
};

/**
 * Read JSON from local storage with a safe fallback for SSR and parse failures.
 */
const readStoredJson = (storageKey, fallbackValue) => {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
};

/**
 * Persist a JSON-serializable value to local storage when running in the browser.
 */
const writeStoredJson = (storageKey, value) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

/**
 * Build the storage key used for one recruiter's local company-profile draft.
 */
export const getRecruiterCompanyProfileStorageKey = (userId) =>
  `${RECRUITER_COMPANY_PROFILE_STORAGE_PREFIX}:${userId || 'guest'}`;

/**
 * Resolve the recruiter company profile from backend data plus local draft overrides.
 */
export const readRecruiterCompanyProfile = (user) =>
  mergeRecruiterCompanyProfile(
    user,
    {
      ...(user?.recruiter_profile && typeof user.recruiter_profile === 'object'
        ? user.recruiter_profile
        : {}),
      ...(readStoredJson(getRecruiterCompanyProfileStorageKey(user?.id), null) || {}),
    }
  );

/**
 * Normalize and persist one recruiter company profile draft.
 */
export const saveRecruiterCompanyProfile = (user, profile) => {
  const normalizedCompanyAddress = profile?.companyAddress?.trim?.() || '';

  const normalizedProfile = mergeRecruiterCompanyProfile(user, {
    ...profile,
    recruiterName: profile?.recruiterName?.trim?.() || user?.name || '',
    companyName: profile?.companyName?.trim?.() || '',
    legalCompanyName: profile?.legalCompanyName?.trim?.() || '',
    companyEmail: profile?.companyEmail?.trim?.() || user?.email || '',
    phone: profile?.phone?.trim?.() || user?.phone || '',
    contactRole: profile?.contactRole?.trim?.() || '',
    companyAddress: normalizedCompanyAddress,
    companyLocation: normalizedCompanyAddress,
    industry: profile?.industry?.trim?.() || '',
    employeeRange: profile?.employeeRange?.trim?.() || '',
    companyDescription: profile?.companyDescription?.trim?.() || '',
    companyLogoFileName: profile?.companyLogoFileName?.trim?.() || '',
    companyLogoDataUrl: profile?.companyLogoDataUrl?.trim?.() || '',
    website: profile?.website?.trim?.() || '',
    companyLegalDocumentName: profile?.companyLegalDocumentName?.trim?.() || '',
    companyLegalDocumentPath: profile?.companyLegalDocumentPath?.trim?.() || '',
    companyLegalDocumentMimeType: profile?.companyLegalDocumentMimeType?.trim?.() || '',
    companyLegalDocumentSize: Math.max(0, Number(profile?.companyLegalDocumentSize || 0)),
    companyLegalDocumentUploadedAt: profile?.companyLegalDocumentUploadedAt?.trim?.() || '',
    verificationStatus:
      profile?.verificationStatus === 'verified' || profile?.verificationStatus === 'pending'
        ? profile.verificationStatus
        : 'draft',
    verificationNotes: profile?.verificationNotes?.trim?.() || '',
    verificationSubmittedAt: profile?.verificationSubmittedAt?.trim?.() || '',
    verifiedAt: profile?.verifiedAt?.trim?.() || '',
    hiringFocus: profile?.hiringFocus?.trim?.() || '',
  });

  writeStoredJson(getRecruiterCompanyProfileStorageKey(user?.id), normalizedProfile);

  return normalizedProfile;
};

/**
 * Count the non-whitespace characters used inside the recruiter company description.
 */
export const getRecruiterCompanyDescriptionLength = (profile) =>
  String(profile?.companyDescription || '').trim().length;

/**
 * Check whether the recruiter has uploaded a visible logo for the company profile.
 */
export const hasRecruiterCompanyLogo = (profile) =>
  Boolean(profile?.companyLogoDataUrl?.trim?.() || profile?.companyLogoFileName?.trim?.());

/**
 * Check whether the recruiter has attached a legal company document.
 */
export const hasRecruiterCompanyLegalDocument = (profile) =>
  Boolean(
    profile?.companyLegalDocumentPath?.trim?.() || profile?.companyLegalDocumentName?.trim?.()
  );

/**
 * Build the recruiter company-profile checklist used by readiness indicators.
 */
export const getRecruiterCompanyChecklist = (profile) => [
  {
    key: 'companyLogo',
    label: 'Logo perusahaan',
    isComplete: hasRecruiterCompanyLogo(profile),
    required: true,
  },
  {
    key: 'companyName',
    label: 'Nama brand perusahaan',
    isComplete: Boolean(profile.companyName?.trim()),
    required: true,
  },
  {
    key: 'legalCompanyName',
    label: 'Nama legal perusahaan',
    isComplete: Boolean(profile.legalCompanyName?.trim()),
    required: true,
  },
  {
    key: 'industry',
    label: 'Industri perusahaan',
    isComplete: Boolean(profile.industry?.trim()),
    required: true,
  },
  {
    key: 'employeeRange',
    label: 'Jumlah tenaga kerja',
    isComplete: Boolean(profile.employeeRange?.trim()),
    required: true,
  },
  {
    key: 'website',
    label: 'Website / sosial media perusahaan',
    isComplete: Boolean(profile.website?.trim()),
    required: true,
  },
  {
    key: 'companyDescription',
    label: 'Deskripsi perusahaan minimal 80 karakter',
    isComplete: getRecruiterCompanyDescriptionLength(profile) >= 80,
    required: true,
  },
  {
    key: 'companyLegalDocument',
    label: 'Dokumen legal perusahaan',
    isComplete: hasRecruiterCompanyLegalDocument(profile),
    required: true,
  },
  {
    key: 'recruiterName',
    label: 'Nama PIC perusahaan',
    isComplete: Boolean(profile.recruiterName?.trim()),
    required: true,
  },
  {
    key: 'companyEmail',
    label: 'Email perusahaan / PIC',
    isComplete: Boolean(profile.companyEmail?.trim()),
    required: true,
  },
  {
    key: 'phone',
    label: 'Nomor kontak perusahaan',
    isComplete: Boolean(profile.phone?.trim()),
    required: true,
  },
  {
    key: 'companyAddress',
    label: 'Alamat perusahaan',
    isComplete: Boolean(profile.companyAddress?.trim()),
    required: true,
  },
];

/**
 * Summarize recruiter company-profile completeness and readiness percentages.
 */
export const getRecruiterCompanyCompletion = (profile) => {
  const checklist = getRecruiterCompanyChecklist(profile);
  const requiredChecklist = checklist.filter((item) => item.required);
  const completedItems = checklist.filter((item) => item.isComplete).length;
  const completedRequiredItems = requiredChecklist.filter((item) => item.isComplete).length;
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
    completionPercent: Math.round((completedItems / checklist.length) * 100),
    readinessPercent: Math.round((completedRequiredItems / requiredChecklist.length) * 100),
    missingRequiredItems,
    isReady: missingRequiredItems.length === 0,
  };
};

/**
 * Read the locally stored workflow-status overrides for recruiter job cards.
 */
const readJobWorkflowMap = () => readStoredJson(RECRUITER_JOB_WORKFLOW_STORAGE_KEY, {});

/**
 * Format one recruiter job-workflow status into a display label.
 */
export const getJobWorkflowLabel = (status) =>
  RECRUITER_JOB_WORKFLOW_OPTIONS.find((option) => option.value === status)?.label || status;

/**
 * Menentukan tone badge recruiter dari satu status workflow lowongan.
 */
export const getJobWorkflowTone = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'review':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'closed':
    case 'paused':
    case 'filled':
      return 'muted';
    case 'draft':
    default:
      return 'muted';
  }
};

/**
 * Resolve the effective recruiter workflow status for one job from API or local override state.
 */
export const getJobWorkflowStatus = (job) => {
  if (job?.workflow_status) {
    return job.workflow_status;
  }

  const workflowMap = readJobWorkflowMap();
  const storedStatus = workflowMap[String(job?.id)];

  if (storedStatus) {
    return storedStatus;
  }

  return job?.status === 'active' ? 'active' : 'draft';
};

/**
 * Persist the recruiter workflow-status override for one job.
 */
export const saveJobWorkflowStatus = (jobId, workflowStatus) => {
  const workflowMap = readJobWorkflowMap();
  const nextWorkflowMap = {
    ...workflowMap,
    [String(jobId)]: workflowStatus,
  };

  writeStoredJson(RECRUITER_JOB_WORKFLOW_STORAGE_KEY, nextWorkflowMap);
  return nextWorkflowMap;
};

/**
 * Map recruiter-facing workflow values back to the legacy backend status field.
 */
export const mapJobWorkflowToBackendStatus = (workflowStatus) =>
  workflowStatus === 'active' ? 'active' : 'inactive';

/**
 * Read the locally stored recruiter application-stage overrides.
 */
const readApplicationStageMap = () => readStoredJson(RECRUITER_APPLICATION_STAGE_STORAGE_KEY, {});

/**
 * Format one recruiter application stage into a display label.
 */
export const getApplicationStageLabel = (stage) =>
  APPLICATION_STAGE_OPTIONS.find((option) => option.value === stage)?.label || stage;

/**
 * Map a legacy application status into the richer recruiter-facing pipeline stage.
 */
export const mapApplicationStatusToStage = (status) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'screening':
      return 'screening';
    case 'shortlisted':
    case 'accepted':
      return 'shortlisted';
    case 'interview':
      return 'interview';
    case 'offering':
      return 'offering';
    case 'hired':
      return 'hired';
    case 'rejected':
      return 'rejected';
    case 'withdrawn':
      return 'withdrawn';
    case 'pending':
    default:
      return 'applied';
  }
};

/**
 * Resolve the effective stage for one application from API data or local recruiter override state.
 */
export const getApplicationStage = (application) => {
  if (application?.stage) {
    return application.stage;
  }

  const stageMap = readApplicationStageMap();
  const storedStage = stageMap[String(application?.id)]?.stage;

  if (storedStage) {
    return storedStage;
  }

  return mapApplicationStatusToStage(application?.status);
};

/**
 * Persist the recruiter-facing stage override for one application card.
 */
export const saveApplicationStage = (applicationId, stage) => {
  const stageMap = readApplicationStageMap();
  const nextStageMap = {
    ...stageMap,
    [String(applicationId)]: {
      stage,
      updated_at: new Date().toISOString(),
    },
  };

  writeStoredJson(RECRUITER_APPLICATION_STAGE_STORAGE_KEY, nextStageMap);
  return nextStageMap;
};

/**
 * Map a recruiter-facing application stage back to the legacy backend status enum.
 */
export const mapApplicationStageToBackendStatus = (stage) => {
  switch (stage) {
    case 'rejected':
      return 'rejected';
    case 'withdrawn':
      return 'withdrawn';
    case 'shortlisted':
    case 'interview':
    case 'offering':
    case 'hired':
      return 'accepted';
    case 'applied':
    case 'screening':
    default:
      return 'pending';
  }
};

/**
 * Check whether a recruiter pipeline stage still counts as actively in progress.
 */
export const isRecruiterApplicationStageActive = (stage) =>
  !['hired', 'rejected', 'withdrawn'].includes(stage);

/**
 * Return tone and summary metadata for recruiter pipeline stage badges and cards.
 */
export const getRecruiterApplicationStageMeta = (stage) => {
  switch (stage) {
    case 'screening':
      return {
        tone: 'warning',
        summary: 'Recruiter sedang meninjau kelengkapan profil dan kecocokan awal kandidat.',
      };
    case 'shortlisted':
      return {
        tone: 'info',
        summary: 'Kandidat masuk shortlist dan siap dibawa ke tahap lanjutan.',
      };
    case 'interview':
      return {
        tone: 'primary',
        summary: 'Kandidat sedang atau akan menjalani proses interview.',
      };
    case 'offering':
      return {
        tone: 'success',
        summary: 'Kandidat sudah masuk tahap penawaran kerja.',
      };
    case 'hired':
      return {
        tone: 'success',
        summary: 'Kandidat sudah dipilih untuk mengisi lowongan ini.',
      };
    case 'rejected':
      return {
        tone: 'danger',
        summary: 'Proses kandidat dihentikan pada lowongan ini.',
      };
    case 'withdrawn':
      return {
        tone: 'muted',
        summary: 'Kandidat membatalkan lamaran dan tidak lagi diproses.',
      };
    case 'applied':
    default:
      return {
        tone: 'neutral',
        summary: 'Lamaran baru masuk dan menunggu screening recruiter.',
      };
  }
};

/**
 * Recommend the next recruiter dashboard action based on profile, jobs, and pipeline activity.
 */
export const getRecruiterOverviewNextAction = ({
  companyCompletion,
  jobs,
  activeApplicationsCount,
}) => {
  if (!companyCompletion.isReady) {
    return {
      title: 'Lengkapi profil company minimum',
      description:
        'Isi nama perusahaan, ringkasan bisnis, lokasi utama, dan PIC recruiter sebelum membuka hiring secara penuh.',
      section: 'company',
      cta: 'Buka profil company',
    };
  }

  if (jobs.length === 0) {
    return {
      title: 'Buat lowongan pertama',
      description:
        'Profil company sudah siap. Lanjutkan ke pembuatan lowongan agar kandidat bisa mulai masuk ke pipeline.',
      section: 'jobs',
      cta: 'Kelola lowongan',
    };
  }

  if (activeApplicationsCount === 0) {
    return {
      title: 'Pastikan ada lowongan aktif',
      description:
        'Belum ada kandidat aktif yang bergerak. Publikasikan atau aktifkan kembali lowongan yang relevan.',
      section: 'jobs',
      cta: 'Lihat status lowongan',
    };
  }

  return {
    title: 'Gerakkan pipeline kandidat',
    description:
      'Ada kandidat yang sudah masuk. Fokus berikutnya adalah screening cepat dan memindahkan kandidat ke tahap yang tepat.',
    section: 'candidates',
    cta: 'Buka pipeline kandidat',
  };
};
