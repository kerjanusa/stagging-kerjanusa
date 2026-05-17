import apiClient from '../utils/apiClient';
import mockJobs from '../data/mockJobs.js';
import { shouldUseMockData } from '../utils/mockMode';

const MOCK_APPLICATIONS_STORAGE_KEY = 'mock_job_applications';
const MOCK_JOBS_STORAGE_KEY = 'mock_jobs';
const MOCK_USERS_STORAGE_KEY = 'mock_auth_users';
const DEFAULT_MOCK_APPLICATIONS = [
  {
    id: 1,
    job_id: 8,
    candidate_id: 2,
    status: 'pending',
    stage: 'applied',
    cover_letter:
      'Saya siap bekerja shift dan sudah terbiasa menangani pelanggan secara langsung maupun melalui chat.',
    applied_at: '2026-05-06T09:15:00.000Z',
  },
  {
    id: 2,
    job_id: 4,
    candidate_id: 2,
    status: 'accepted',
    stage: 'hired',
    cover_letter:
      'Saya tertarik pada peran administrasi operasional dan terbiasa bekerja rapi dengan dokumen harian.',
    applied_at: '2026-05-03T04:45:00.000Z',
  },
  {
    id: 3,
    job_id: 12,
    candidate_id: 2,
    status: 'rejected',
    stage: 'rejected',
    cover_letter:
      'Saya ingin mengembangkan pengalaman pembuatan konten pendek untuk promosi dan employer branding.',
    applied_at: '2026-04-28T08:10:00.000Z',
  },
];

/**
 * Keep application lists ordered by the newest submission timestamp first.
 */
const sortApplicationsByAppliedAt = (applications) =>
  [...applications].sort(
    (firstApplication, secondApplication) =>
      new Date(secondApplication.applied_at || secondApplication.created_at || 0).getTime() -
      new Date(firstApplication.applied_at || firstApplication.created_at || 0).getTime()
  );

/**
 * Load the current mock job catalog used to enrich demo applications.
 */
const getStoredMockJobs = () => {
  const storedJobs = localStorage.getItem(MOCK_JOBS_STORAGE_KEY);

  if (!storedJobs) {
    return mockJobs;
  }

  try {
    const parsedJobs = JSON.parse(storedJobs);
    return Array.isArray(parsedJobs) ? parsedJobs : mockJobs;
  } catch {
    return mockJobs;
  }
};

/**
 * Load mock users so candidate and recruiter details can be attached to applications.
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
 * Expand a raw demo application into the richer payload shape used by the UI.
 */
const enrichMockApplication = (application) => {
  const jobs = getStoredMockJobs();
  const users = getStoredMockUsers();
  const currentUser = getCurrentMockUser();
  const job = jobs.find((item) => Number(item.id) === Number(application.job_id)) || null;
  const candidate =
    users.find((item) => Number(item.id) === Number(application.candidate_id)) ||
    (Number(currentUser?.id) === Number(application.candidate_id) ? currentUser : null);

  return {
    ...application,
    job,
    candidate,
    screening_answers: sanitizeScreeningAnswers(application.screening_answers || []),
    screening_summary:
      application.screening_summary || buildScreeningSummary(application, job),
    video_intro_url: application.video_intro_url || '',
  };
};

/**
 * Load stored demo applications or seed the default set on first use.
 */
const getStoredMockApplications = () => {
  const storedApplications = localStorage.getItem(MOCK_APPLICATIONS_STORAGE_KEY);

  if (!storedApplications) {
    localStorage.setItem(MOCK_APPLICATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_APPLICATIONS));
    return DEFAULT_MOCK_APPLICATIONS;
  }

  try {
    const parsedApplications = JSON.parse(storedApplications);
    return Array.isArray(parsedApplications) ? parsedApplications : [];
  } catch (error) {
    return [];
  }
};

/**
 * Persist the demo application list to browser storage.
 */
const saveMockApplications = (applications) => {
  localStorage.setItem(MOCK_APPLICATIONS_STORAGE_KEY, JSON.stringify(applications));
};

