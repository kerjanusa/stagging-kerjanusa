import apiClient from '../utils/apiClient';
import mockJobs from '../data/mockJobs';
import { shouldUseMockData } from '../utils/mockMode';

const MOCK_JOBS_STORAGE_KEY = 'mock_jobs';
const MOCK_USERS_STORAGE_KEY = 'mock_auth_users';

/**
 * Build a stable ISO timestamp for mock job mutations.
 */
const buildTimestamp = () => new Date().toISOString();

/**
 * Give recruiter job cards simple view metrics when demo data does not provide them yet.
 */
const resolveMockJobViewCount = (job) =>
  Math.max(
    Number(job.views_count) || 0,
    (Number(job.applications_count) || 0) * 9 + Number(job.id || 0) * 7
  );

/**
 * Normalize free-text filters and searchable fields to one lowercase comparison format.
 */
const normalizeText = (value = '') => String(value).trim().toLowerCase();

/**
 * Backfill missing mock-job fields so demo data matches the current backend contract.
 */
const normalizeMockJob = (job) => ({
  ...job,
  workflow_status: job.workflow_status || (job.status === 'active' ? 'active' : 'draft'),
  work_mode: job.work_mode || 'wfo',
  openings_count: Number(job.openings_count) || 0,
  interview_type: job.interview_type || 'onsite',
  interview_note: job.interview_note || '',
  video_screening_requirement: job.video_screening_requirement || 'optional',
  quiz_screening_questions: Array.isArray(job.quiz_screening_questions)
    ? job.quiz_screening_questions
    : [],
  shift_night: job.shift_night || 'no',
  expiry_date: job.expiry_date || '',
  candidate_gender: job.candidate_gender || '',
  candidate_experience: job.candidate_experience || '',
  candidate_education: job.candidate_education || '',
  candidate_age_min: job.candidate_age_min || '',
  candidate_age_max: job.candidate_age_max || '',
  candidate_no_age_limit: Boolean(job.candidate_no_age_limit),
  candidate_photo_requirement: job.candidate_photo_requirement || '',
  candidate_domicile: job.candidate_domicile || '',
  candidate_skills: Array.isArray(job.candidate_skills) ? job.candidate_skills : [],
  candidate_custom_skill: job.candidate_custom_skill || '',
  internal_recruiter_link: job.internal_recruiter_link || '',
  created_at: job.created_at || new Date().toISOString(),
  updated_at: job.updated_at || job.created_at || new Date().toISOString(),
  published_at:
    job.published_at ||
    ((job.workflow_status || job.status) === 'active' ? job.updated_at || job.created_at : ''),
  review_requested_at:
    job.review_requested_at ||
    (job.workflow_status === 'review' ? job.updated_at || job.created_at : ''),
  rejected_at:
    job.rejected_at ||
    (job.workflow_status === 'rejected' ? job.updated_at || job.created_at : ''),
  closed_at:
    job.closed_at || (job.workflow_status === 'closed' ? job.updated_at || job.created_at : ''),
  workflow_note: job.workflow_note || '',
  boost_count: Number(job.boost_count) || 0,
  duplicate_source_job_id: job.duplicate_source_job_id || null,
  views_count: resolveMockJobViewCount(job),
});

/**
 * Load stored mock users so job payloads can be hydrated with recruiter information.
 */
const getStoredMockUsers = () => {
  const storedUsers = localStorage.getItem(MOCK_USERS_STORAGE_KEY);

  if (!storedUsers) {
    return [];
  }

  try {
    const parsedUsers = JSON.parse(storedUsers);
    return Array.isArray(parsedUsers) ? parsedUsers : [];
  } catch {
    return [];
  }
};

/**
 * Attach recruiter metadata to a mock job using the stored demo user list.
 */
const hydrateMockRecruiter = (job, users = []) => {
  const recruiterUser = users.find((user) => Number(user.id) === Number(job.recruiter_id));
  const recruiterName =
    recruiterUser?.company_name?.trim() || recruiterUser?.name || job.recruiter?.name || 'Recruiter Demo';

  return {
    ...job,
    recruiter: {
      ...(job.recruiter || {}),
      id: recruiterUser?.id || job.recruiter?.id || job.recruiter_id,
      name: recruiterName,
      role: recruiterUser?.role || 'recruiter',
      email: recruiterUser?.email || job.recruiter?.email || '',
      company_name: recruiterUser?.company_name || recruiterName,
    },
  };
};

/**
 * Load mock jobs from storage or seed them from static demo data on first use.
 */
const getStoredMockJobs = () => {
  const users = getStoredMockUsers();
  const storedJobs = localStorage.getItem(MOCK_JOBS_STORAGE_KEY);

  if (storedJobs) {
    try {
      const parsedJobs = JSON.parse(storedJobs);
      if (Array.isArray(parsedJobs)) {
        return parsedJobs.map((job) => hydrateMockRecruiter(normalizeMockJob(job), users));
      }
    } catch (error) {
      // Fall back to the seeded mock jobs.
    }
  }

  localStorage.setItem(
    MOCK_JOBS_STORAGE_KEY,
    JSON.stringify(mockJobs.map((job) => hydrateMockRecruiter(normalizeMockJob(job), users)))
  );
  return mockJobs.map((job) => hydrateMockRecruiter(normalizeMockJob(job), users));
};

