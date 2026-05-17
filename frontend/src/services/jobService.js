import apiClient from '../utils/apiClient';
import mockJobs from '../data/mockJobs';
import { shouldUseMockData } from '../utils/mockMode';

const MOCK_JOBS_STORAGE_KEY = 'mock_jobs';
const MOCK_USERS_STORAGE_KEY = 'mock_auth_users';

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

    return matchesSearch && matchesLocation && matchesJobType && matchesExperience;
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
      const newJob = {
        id: getNextJobId(jobs),
        recruiter_id: currentUser?.id || 1,
        recruiter: { name: currentUser?.company_name || currentUser?.name || 'Recruiter Demo' },
        title: data.title,
        workflow_status: data.workflow_status || (data.status === 'active' ? 'active' : 'draft'),
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
        status: data.status || 'active',
        applications_count: 0,
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

        updatedJob = {
          ...job,
          ...data,
          workflow_status:
            data.workflow_status ||
            job.workflow_status ||
            (data.status === 'active' ? 'active' : 'draft'),
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