/**
 * Load the currently authenticated demo user from browser storage.
 */
const getCurrentMockUser = () => {
  const storedUser = localStorage.getItem('user');
  return storedUser ? JSON.parse(storedUser) : null;
};

/**
 * Normalize screening answers so the frontend only keeps complete question-answer pairs.
 */
const sanitizeScreeningAnswers = (answers = []) =>
  (Array.isArray(answers) ? answers : [])
    .map((answer) => ({
      question_id: answer?.question_id || null,
      question: String(answer?.question || '').trim(),
      answer: String(answer?.answer || '').trim(),
    }))
    .filter((answer) => answer.question && answer.answer);

/**
 * Build the screening summary block expected by recruiter and candidate views.
 */
const buildScreeningSummary = (application, job) => {
  const questions = Array.isArray(job?.quiz_screening_questions) ? job.quiz_screening_questions : [];
  const screeningAnswers = sanitizeScreeningAnswers(application?.screening_answers || []);
  const positiveAnswers = screeningAnswers.filter(
    (answer) => answer.answer.toLowerCase() === 'ya'
  ).length;

  return {
    total_questions: questions.length,
    answered_questions: screeningAnswers.length,
    positive_answers: positiveAnswers,
    completion_rate: questions.length
      ? Math.round((screeningAnswers.length / questions.length) * 100)
      : 0,
  };
};