/**
 * Persist the current mock job list to local storage.
 */
const saveMockJobs = (jobs) => {
  localStorage.setItem(MOCK_JOBS_STORAGE_KEY, JSON.stringify(jobs));
};

/**
 * Apply the public job-search filters used by the frontend demo experience.
 */
const filterMockJobs = (jobs, filters = {}) => {
  const searchTerm = normalizeText(filters.search);
  const locationTerm = normalizeText(filters.location);
  const jobTypeTerm = normalizeText(filters.job_type);
  const experienceLevelTerm = normalizeText(filters.experience_level);
  const companyTerm = normalizeText(filters.company_name);
  const minimumSalary = Number(filters.salary_minimum || 0);

  return jobs.filter((job) => {
    if (normalizeText(job.status) !== 'active') {
      return false;
    }

    const matchesSearch =
      !searchTerm ||
      [
        job.title,
        job.description,
        job.category,
        job.location,
        job.recruiter?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchTerm);

    const normalizedLocation = normalizeText(job.location);
    const matchesLocation =
      !locationTerm ||
      normalizedLocation === locationTerm ||
      normalizedLocation.includes(locationTerm) ||
      locationTerm.includes(normalizedLocation);

    const matchesJobType = !jobTypeTerm || normalizeText(job.job_type) === jobTypeTerm;
    const matchesExperience =
      !experienceLevelTerm || normalizeText(job.experience_level) === experienceLevelTerm;
    const matchesCompany =
      !companyTerm ||
      normalizeText(job.recruiter?.company_name || job.recruiter?.name).includes(companyTerm);
    const matchesSalary =
      !minimumSalary || Number(job.salary_max || job.salary_min || 0) >= minimumSalary;

    return (
      matchesSearch &&
      matchesLocation &&
      matchesJobType &&
      matchesExperience &&
      matchesCompany &&
      matchesSalary
    );
  });
};

/**
 * Package a mock job list into the same pagination shape returned by the backend.
 */
