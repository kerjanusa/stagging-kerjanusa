import apiClient from '../utils/apiClient.js';
import { shouldUseMockData } from '../utils/mockMode.js';
import {
  getRecruiterPlanConfig,
  mergeRecruiterPlanData,
  normalizeRecruiterPlanCode,
  RECRUITER_PLAN_OPTIONS,
} from '../utils/recruiterPlans.js';

const MOCK_USERS_STORAGE_KEY = 'mock_auth_users';
const MOCK_APPLICATIONS_STORAGE_KEY = 'mock_job_applications';

/**
 * Read and parse JSON from local storage while falling back safely on invalid data.
 */
const readStoredJson = (storageKey, fallbackValue) => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

/**
 * Load the current recruiter session from browser storage for demo flows.
 */
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

/**
 * Load mock users used by recruiter workspace demo features.
 */
const getMockUsers = () => readStoredJson(MOCK_USERS_STORAGE_KEY, []);

/**
 * Persist the updated mock user list after recruiter package changes.
 */
const saveMockUsers = (users) => {
  localStorage.setItem(MOCK_USERS_STORAGE_KEY, JSON.stringify(users));
};

/**
 * Load mock applications used to compute candidate activity metrics.
 */
const getMockApplications = () => readStoredJson(MOCK_APPLICATIONS_STORAGE_KEY, []);

/**
 * Package a recruiter workspace collection into the same pagination shape as the backend.
 */
const paginateItems = (items, page = 1, perPage = 12) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const itemsPerPage = Math.max(1, Number(perPage) || 12);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const total = items.length;

  return {
    data: items.slice(startIndex, startIndex + itemsPerPage),
    pagination: {
      total,
      per_page: itemsPerPage,
      current_page: currentPage,
      last_page: Math.max(1, Math.ceil(total / itemsPerPage)),
    },
  };
};

/**
 * Derive a simple candidate grade from readiness and skill depth in demo mode.
 */
const resolveMockCandidateGrade = (candidate) => {
  if ((candidate.profile_readiness_percent || 0) >= 90 && (candidate.skills?.length || 0) >= 3) {
    return 'A';
  }

  if ((candidate.profile_readiness_percent || 0) >= 70) {
    return 'B';
  }

  return 'C';
};

/**
 * Build the mock talent-search candidate list with package-aware document visibility.
 */
const buildMockTalentCandidates = (recruiter) => {
  const recruiterPlan = mergeRecruiterPlanData(recruiter?.recruiter_profile || {});
  const planConfig = recruiterPlan.plan;
  const applications = getMockApplications();

  return getMockUsers()
    .filter((user) => user.role === 'candidate' && user.account_status !== 'suspended')
    .map((candidate) => {
      const profile = candidate.candidate_profile || {};
      const preferredRoles = (profile.preferredRoles || []).filter(Boolean);
      const preferredLocations = (profile.preferredLocations || []).filter(Boolean);
      const skills = (profile.skills || []).filter(Boolean);
      const resumeFiles = (profile.resumeFiles || []).slice(0, planConfig.visible_resume_files);
      const certificateFiles = (profile.certificateFiles || []).slice(
        0,
        planConfig.visible_certificate_files
      );
      const readinessItems = [
        Boolean(profile.currentAddress),
        Boolean(profile.profileSummary),
        preferredRoles.length > 0,
        preferredLocations.length > 0,
        skills.length > 0,
        (profile.resumeFiles || []).length > 0,
      ];
      const profileReadinessPercent = Math.round(
        (readinessItems.filter(Boolean).length / readinessItems.length) * 100
      );
      const candidateApplications = applications.filter(
        (application) => Number(application.candidate_id) === Number(candidate.id)
      );

      const result = {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        profile_summary: profile.profileSummary || '',
        preferred_roles: preferredRoles,
        preferred_locations: preferredLocations,
        skills,
        experience_type:
          (profile.experiences || []).filter((item) => item?.company || item?.position).length > 0
            ? 'experienced'
            : 'fresh-graduate',
        experience_entries_count: (profile.experiences || []).filter(
          (item) => item?.company || item?.position
        ).length,
        applications_count: candidateApplications.length,
        profile_readiness_percent: profileReadinessPercent,
        resume_files: resumeFiles,
        certificate_files: certificateFiles,
        document_access: {
          resume_files_visible: resumeFiles.length,
          resume_files_total: (profile.resumeFiles || []).length,
          certificate_files_visible: certificateFiles.length,
          certificate_files_total: (profile.certificateFiles || []).length,
          upgrade_required:
            resumeFiles.length < (profile.resumeFiles || []).length ||
            certificateFiles.length < (profile.certificateFiles || []).length,
        },
      };

      return {
        ...result,
        grade: resolveMockCandidateGrade(result),
      };
    });
};