class ApplicationService {
  /**
   * Apply for job
   */
  static async applyForJob(jobId, coverLetter = '', screeningAnswers = [], videoIntroUrl = '') {
    if (shouldUseMockData) {
      const currentUser = getCurrentMockUser();

      if (!currentUser) {
        throw { message: 'Anda perlu login sebagai kandidat terlebih dahulu.' };
      }

      if (currentUser.role !== 'candidate') {
        throw { message: 'Hanya akun kandidat yang dapat melamar lowongan.' };
      }

      const applications = getStoredMockApplications();
      const job = getStoredMockJobs().find((item) => Number(item.id) === Number(jobId));

      if (!job || job.status === 'inactive') {
        throw { message: 'Lowongan ini tidak tersedia untuk dilamar.' };
      }

      const jobQuestions = Array.isArray(job.quiz_screening_questions)
        ? job.quiz_screening_questions
        : [];
      const normalizedScreeningAnswers = sanitizeScreeningAnswers(screeningAnswers);
      const answersByQuestionId = Object.fromEntries(
        normalizedScreeningAnswers.map((answer) => [answer.question_id, answer])
      );
      const missingQuestions = jobQuestions
        .filter((question) => (question.required ?? true) !== false)
        .filter((question) => !answersByQuestionId[question.id]?.answer);

      if (missingQuestions.length > 0) {
        throw {
          message: `Jawaban screening wajib diisi untuk: ${missingQuestions
            .map((question) => question.title || question.question)
            .join(', ')}.`,
        };
      }

      if (
        job.video_screening_requirement === 'required' &&
        !String(videoIntroUrl || '').trim()
      ) {
        throw { message: 'Link video screening wajib diisi untuk lowongan ini.' };
      }

      const alreadyApplied = applications.some(
        (application) =>
          Number(application.job_id) === Number(jobId) &&
          Number(application.candidate_id) === Number(currentUser.id)
      );

      if (alreadyApplied) {
        throw { message: 'Anda sudah pernah melamar lowongan ini.' };
      }

      const nextApplication = {
        id: applications.reduce((largestId, application) => Math.max(largestId, application.id), 0) + 1,
        job_id: Number(jobId),
        candidate_id: Number(currentUser.id),
        status: 'pending',
        stage: 'applied',
        cover_letter: coverLetter,
        screening_answers: normalizedScreeningAnswers,
        screening_summary: buildScreeningSummary(
          {
            screening_answers: normalizedScreeningAnswers,
          },
          job
        ),
        video_intro_url: String(videoIntroUrl || '').trim(),
        applied_at: new Date().toISOString(),
      };

      saveMockApplications([...applications, nextApplication]);

      return {
        message: 'Lamaran demo berhasil dikirim.',
        data: enrichMockApplication(nextApplication),
      };
    }

    try {
      const response = await apiClient.post('/apply', {
        job_id: jobId,
        cover_letter: coverLetter,
        screening_answers: sanitizeScreeningAnswers(screeningAnswers),
        video_intro_url: String(videoIntroUrl || '').trim() || null,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get my applications (as candidate)
   */
  static async getMyApplications(page = 1, perPage = 15) {
    if (shouldUseMockData) {
      const currentUser = getCurrentMockUser();
      const applications = sortApplicationsByAppliedAt(
        getStoredMockApplications().filter(
        (application) => Number(application.candidate_id) === Number(currentUser?.id)
        )
      ).map(enrichMockApplication);

      return {
        data: applications,
        pagination: {
          total: applications.length,
          per_page: perPage,
          current_page: page,
          last_page: 1,
        },
      };
    }

    try {
      const params = new URLSearchParams({ page, per_page: perPage });
      const response = await apiClient.get(`/my-applications?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get applications for job (as recruiter)
   */
  static async getJobApplications(jobId, page = 1, perPage = 15) {
    if (shouldUseMockData) {
      const applications = sortApplicationsByAppliedAt(
        getStoredMockApplications().filter(
        (application) => Number(application.job_id) === Number(jobId)
        )
      ).map(enrichMockApplication);

      return {
        data: applications,
        pagination: {
          total: applications.length,
          per_page: perPage,
          current_page: page,
          last_page: 1,
        },
      };
    }

    try {
      const params = new URLSearchParams({ page, per_page: perPage });
      const response = await apiClient.get(`/jobs/${jobId}/applications?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(applicationId, status, stage = null) {
    if (shouldUseMockData) {
      let updatedApplication = null;
      const applications = getStoredMockApplications().map((application) => {
        if (Number(application.id) !== Number(applicationId)) {
          return application;
        }

        updatedApplication = {
          ...application,
          status,
          stage: stage || application.stage || application.status,
        };

        return updatedApplication;
      });

      if (!updatedApplication) {
        throw { message: 'Lamaran demo tidak ditemukan.' };
      }

      saveMockApplications(applications);

      return {
        message: 'Status lamaran demo berhasil diperbarui.',
        data: enrichMockApplication(updatedApplication),
      };
    }

    try {
      const response = await apiClient.put(`/applications/${applicationId}/status`, {
        status,
        stage,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Withdraw my own application (as candidate)
   */
  static async withdrawApplication(applicationId) {
    if (shouldUseMockData) {
      const currentUser = getCurrentMockUser();
      let updatedApplication = null;

      const applications = getStoredMockApplications().map((application) => {
        if (
          Number(application.id) !== Number(applicationId) ||
          Number(application.candidate_id) !== Number(currentUser?.id)
        ) {
          return application;
        }

        updatedApplication = {
          ...application,
          status: 'withdrawn',
          stage: 'withdrawn',
        };

        return updatedApplication;
      });

      if (!updatedApplication) {
        throw { message: 'Lamaran demo tidak dapat dibatalkan.' };
      }

      saveMockApplications(applications);

      return {
        message: 'Lamaran demo berhasil dibatalkan.',
        data: enrichMockApplication(updatedApplication),
      };
    }

    try {
      const response = await apiClient.put(`/applications/${applicationId}/withdraw`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Get application detail
   */
  static async getApplicationById(applicationId) {
    if (shouldUseMockData) {
      const application = getStoredMockApplications().find(
        (item) => Number(item.id) === Number(applicationId)
      );

      if (!application) {
        throw { message: 'Lamaran demo tidak ditemukan.' };
      }

      return enrichMockApplication(application);
    }

    try {
      const response = await apiClient.get(`/applications/${applicationId}`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default ApplicationService;
