const SAVED_JOBS_STORAGE_PREFIX = 'candidate_saved_jobs';
const JOB_ACTIVE_WINDOW_IN_DAYS = 30;
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Membuat storage key bookmark lowongan per akun kandidat atau sesi guest.
 */
export const getSavedJobsStorageKey = (userId) =>
  `${SAVED_JOBS_STORAGE_PREFIX}:${userId || 'guest'}`;

/**
 * Membaca daftar lowongan yang disimpan kandidat dari localStorage.
 */
export const readSavedJobIds = (userId) => {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const storedValue = JSON.parse(localStorage.getItem(getSavedJobsStorageKey(userId)) || '[]');
    return new Set(Array.isArray(storedValue) ? storedValue.map((item) => Number(item)) : []);
  } catch {
    return new Set();
  }
};

/**
 * Menyimpan daftar bookmark lowongan kandidat ke localStorage.
 */
export const persistSavedJobIds = (userId, savedJobIds) => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(
    getSavedJobsStorageKey(userId),
    JSON.stringify(Array.from(savedJobIds).map((item) => Number(item)))
  );
};

/**
 * Mengambil tanggal batas lowongan dari data eksplisit atau fallback umur posting.
 */
export const resolveJobDeadline = (job) => {
  const explicitDeadline = job?.expires_at || job?.deadline_at;

  if (explicitDeadline) {
    const parsedExplicitDeadline = new Date(explicitDeadline);

    if (!Number.isNaN(parsedExplicitDeadline.getTime())) {
      return parsedExplicitDeadline;
    }
  }

  if (job?.created_at) {
    const createdAt = new Date(job.created_at);

    if (!Number.isNaN(createdAt.getTime())) {
      return new Date(createdAt.getTime() + JOB_ACTIVE_WINDOW_IN_DAYS * ONE_DAY_IN_MILLISECONDS);
    }
  }

  return null;
};

/**
 * Mengubah sisa waktu lowongan menjadi label singkat yang mudah dipahami kandidat.
 */
export const formatJobCountdownLabel = (job) => {
  const deadline = resolveJobDeadline(job);

  if (!deadline) {
    return '';
  }

  const remainingTime = deadline.getTime() - Date.now();

  if (remainingTime <= 0) {
    return 'Ditutup';
  }

  const remainingDays = Math.ceil(remainingTime / ONE_DAY_IN_MILLISECONDS);

  if (remainingDays <= 1) {
    return 'Tutup < 24 jam';
  }

  return `Tutup ${remainingDays} hari lagi`;
};

/**
 * Mengubah skor rekomendasi ringan menjadi label kecocokan kandidat.
 */
export const buildRecommendationMatchLabel = (score = 0) => {
  const numericScore = Number(score || 0);

  if (numericScore <= 0) {
    return '';
  }

  const percentage = Math.max(40, Math.min(95, 34 + numericScore * 8));
  return `${percentage}% cocok`;
};

/**
 * Memberi skor rekomendasi ringan supaya lowongan yang paling relevan bisa ditandai.
 */
export const scoreJobForCandidate = (job, candidateProfile) => {
  const normalizedTitle = String(job?.title || '').toLowerCase();
  const normalizedDescription = String(job?.description || '').toLowerCase();
  const normalizedLocation = String(job?.location || '').toLowerCase();
  const preferredRoles = (candidateProfile?.preferredRoles || [])
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
  const preferredLocations = (candidateProfile?.preferredLocations || [])
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
  const candidateSkills = (candidateProfile?.skills || [])
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);

  let score = 0;

  preferredRoles.forEach((role) => {
    if (normalizedTitle.includes(role)) {
      score += 4;
    } else if (normalizedDescription.includes(role)) {
      score += 2;
    }
  });

  preferredLocations.forEach((location) => {
    if (normalizedLocation.includes(location)) {
      score += 3;
    }
  });

  candidateSkills.forEach((skill) => {
    if (normalizedDescription.includes(skill)) {
      score += 1;
    }
  });

  return score;
};

/**
 * Menambah label kandidat-friendly pada lowongan tanpa menjadikannya recommendation-first.
 */
export const decorateCandidateJobs = (jobs, candidateProfile) =>
  [...(Array.isArray(jobs) ? jobs : [])]
    .map((job) => {
      const recommendationScore = scoreJobForCandidate(job, candidateProfile);

      return {
        ...job,
        recommendationScore,
        recommendationMatchLabel: buildRecommendationMatchLabel(recommendationScore),
        closingCountdownLabel: formatJobCountdownLabel(job),
        isRecommended: recommendationScore > 0,
      };
    })
    .sort((leftJob, rightJob) => {
      const rightCreatedAt = new Date(rightJob.created_at || 0).getTime();
      const leftCreatedAt = new Date(leftJob.created_at || 0).getTime();

      if (rightCreatedAt !== leftCreatedAt) {
        return rightCreatedAt - leftCreatedAt;
      }

      if (rightJob.recommendationScore !== leftJob.recommendationScore) {
        return rightJob.recommendationScore - leftJob.recommendationScore;
      }

      return Number(rightJob.id || 0) - Number(leftJob.id || 0);
    });