const paginateMockJobs = (jobs, page = 1, perPage = 15) => {
  const total = jobs.length;
  const currentPage = Math.max(1, Number(page) || 1);
  const itemsPerPage = Math.max(1, Number(perPage) || 15);
  const lastPage = Math.max(1, Math.ceil(total / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  return {
    data: jobs.slice(startIndex, startIndex + itemsPerPage),
    pagination: {
      current_page: currentPage,
      last_page: lastPage,
      per_page: itemsPerPage,
      total,
    },
  };
};

/**
 * Compute the next integer identifier for a new demo job.
 */
const getNextJobId = (jobs) => jobs.reduce((largestId, job) => Math.max(largestId, job.id), 0) + 1;

/**
 * Load the current demo user from browser session storage.
 */
const getCurrentMockUser = () => {
  const storedUser = localStorage.getItem('user');
  return storedUser ? JSON.parse(storedUser) : null;
};

class JobService {
  /**
   * Get all jobs with filters
   */
  static async getJobs(filters = {}, page = 1, perPage = 15) {
    if (shouldUseMockData) {
      const filteredJobs = filterMockJobs(getStoredMockJobs(), filters);
      return paginateMockJobs(filteredJobs, page, perPage);
    }

    try {
      const params = new URLSearchParams({
        page,
        per_page: perPage,
        ...filters,
      });

      const response = await apiClient.get(`/jobs?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Mengambil lokasi unik dari lowongan aktif untuk mengisi dropdown yang akurat.
   */
  static async getAvailableLocations() {
    if (shouldUseMockData) {
      return [
        ...new Set(
          getStoredMockJobs()
            .filter((job) => normalizeText(job.status) === 'active')
            .map((job) => job.location)
            .filter(Boolean)
        ),
      ].sort();
    }

    try {
      const response = await apiClient.get('/job-locations');
      return response.data.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get job by ID
   */
  static async getJobById(jobId) {
    if (shouldUseMockData) {
      const job = getStoredMockJobs().find((item) => item.id === Number(jobId));
      if (!job) {
        throw { message: 'Lowongan demo tidak ditemukan.' };
      }
      return job;
    }

    try {
      const response = await apiClient.get(`/jobs/${jobId}`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Create job
   */
  static async createJob(data) {
    if (shouldUseMockData) {
      const currentUser = getCurrentMockUser();
      const jobs = getStoredMockJobs();
      const createdAt = buildTimestamp();
      const workflowStatus =
        data.workflow_status || (data.status === 'active' ? 'active' : 'draft');
      const newJob = {
        id: getNextJobId(jobs),
        recruiter_id: currentUser?.id || 1,
        recruiter: { name: currentUser?.company_name || currentUser?.name || 'Recruiter Demo' },
        title: data.title,
        workflow_status: workflowStatus,
        description: data.description,
        category: data.category,
        salary_min: Number(data.salary_min) || 0,
        salary_max: Number(data.salary_max) || 0,
        location: data.location,
        job_type: data.job_type || 'full-time',
        experience_level: data.experience_level || 'entry',
        work_mode: data.work_mode || 'wfo',
        openings_count: Number(data.openings_count) || 0,
        interview_type: data.interview_type || 'onsite',
        interview_note: data.interview_note || '',
        video_screening_requirement: data.video_screening_requirement || 'optional',
        quiz_screening_questions: Array.isArray(data.quiz_screening_questions)
          ? data.quiz_screening_questions
          : [],
        shift_night: data.shift_night || 'no',
        expiry_date: data.expiry_date || '',
        candidate_gender: data.candidate_gender || '',
        candidate_experience: data.candidate_experience || '',
        candidate_education: data.candidate_education || '',
        candidate_age_min: data.candidate_age_min || '',
        candidate_age_max: data.candidate_age_max || '',
        candidate_no_age_limit: Boolean(data.candidate_no_age_limit),
        candidate_photo_requirement: data.candidate_photo_requirement || '',
        candidate_domicile: data.candidate_domicile || '',
        candidate_skills: Array.isArray(data.candidate_skills) ? data.candidate_skills : [],
        candidate_custom_skill: data.candidate_custom_skill || '',
        internal_recruiter_link: data.internal_recruiter_link || '',
        workflow_note: data.workflow_note || '',
        status: data.status || (workflowStatus === 'active' ? 'active' : 'inactive'),
        applications_count: 0,
        views_count: 0,
        boost_count: 0,
        created_at: createdAt,
        updated_at: createdAt,
        published_at: workflowStatus === 'active' ? createdAt : '',
        review_requested_at: workflowStatus === 'review' ? createdAt : '',
        rejected_at: workflowStatus === 'rejected' ? createdAt : '',
        closed_at: workflowStatus === 'closed' ? createdAt : '',
        duplicate_source_job_id: data.duplicate_source_job_id || null,
      };

      saveMockJobs([...jobs, newJob]);
      return {
        message: 'Lowongan demo berhasil dibuat.',
        data: newJob,
      };
    }

    try {
      const response = await apiClient.post('/jobs', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Update job
   */
  static async updateJob(jobId, data) {
    if (shouldUseMockData) {
      let updatedJob = null;
      const jobs = getStoredMockJobs().map((job) => {
        if (job.id !== Number(jobId)) {
          return job;
        }

        const nextWorkflowStatus =
          data.workflow_status ||
          job.workflow_status ||
          (data.status === 'active' ? 'active' : 'draft');
        const updatedAt = buildTimestamp();
        updatedJob = {
          ...job,
          ...data,
          workflow_status: nextWorkflowStatus,
          status: data.status || (nextWorkflowStatus === 'active' ? 'active' : 'inactive'),
          updated_at: updatedAt,
          published_at:
            nextWorkflowStatus === 'active' ? job.published_at || updatedAt : job.published_at || '',
          review_requested_at:
            nextWorkflowStatus === 'review'
              ? data.review_requested_at || job.review_requested_at || updatedAt
              : job.review_requested_at || '',
          rejected_at:
            nextWorkflowStatus === 'rejected'
              ? data.rejected_at || job.rejected_at || updatedAt
              : job.rejected_at || '',
          closed_at:
            nextWorkflowStatus === 'closed'
              ? data.closed_at || job.closed_at || updatedAt
              : job.closed_at || '',
        };
        return updatedJob;
      });

      if (!updatedJob) {
        throw { message: 'Lowongan demo tidak ditemukan.' };
      }

      saveMockJobs(jobs);
      return {
        message: 'Lowongan demo berhasil diperbarui.',
        data: updatedJob,
      };
    }

    try {
      const response = await apiClient.put(`/jobs/${jobId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Delete job
   */
  static async deleteJob(jobId) {
    if (shouldUseMockData) {
      const jobs = getStoredMockJobs();
      const remainingJobs = jobs.filter((job) => job.id !== Number(jobId));

      if (remainingJobs.length === jobs.length) {
        throw { message: 'Lowongan demo tidak ditemukan.' };
      }

      saveMockJobs(remainingJobs);
      return { message: 'Lowongan demo berhasil dihapus.' };
    }

    try {
      const response = await apiClient.delete(`/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get my jobs (recruitment)
   */
  static async getMyJobs(page = 1, perPage = 15) {
    if (shouldUseMockData) {
      const currentUser = getCurrentMockUser();
      const jobs = getStoredMockJobs().filter(
        (job) => !currentUser || job.recruiter_id === currentUser.id
      );

      return paginateMockJobs(jobs, page, perPage);
    }

    try {
      const params = new URLSearchParams({ page, per_page: perPage });
      const response = await apiClient.get(`/my-jobs?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get job statistics
   */
  static async getJobStatistics(jobId) {
    if (shouldUseMockData) {
      const job = await this.getJobById(jobId);
      return {
        applications_count: job.applications_count || 0,
        shortlisted_count: Math.min(job.applications_count || 0, 3),
        rejected_count: Math.max((job.applications_count || 0) - 3, 0),
      };
    }

    try {
      const response = await apiClient.get(`/jobs/${jobId}/statistics`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default JobService;
