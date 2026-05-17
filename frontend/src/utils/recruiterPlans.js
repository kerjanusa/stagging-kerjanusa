export const RECRUITER_PLAN_OPTIONS = [
  {
    code: 'starter',
    label: 'Starter',
    description: 'Cocok untuk recruiter yang baru memulai pipeline kandidat.',
    job_limit: 3,
    talent_result_limit: 15,
    visible_resume_files: 1,
    visible_certificate_files: 0,
  },
  {
    code: 'growth',
    label: 'Growth',
    description: 'Paket menengah untuk screening lebih luas dan akses berkas tambahan.',
    job_limit: 10,
    talent_result_limit: 60,
    visible_resume_files: 3,
    visible_certificate_files: 2,
  },
  {
    code: 'scale',
    label: 'Scale',
    description: 'Paket penuh untuk tim hiring dengan volume tinggi.',
    job_limit: null,
    talent_result_limit: 200,
    visible_resume_files: 10,
    visible_certificate_files: 10,
  },
];

/**
 * Normalize arbitrary package input to one known recruiter plan code.
 */
export const normalizeRecruiterPlanCode = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (RECRUITER_PLAN_OPTIONS.some((plan) => plan.code === normalizedValue)) {
    return normalizedValue;
  }

  return 'starter';
};

/**
 * Resolve one recruiter plan configuration object by code.
 */
export const getRecruiterPlanConfig = (planCode) =>
  RECRUITER_PLAN_OPTIONS.find((plan) => plan.code === normalizeRecruiterPlanCode(planCode)) ||
  RECRUITER_PLAN_OPTIONS[0];

/**
 * Merge stored recruiter profile data with normalized plan metadata and credits.
 */
export const mergeRecruiterPlanData = (profile = {}) => {
  const planConfig = getRecruiterPlanConfig(profile.plan_code);

  return {
    ...profile,
    plan_code: planConfig.code,
    kn_credit: Math.max(0, Number(profile.kn_credit || 0)),
    plan: planConfig,
  };
};

/**
 * Build the short document-visibility summary shown in recruiter package UI.
 */
export const formatRecruiterPlanDocuments = (planCode) => {
  const plan = getRecruiterPlanConfig(planCode);

  return `${plan.visible_resume_files} CV terlihat • ${plan.visible_certificate_files} sertifikat terlihat`;
};