class RecruiterWorkspaceService {
  /**
   * Return the current recruiter package and the full selectable catalog.
   */
  static async getPackageOverview() {
    if (shouldUseMockData) {
      const currentUser = getCurrentUser();
      const current = mergeRecruiterPlanData(currentUser?.recruiter_profile || {});

      return {
        current: {
          ...current.plan,
          kn_credit: current.kn_credit,
        },
        catalog: RECRUITER_PLAN_OPTIONS,
      };
    }

    try {
      const response = await apiClient.get('/recruiter/package');
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Persist a recruiter package change and return the refreshed overview payload.
   */
  static async updatePackage(planCode) {
    const normalizedPlanCode = normalizeRecruiterPlanCode(planCode);

    if (shouldUseMockData) {
      const currentUser = getCurrentUser();

      if (!currentUser) {
        throw { message: 'Recruiter belum login.' };
      }

      const nextRecruiterProfile = mergeRecruiterPlanData({
        ...(currentUser.recruiter_profile || {}),
        plan_code: normalizedPlanCode,
      });

      const nextUser = {
        ...currentUser,
        recruiter_profile: {
          ...nextRecruiterProfile,
          plan: undefined,
        },
      };

      const users = getMockUsers().map((user) =>
        Number(user.id) === Number(currentUser.id) ? nextUser : user
      );

      saveMockUsers(users);
      localStorage.setItem('user', JSON.stringify(nextUser));

      return {
        current: {
          ...getRecruiterPlanConfig(normalizedPlanCode),
          kn_credit: nextRecruiterProfile.kn_credit,
        },
        catalog: RECRUITER_PLAN_OPTIONS,
        user: nextUser,
      };
    }

    try {
      const response = await apiClient.put('/recruiter/package', {
        plan_code: normalizedPlanCode,
      });
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Search visible candidates using recruiter filters and plan-limited result caps.
   */
  static async searchTalent(filters = {}, page = 1, perPage = 12) {
    if (shouldUseMockData) {
      const currentUser = getCurrentUser();
      const plan = getRecruiterPlanConfig(currentUser?.recruiter_profile?.plan_code);
      const normalizedQuery = String(filters.query || '').trim().toLowerCase();
      const normalizedLocation = String(filters.location || '').trim().toLowerCase();
      const normalizedSkill = String(filters.skill || '').trim().toLowerCase();
      const normalizedGrade = String(filters.grade || '').trim().toUpperCase();
      const normalizedExperienceType = String(filters.experience_type || '').trim().toLowerCase();

      const candidates = buildMockTalentCandidates(currentUser)
        .filter((candidate) => {
          const haystack = [
            candidate.name,
            candidate.profile_summary,
            ...(candidate.preferred_roles || []),
            ...(candidate.preferred_locations || []),
            ...(candidate.skills || []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
          const matchesLocation =
            !normalizedLocation ||
            (candidate.preferred_locations || []).some((location) =>
              String(location).toLowerCase().includes(normalizedLocation)
            );
          const matchesSkill =
            !normalizedSkill ||
            (candidate.skills || []).some((skill) =>
              String(skill).toLowerCase().includes(normalizedSkill)
            );
          const matchesGrade = !normalizedGrade || candidate.grade === normalizedGrade;
          const matchesExperienceType =
            !normalizedExperienceType || candidate.experience_type === normalizedExperienceType;

          return (
            matchesQuery &&
            matchesLocation &&
            matchesSkill &&
            matchesGrade &&
            matchesExperienceType
          );
        })
        .slice(0, plan.talent_result_limit);

      return paginateItems(candidates, page, perPage);
    }

    try {
      const params = new URLSearchParams({
        page,
        per_page: perPage,
        ...(filters.query ? { query: filters.query } : {}),
        ...(filters.location ? { location: filters.location } : {}),
        ...(filters.skill ? { skill: filters.skill } : {}),
        ...(filters.grade ? { grade: filters.grade } : {}),
        ...(filters.experience_type ? { experience_type: filters.experience_type } : {}),
      });
      const response = await apiClient.get(`/recruiter/talent-search?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default RecruiterWorkspaceService;
