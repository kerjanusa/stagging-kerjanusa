import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useApplications from '../hooks/useApplications.js';
import useAuth from '../hooks/useAuth.js';
import ApplicationService from '../services/applicationService.js';
import JobService from '../services/jobService.js';
import {
  clearCandidateApplyIntent,
  readCandidateApplyIntent,
  saveCandidateApplyIntent,
} from '../utils/candidateApplyIntent.js';
import {
  getCandidateProfileCompletion,
  readCandidateProfile,
} from '../utils/candidateFlow.js';
import {
  APP_ROUTES,
  getDefaultRouteForRole,
  getJobApplyRoute,
} from '../utils/routeHelpers.js';
import {
  formatExperienceLevel,
  formatJobType,
  formatWorkMode,
  formatVideoScreeningRequirement,
} from '../utils/jobFormatters.js';
import '../styles/jobList.css';

const SAVED_JOBS_STORAGE_PREFIX = 'candidate_saved_jobs';
const JOB_ACTIVE_WINDOW_IN_DAYS = 30;
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const JOB_APPLY_TOTAL_STEPS = 2;
const IDR_NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');
const RESUME_SKIP_OPTION = '__skip_resume__';

/**
 * Ambil maksimal beberapa entri string yang benar-benar terisi.
 */
const collectFilledStrings = (items = [], limit = 3) =>
  (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);

/**
 * Buat inisial badge perusahaan.
 */
const buildCompanyInitials = (value = '') =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('') || 'KN';

/**
 * Padatkan level pengalaman untuk label kecil.
 */
const formatExperienceChip = (value = '') => {
  const label = formatExperienceLevel(value);
  return label.replace(/\s*\(.*?\)\s*/g, '').trim() || label;
};

/**
 * Ubah angka rupiah ke format ringkas.
 */
const formatCompactSalaryValue = (value) => {
  const numericValue = Number(value || 0);

  if (!numericValue) {
    return '';
  }

  if (numericValue >= 1000000) {
    return `${(numericValue / 1000000).toFixed(1).replace('.', ',')}jt`;
  }

  return IDR_NUMBER_FORMATTER.format(numericValue);
};

/**
 * Format rentang gaji ke label yang mudah dipindai.
 */
const formatSalaryRangeLabel = (minimumSalary, maximumSalary, compact = false) => {
  const minimumValue = Number(minimumSalary || 0);
  const maximumValue = Number(maximumSalary || 0);
  const formatValue = compact
    ? formatCompactSalaryValue
    : (value) => `Rp ${IDR_NUMBER_FORMATTER.format(Number(value || 0))}`;

  if (minimumValue && maximumValue) {
    return compact
      ? `Rp ${formatValue(minimumValue)} - ${formatValue(maximumValue)}`
      : `${formatValue(minimumValue)} - ${formatValue(maximumValue)}`;
  }

  if (maximumValue) {
    return compact
      ? `Hingga Rp ${formatValue(maximumValue)}`
      : `Hingga ${formatValue(maximumValue)}`;
  }

  if (minimumValue) {
    return compact
      ? `Mulai Rp ${formatValue(minimumValue)}`
      : `Mulai ${formatValue(minimumValue)}`;
  }

  return compact ? 'Gaji negosiasi' : 'Gaji dirundingkan';
};

/**
 * Potong deskripsi panjang menjadi teaser.
 */
const buildDescriptionPreview = (value = '', limit = 180) => {
  const normalizedValue = String(value || '').trim().replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length <= limit) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, limit).trimEnd()}...`;
};

/**
 * Pecah deskripsi naratif menjadi beberapa kalimat yang layak jadi poin.
 */
const buildSentenceList = (value = '', limit = 4) =>
  String(value || '')
    .split(/[\n\r]+|[.!?]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);

/**
 * Ubah tautan YouTube menjadi URL embed jika formatnya valid.
 */
const toYouTubeEmbedUrl = (value = '') => {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  try {
    const parsedUrl = new URL(rawValue);
    const hostName = parsedUrl.hostname.replace(/^www\./, '');

    if (hostName === 'youtu.be') {
      const videoId = parsedUrl.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    }

    if (hostName === 'youtube.com' || hostName === 'm.youtube.com') {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathSegments[0] === 'embed' && pathSegments[1]) {
        return `https://www.youtube.com/embed/${pathSegments[1]}`;
      }
    }
  } catch {
    return '';
  }

  return '';
};

/**
 * Format tanggal publish ringan untuk layar detail kandidat.
 */
const formatJobStoryDate = (value) => {
  if (!value) {
    return 'Tersedia sekarang';
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return 'Tersedia sekarang';
  }

  return parsedValue.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Siapkan jawaban awal screening kosong dari data lowongan.
 */
const buildInitialScreeningAnswers = (job) =>
  Array.isArray(job?.quiz_screening_questions)
    ? job.quiz_screening_questions.map((question) => ({
        question_id: question.id,
        question: question.question,
        answer: '',
      }))
    : [];

/**
 * Ambil kunci localStorage bookmark per user.
 */
const getSavedJobsStorageKey = (userId) => `${SAVED_JOBS_STORAGE_PREFIX}:${userId || 'guest'}`;

/**
 * Baca lowongan yang disimpan kandidat.
 */
const readSavedJobIds = (userId) => {
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
 * Simpan bookmark lowongan kandidat.
 */
const persistSavedJobIds = (userId, savedJobIds) => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(
    getSavedJobsStorageKey(userId),
    JSON.stringify(Array.from(savedJobIds).map((item) => Number(item)))
  );
};

/**
 * Ambil deadline eksplisit atau fallback dari umur posting.
 */
const resolveJobDeadline = (job) => {
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
 * Ubah sisa waktu lowongan menjadi label sederhana.
 */
const formatJobCountdownLabel = (job) => {
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

const JobApplyStoryButtonIcon = ({ type }) => {
  if (type === 'save') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M7.5 4.75h9a.75.75 0 0 1 .75.75v13.02a.25.25 0 0 1-.41.19L12 14.78l-4.84 3.93a.25.25 0 0 1-.41-.19V5.5a.75.75 0 0 1 .75-.75Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M13.2 3.75 6.9 12h3.95l-1.1 8.25 7.35-9.75h-4.05l.15-6.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const JobApplyStoryButtonLabel = ({ icon, label }) => (
  <span className="job-apply-story-button-content">
    <span className={`job-apply-story-button-icon is-${icon}`} aria-hidden="true">
      <JobApplyStoryButtonIcon type={icon} />
    </span>
    <span className="job-apply-story-button-label">{label}</span>
  </span>
);

const JobApplyTopbarIcon = ({ type }) => {
  if (type === 'return') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M9 7 4 12l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 12h8.5a5.5 5.5 0 0 1 0 11H10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === 'share') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M8.25 15.75 15.75 8.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10 8.25h5.75V14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M14.75 6.75 9.25 12l5.5 5.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Halaman detail/apply khusus kandidat.
 */
const JobApplyPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { applyForJob, isLoading: isApplying } = useApplications();
  const numericJobId = Number(jobId || 0);
  const [job, setJob] = React.useState(null);
  const [isLoadingJob, setIsLoadingJob] = React.useState(true);
  const [jobError, setJobError] = React.useState('');
  const [appliedJobIds, setAppliedJobIds] = React.useState(new Set());
  const [applicationCoverLetter, setApplicationCoverLetter] = React.useState('');
  const [applicationScreeningAnswers, setApplicationScreeningAnswers] = React.useState([]);
  const [applicationVideoIntroUrl, setApplicationVideoIntroUrl] = React.useState('');
  const [applicationFeedback, setApplicationFeedback] = React.useState(null);
  const [savedJobIds, setSavedJobIds] = React.useState(() => readSavedJobIds(user?.id));
  const [jobApplyStep, setJobApplyStep] = React.useState(1);
  const [selectedResumeChoice, setSelectedResumeChoice] = React.useState('');
  const candidateProfile = React.useMemo(() => readCandidateProfile(user), [user]);
  const candidateCompletion = React.useMemo(
    () => getCandidateProfileCompletion(candidateProfile),
    [candidateProfile]
  );
  const candidatePreferredRoles = React.useMemo(
    () => collectFilledStrings(candidateProfile.preferredRoles, 3),
    [candidateProfile.preferredRoles]
  );
  const candidatePreferredLocations = React.useMemo(
    () => collectFilledStrings(candidateProfile.preferredLocations, 3),
    [candidateProfile.preferredLocations]
  );
  const candidateSkills = React.useMemo(
    () => collectFilledStrings(candidateProfile.skills, 6),
    [candidateProfile.skills]
  );
  const candidateResumeFiles = React.useMemo(
    () => collectFilledStrings(candidateProfile.resumeFiles, 3),
    [candidateProfile.resumeFiles]
  );
  const isSuccessStep = jobApplyStep === JOB_APPLY_TOTAL_STEPS;

  React.useEffect(() => {
    setSelectedResumeChoice((currentValue) => {
      if (
        currentValue &&
        (currentValue === RESUME_SKIP_OPTION || candidateResumeFiles.includes(currentValue))
      ) {
        return currentValue;
      }

      return candidateResumeFiles[0] || RESUME_SKIP_OPTION;
    });
  }, [candidateResumeFiles]);

  React.useEffect(() => {
    let isMounted = true;

    const loadJob = async () => {
      if (!Number.isFinite(numericJobId) || numericJobId <= 0) {
        setJob(null);
        setJobError('Lowongan tidak ditemukan.');
        setIsLoadingJob(false);
        return;
      }

      setIsLoadingJob(true);
      setJobError('');

      try {
        const loadedJob = await JobService.getJobById(numericJobId);

        if (!isMounted) {
          return;
        }

        setJob(loadedJob);
        setApplicationScreeningAnswers(buildInitialScreeningAnswers(loadedJob));
      } catch (error) {
        if (isMounted) {
          setJob(null);
          setJobError(error?.message || 'Gagal memuat detail lowongan.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingJob(false);
        }
      }
    };

    loadJob();

    return () => {
      isMounted = false;
    };
  }, [numericJobId]);

  React.useEffect(() => {
    let isMounted = true;

    const loadAppliedJobs = async () => {
      if (user?.role !== 'candidate') {
        if (isMounted) {
          setAppliedJobIds(new Set());
        }
        return;
      }

      try {
        const response = await ApplicationService.getMyApplications(1, 100);

        if (!isMounted) {
          return;
        }

        setAppliedJobIds(new Set(response.data.map((application) => Number(application.job_id))));
      } catch {
        if (isMounted) {
          setAppliedJobIds(new Set());
        }
      }
    };

    loadAppliedJobs();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role]);

  React.useEffect(() => {
    setSavedJobIds(readSavedJobIds(user?.id));
  }, [user?.id]);

  React.useEffect(() => {
    const pendingIntent = readCandidateApplyIntent();

    if (pendingIntent && Number(pendingIntent.jobId) === numericJobId) {
      clearCandidateApplyIntent();
    }
  }, [numericJobId]);

  const companyName = job?.recruiter?.company_name || job?.recruiter?.name || 'Perusahaan';
  const recruiterProfile = job?.recruiter?.recruiter_profile || {};
  const screeningQuestions = Array.isArray(job?.quiz_screening_questions)
    ? job.quiz_screening_questions
    : [];
  const activeVideoScreeningLabel = formatVideoScreeningRequirement(
    job?.video_screening_requirement
  );
  const focusChips = React.useMemo(() => {
    const focusSource = Array.isArray(recruiterProfile.hiringFocus)
      ? recruiterProfile.hiringFocus
      : [recruiterProfile.hiringFocus];
    const focusItems = collectFilledStrings(focusSource, 4);

    if (focusItems.length > 0) {
      return focusItems;
    }

    return [
      job?.category ? String(job.category).replace(/[-_]+/g, ' ') : '',
      formatExperienceChip(job?.experience_level),
      formatJobType(job?.job_type),
      formatWorkMode(job?.work_mode),
    ].filter(Boolean);
  }, [
    job?.category,
    job?.experience_level,
    job?.job_type,
    job?.work_mode,
    recruiterProfile.hiringFocus,
  ]);
  const responsibilityItems = React.useMemo(() => {
    const nextItems = buildSentenceList(job?.description || '', 5);

    if (nextItems.length > 0) {
      return nextItems;
    }

    return [
      `Menjalankan tanggung jawab utama untuk posisi ${job?.title || 'ini'}.`,
      job?.location
        ? `Bersedia bekerja di area ${job.location}.`
        : 'Bersedia mengikuti penempatan yang ditetapkan recruiter.',
      `Bekerja dengan skema ${formatJobType(job?.job_type)} dan pola ${formatWorkMode(job?.work_mode)}.`,
    ];
  }, [job?.description, job?.job_type, job?.location, job?.title, job?.work_mode]);
  const qualificationItems = React.useMemo(() => {
    const nextItems = [
      ...focusChips,
      `Level pengalaman ${formatExperienceChip(job?.experience_level)}.`,
      `Tipe kerja ${formatJobType(job?.job_type)} dengan pola ${formatWorkMode(job?.work_mode)}.`,
      job?.location ? `Penempatan utama di ${job.location}.` : 'Penempatan mengikuti kebutuhan recruiter.',
    ].filter(Boolean);

    if (nextItems.length > 0) {
      return nextItems.slice(0, 5);
    }

    return [
      `Level pengalaman ${formatExperienceChip(job?.experience_level)}.`,
      `Tipe kerja ${formatJobType(job?.job_type)} dengan pola ${formatWorkMode(job?.work_mode)}.`,
      job?.location ? `Penempatan utama di ${job.location}.` : 'Penempatan mengikuti kebutuhan recruiter.',
    ];
  }, [focusChips, job?.description, job?.experience_level, job?.job_type, job?.location, job?.work_mode]);
  const abilityItems = React.useMemo(
    () =>
      [...new Set(
        [
          ...focusChips,
          formatJobType(job?.job_type),
          formatWorkMode(job?.work_mode),
          formatExperienceChip(job?.experience_level),
        ].filter(Boolean)
      )].slice(0, 6),
    [focusChips, job?.experience_level, job?.job_type, job?.work_mode]
  );
  const companyProfileLink = String(recruiterProfile.website || '').trim();
  const companyVideoEmbedUrl = React.useMemo(
    () => toYouTubeEmbedUrl(companyProfileLink),
    [companyProfileLink]
  );
  const storyMetaItems = React.useMemo(
    () =>
      [
        {
          value: formatJobCountdownLabel(job) || 'Masih dibuka',
          label: 'Sisa waktu lowongan',
        },
        {
          value: job?.location || recruiterProfile.companyLocation || 'Indonesia',
          label: 'Lokasi lowongan',
        },
        {
          value: formatJobType(job?.job_type),
          label: 'Tipe pekerjaan',
        },
        {
          value: formatSalaryRangeLabel(job?.salary_min, job?.salary_max),
          label: 'Range gaji',
        },
      ].filter((item) => item.value),
    [job, recruiterProfile.companyLocation]
  );
  const storyQuote =
    buildDescriptionPreview(
      recruiterProfile.companyDescription ||
        job?.description ||
        'Lowongan ini dirancang untuk kandidat yang siap tumbuh bersama tim yang tepat.',
      220
    ) || 'Lowongan ini dirancang untuk kandidat yang siap tumbuh bersama tim yang tepat.';
  const unansweredRequiredScreeningCount = screeningQuestions.filter((question) => {
    if (!(question.required ?? true)) {
      return false;
    }

    const currentAnswer =
      applicationScreeningAnswers.find(
        (answer) => String(answer.question_id) === String(question.id)
      )?.answer || '';

    return !String(currentAnswer).trim();
  }).length;
  const isRequiredVideoMissing =
    job?.video_screening_requirement === 'required' && !applicationVideoIntroUrl.trim();
  const isScreeningStepIncomplete =
    unansweredRequiredScreeningCount > 0 || isRequiredVideoMissing;
  const isAlreadyApplied = appliedJobIds.has(Number(job?.id));
  const storyPublishedLabel = formatJobStoryDate(job?.created_at);
  const candidateName = candidateProfile.fullName || user?.name || 'Pelamar';
  const selectedResumeLabel =
    selectedResumeChoice === RESUME_SKIP_OPTION
      ? 'Tidak menyertakan resume'
      : selectedResumeChoice || 'Belum memilih resume';
  const hasScreeningRequirements =
    screeningQuestions.length > 0 || Boolean(job?.video_screening_requirement);
  const pageStatusMessage = !user
    ? 'Masuk sebagai pelamar untuk lanjut mengirim lamaran dari halaman ini.'
    : user.role !== 'candidate'
      ? 'Hanya akun pelamar yang bisa mengirim lamaran dari halaman ini.'
      : isAlreadyApplied
        ? 'Anda sudah pernah melamar lowongan ini. Status terbarunya ada di Lamaran Saya.'
        : !candidateCompletion.isReady
          ? `Lengkapi ${candidateCompletion.missingRequiredItems.length} komponen inti agar lamaran bisa dikirim.`
          : 'Profil Anda sudah siap untuk melanjutkan proses lamaran dari halaman ini.';

  const handleScreeningAnswerChange = React.useCallback((questionIdValue, questionText, answerValue) => {
    setApplicationScreeningAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      const existingIndex = nextAnswers.findIndex(
        (answer) => String(answer.question_id) === String(questionIdValue)
      );
      const nextAnswer = {
        question_id: questionIdValue,
        question: questionText,
        answer: answerValue,
      };

      if (existingIndex >= 0) {
        nextAnswers[existingIndex] = nextAnswer;
        return nextAnswers;
      }

      return [...nextAnswers, nextAnswer];
    });
  }, []);

  const handleSavedJobToggle = React.useCallback(() => {
    if (!job?.id) {
      return;
    }

    if (isAlreadyApplied) {
      return;
    }

    setSavedJobIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(Number(job.id))) {
        nextIds.delete(Number(job.id));
      } else {
        nextIds.add(Number(job.id));
      }

      persistSavedJobIds(user?.id, nextIds);
      return nextIds;
    });
  }, [isAlreadyApplied, job?.id, user?.id]);

  const handleShareJob = React.useCallback(async () => {
    if (!job) {
      return;
    }

    const shareTitle = `${job.title} • ${companyName}`;
    const shareText = `Lihat lowongan ${job.title} dari ${companyName}.`;
    const shareUrl =
      typeof window !== 'undefined' ? window.location.href : getJobApplyRoute(job.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareTitle}\n${shareText}\n${shareUrl}`);
        setApplicationFeedback({
          type: 'success',
          message: 'Link lowongan berhasil disalin.',
        });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setApplicationFeedback({
          type: 'error',
          message: 'Lowongan belum berhasil dibagikan.',
        });
      }
    }
  }, [companyName, job]);

  const handleOpenLogin = React.useCallback(() => {
    if (!job?.id) {
      return;
    }

    saveCandidateApplyIntent({
      jobId: Number(job.id),
      page: 1,
      filters: {},
      selectedLocation: job.location || '',
    });
    navigate(`${APP_ROUTES.login}?role=candidate`);
  }, [job?.id, job?.location, navigate]);

  const handleOpenApplications = React.useCallback(() => {
    navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
      state: {
        candidateNotice: `Status untuk ${job?.title || 'lowongan ini'} dapat dipantau dari Lamaran Saya.`,
      },
    });
  }, [job?.title, navigate]);

  const handleReturnToJobs = React.useCallback(() => {
    navigate(APP_ROUTES.jobs);
  }, [navigate]);

  const handleOpenProfile = React.useCallback(() => {
    const missingPreview = candidateCompletion.missingRequiredItems.slice(0, 3).join(', ');

    navigate(`${APP_ROUTES.candidateDashboard}#profile`, {
      state: {
        candidateNotice: `Lengkapi profil minimum terlebih dahulu sebelum melamar. Yang masih kurang: ${missingPreview}.`,
      },
    });
  }, [candidateCompletion.missingRequiredItems, navigate]);

  const handleApplySubmit = async (event) => {
    event.preventDefault();

    if (!job) {
      return;
    }

    if (!user) {
      handleOpenLogin();
      return;
    }

    if (user.role !== 'candidate') {
      navigate(getDefaultRouteForRole(user.role));
      return;
    }

    if (isAlreadyApplied) {
      handleOpenApplications();
      return;
    }

    if (!candidateCompletion.isReady) {
      handleOpenProfile();
      return;
    }

    if (unansweredRequiredScreeningCount > 0 || isRequiredVideoMissing) {
      setApplicationFeedback({
        type: 'error',
        message:
          unansweredRequiredScreeningCount > 0
            ? `Masih ada ${unansweredRequiredScreeningCount} pertanyaan wajib yang belum dijawab.`
            : 'Link video screening wajib masih kosong.',
      });
      return;
    }

    try {
      await applyForJob(
        job.id,
        applicationCoverLetter.trim(),
        applicationScreeningAnswers,
        applicationVideoIntroUrl.trim()
      );

      setAppliedJobIds((currentIds) => new Set([...currentIds, Number(job.id)]));
      setSavedJobIds((currentIds) => {
        if (!currentIds.has(Number(job.id))) {
          return currentIds;
        }

        const nextIds = new Set(currentIds);
        nextIds.delete(Number(job.id));
        persistSavedJobIds(user?.id, nextIds);
        return nextIds;
      });
      setApplicationFeedback({
        type: 'success',
        message: `Lamaran untuk ${job.title} berhasil dikirim.`,
      });
      setJobApplyStep(JOB_APPLY_TOTAL_STEPS);
    } catch (error) {
      setApplicationFeedback({
        type: 'error',
        message: error?.message || 'Lamaran belum berhasil dikirim.',
      });
    }
  };

  if (isLoadingJob) {
    return (
      <div className="job-apply-page-shell">
        <div className="loading">Memuat detail lowongan...</div>
      </div>
    );
  }

  if (!job || jobError) {
    return (
      <div className="job-apply-page-shell">
        <article className="job-apply-page-feedback-card">
          <strong>Detail lowongan belum tersedia</strong>
          <p>{jobError || 'Lowongan yang Anda buka tidak ditemukan.'}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(APP_ROUTES.jobs)}>
            Kembali ke Lowongan Kerja
          </button>
        </article>
      </div>
    );
  }

  return (
    <div className="job-apply-page-shell">
      <div className="job-apply-page-topbar">
        <button type="button" className="job-apply-page-backlink" onClick={handleReturnToJobs}>
          ← Kembali ke Lowongan Kerja
        </button>
        <span className="job-apply-page-route-label">
          {isSuccessStep ? 'Lamaran berhasil' : 'Detail lowongan & lamaran'}
        </span>
      </div>

      <div className="job-apply-modal job-apply-modal-standalone is-story-step">
        <div
          className={`job-apply-modal-header job-apply-modal-header-story${
            isSuccessStep ? ' is-success-step' : ''
          }`}
        >
          {!isSuccessStep && (
            <button
              type="button"
              className="job-apply-story-topbar-button"
              onClick={handleReturnToJobs}
              aria-label="Kembali ke Lowongan Kerja"
            >
              <JobApplyTopbarIcon type="back" />
            </button>
          )}
          <div className="job-apply-story-topbar-copy">
            <span>{isSuccessStep ? 'Lowongan kerja' : 'Detail lowongan'}</span>
            <strong id="job-apply-modal-title">
              {isSuccessStep ? 'Berkas telah berhasil terkirim' : job.title}
            </strong>
          </div>
          <button
            type="button"
            className={`job-apply-story-topbar-button${isSuccessStep ? ' is-return-link' : ''}`}
            onClick={isSuccessStep ? handleReturnToJobs : handleShareJob}
            aria-label={isSuccessStep ? 'Kembali ke Lowongan Kerja' : 'Bagikan lowongan'}
          >
            <JobApplyTopbarIcon type={isSuccessStep ? 'return' : 'share'} />
          </button>
        </div>

        <form className="job-apply-form is-story-step" onSubmit={handleApplySubmit}>
          {!isSuccessStep && (
            <div className="job-apply-story-shell">
              <section className="job-apply-story-hero">
                <div className="job-apply-story-cover">
                  <div className="job-apply-story-cover-card">
                    <span className="job-apply-story-cover-eyebrow">
                      {String(companyName).toUpperCase()}
                    </span>
                    <strong>{job.category || 'Career Opportunity'}</strong>
                    <small>
                      {formatJobType(job.job_type)} • {formatWorkMode(job.work_mode)}
                    </small>
                  </div>
                  <div className="job-apply-company-badge" aria-hidden="true">
                    {buildCompanyInitials(companyName)}
                  </div>
                </div>

                <div className="job-apply-story-hero-copy">
                  <h3 className="job-apply-hero-title">{job.title}</h3>
                  <p className="job-apply-hero-company">{companyName}</p>

                  <div className="job-apply-story-chip-row">
                    <span className="job-apply-story-chip">
                      {formatExperienceChip(job.experience_level)}
                    </span>
                    <span className="job-apply-story-chip">{formatWorkMode(job.work_mode)}</span>
                    <span className="job-apply-story-chip">
                      {job.location || recruiterProfile.companyLocation || 'Indonesia'}
                    </span>
                  </div>

                  <div className="job-apply-story-meta-list">
                    {storyMetaItems.map((item) => (
                      <article key={`${item.label}-${item.value}`} className="job-apply-story-meta-item">
                        <strong>{item.value}</strong>
                        <span>{item.label}</span>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <div className="job-apply-story-content">
                <div className="job-apply-story-intro-strip">
                  <span>{storyPublishedLabel}</span>
                  <strong>{formatJobCountdownLabel(job) || 'Masih dibuka'}</strong>
                </div>

                <div className="job-apply-profile-summary job-apply-page-status-card">
                  <strong>Status lamaran Anda</strong>
                  <p className="job-apply-company-copy">{pageStatusMessage}</p>
                  <div className="job-apply-chip-wrap">
                    {candidatePreferredRoles[0] && (
                      <span className="job-apply-chip">Role incaran: {candidatePreferredRoles[0]}</span>
                    )}
                    {candidatePreferredLocations[0] && (
                      <span className="job-apply-chip">
                        Lokasi minat: {candidatePreferredLocations[0]}
                      </span>
                    )}
                    {candidateSkills[0] && (
                      <span className="job-apply-chip">Skill utama: {candidateSkills[0]}</span>
                    )}
                    {candidateResumeFiles[0] && (
                      <span className="job-apply-chip job-apply-chip-secondary">
                        CV: {candidateResumeFiles[0]}
                      </span>
                    )}
                  </div>
                </div>

                <section className="job-apply-story-section job-apply-story-about-card">
                  <div className="job-apply-story-heading">
                    <strong>Company Profile</strong>
                    <span>Tentang kami</span>
                  </div>

                  <p className="job-apply-company-copy">
                    {recruiterProfile.companyDescription ||
                      buildDescriptionPreview(job.description, 260) ||
                      'Recruiter akan menjelaskan kultur kerja dan detail tim pada tahap seleksi berikutnya.'}
                  </p>

                  <div className="job-apply-quote-card job-apply-quote-card-story">
                    <p>"{storyQuote}"</p>
                  </div>

                  <div className="job-apply-visual-card job-apply-visual-card-story">
                    <div className="job-apply-visual-stage" aria-hidden="true">
                      <span className="job-apply-visual-window" />
                      <span className="job-apply-visual-desk" />
                    </div>
                    <div className="job-apply-visual-plaque">
                      <strong>{recruiterProfile.contactRole || 'Hiring team'}</strong>
                      <span>
                        {recruiterProfile.companyLocation || job.location || 'Indonesia'}
                      </span>
                    </div>
                  </div>

                  {companyProfileLink && !companyVideoEmbedUrl && (
                    <a
                      className="job-apply-company-link"
                      href={companyProfileLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka company profile
                    </a>
                  )}
                </section>

                {companyVideoEmbedUrl && (
                  <section className="job-apply-story-section">
                    <div className="job-apply-story-heading">
                      <strong>Video Profile Company</strong>
                      <span>Lihat profil perusahaan sebelum melamar</span>
                    </div>

                    <div className="job-apply-video-embed">
                      <iframe
                        src={companyVideoEmbedUrl}
                        title={`Company profile ${companyName}`}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>

                    {companyProfileLink && (
                      <a
                        className="job-apply-company-link"
                        href={companyProfileLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka video / profile perusahaan
                      </a>
                    )}
                  </section>
                )}

                <section className="job-apply-story-section">
                  <div className="job-apply-story-heading">
                    <strong>Kemampuan</strong>
                    <span>Ringkasan kemampuan dan fokus kerja yang dibutuhkan</span>
                  </div>

                  <div className="job-apply-story-question-tags job-apply-story-culture-tags">
                    {abilityItems.map((item) => (
                      <span key={`job-ability-chip-${item}`}>{item}</span>
                    ))}
                  </div>
                </section>

                <section className="job-apply-story-section">
                  <div className="job-apply-story-heading">
                    <strong>Kualifikasi</strong>
                  </div>

                  <ul className="job-apply-story-bullet-list">
                    {qualificationItems.map((item, index) => (
                      <li key={`job-qualification-${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="job-apply-story-section">
                  <div className="job-apply-story-heading">
                    <strong>Tanggung Jawab</strong>
                  </div>

                  <ul className="job-apply-story-bullet-list">
                    {responsibilityItems.map((item, index) => (
                      <li key={`job-responsibility-${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="job-apply-story-section">
                  <div className="job-apply-story-heading">
                    <strong>Resume Saya</strong>
                    <span>Pilih dokumen yang akan dipakai untuk lowongan ini</span>
                  </div>

                  <div className="job-apply-document-stack">
                    {candidateResumeFiles.length > 0 ? (
                      candidateResumeFiles.map((resumeName, resumeIndex) => (
                        <label
                          key={`job-apply-resume-${resumeIndex}-${resumeName}`}
                          className={`job-apply-document-card${
                            selectedResumeChoice === resumeName ? ' is-active' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="selected-resume"
                            checked={selectedResumeChoice === resumeName}
                            onChange={() => setSelectedResumeChoice(resumeName)}
                          />
                          <div className="job-apply-document-copy">
                            <strong>{resumeName}</strong>
                            <span>
                              {resumeIndex === 0
                                ? 'CV utama yang saat ini tersimpan di profil kandidat.'
                                : 'CV tambahan yang tersimpan di profil kandidat.'}
                            </span>
                          </div>
                          {resumeIndex === 0 && <small>Default</small>}
                        </label>
                      ))
                    ) : (
                      <article className="job-apply-document-empty">
                        <strong>Belum ada CV tersimpan</strong>
                        <p className="job-apply-company-copy">
                          Atur CV PDF dari Profil Siap Lamar jika ingin melampirkannya ke lamaran ini.
                        </p>
                      </article>
                    )}

                    <label
                      className={`job-apply-document-card${
                        selectedResumeChoice === RESUME_SKIP_OPTION ? ' is-active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="selected-resume"
                        checked={selectedResumeChoice === RESUME_SKIP_OPTION}
                        onChange={() => setSelectedResumeChoice(RESUME_SKIP_OPTION)}
                      />
                      <div className="job-apply-document-copy">
                        <strong>Jangan sertakan resume</strong>
                        <span>Anda tetap bisa lanjut melamar tanpa menautkan CV.</span>
                      </div>
                    </label>
                  </div>

                  <div className="job-apply-inline-actions">
                    <button type="button" className="btn btn-outline" onClick={handleOpenProfile}>
                      Atur CV di Profil
                    </button>
                    <span className="job-apply-company-copy">
                      Pilihan saat ini: {selectedResumeLabel}
                    </span>
                  </div>
                </section>

                <section className="job-apply-story-section">
                  <div className="job-apply-story-heading">
                    <strong>Pertanyaan dari HR</strong>
                    <span>Jawab poin yang memang diminta recruiter</span>
                  </div>

                  {screeningQuestions.length > 0 ? (
                    <div className="job-apply-screening-stack">
                      {screeningQuestions.map((question) => {
                        const currentAnswer =
                          applicationScreeningAnswers.find(
                            (answer) => String(answer.question_id) === String(question.id)
                          )?.answer || '';

                        return (
                          <div key={question.id} className="job-apply-screening-card">
                            <span>
                              {question.question}
                              {question.required ?? true ? ' *' : ''}
                            </span>
                            {Array.isArray(question.answers) && question.answers.length > 0 ? (
                              <div className="job-apply-screening-choice-row">
                                {question.answers.map((answerOption) => (
                                  <label key={`${question.id}-${answerOption}`}>
                                    <input
                                      type="radio"
                                      name={`screening-${question.id}`}
                                      checked={currentAnswer === answerOption}
                                      onChange={() =>
                                        handleScreeningAnswerChange(
                                          question.id,
                                          question.question,
                                          answerOption
                                        )
                                      }
                                    />
                                    <span>{answerOption}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <textarea
                                rows="3"
                                placeholder="Tulis jawaban Anda..."
                                value={currentAnswer}
                                onChange={(event) =>
                                  handleScreeningAnswerChange(
                                    question.id,
                                    question.question,
                                    event.target.value
                                  )
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="job-apply-profile-summary">
                      <strong>Tidak ada pertanyaan tambahan</strong>
                      <p className="job-apply-company-copy">
                        Recruiter tidak menambahkan pertanyaan HR pada lowongan ini.
                      </p>
                    </div>
                  )}
                </section>

                {job?.video_screening_requirement && (
                  <section className="job-apply-story-section">
                    <div className="job-apply-story-heading">
                      <strong>Video Skrining</strong>
                      <span>
                        {job.video_screening_requirement === 'required'
                          ? 'Wajib dilampirkan untuk lowongan ini'
                          : 'Opsional untuk lowongan ini'}
                      </span>
                    </div>

                    {activeVideoScreeningLabel && (
                      <p className="job-apply-video-screening-note">{activeVideoScreeningLabel}</p>
                    )}

                    <label className="job-apply-field">
                      <span>
                        Link video screening
                        {job.video_screening_requirement === 'required'
                          ? ' (wajib)'
                          : ' (opsional)'}
                      </span>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={applicationVideoIntroUrl}
                        onChange={(event) => setApplicationVideoIntroUrl(event.target.value)}
                      />
                      <small>
                        Gunakan link yang bisa dibuka recruiter tanpa perlu meminta akses tambahan.
                      </small>
                    </label>
                  </section>
                )}

                <section className="job-apply-story-section">
                  <div className="job-apply-story-heading">
                    <strong>Catatan Tambahan untuk Recruiter</strong>
                    <span>Opsional</span>
                  </div>

                  <label className="job-apply-field">
                    <span>Catatan singkat</span>
                    <textarea
                      rows="4"
                      placeholder="Tulis motivasi singkat atau informasi pendukung lain untuk recruiter."
                      value={applicationCoverLetter}
                      onChange={(event) => setApplicationCoverLetter(event.target.value)}
                    />
                    <small>
                      Anda bisa menjelaskan motivasi melamar atau konteks singkat yang belum tertangkap dari CV.
                    </small>
                  </label>

                  <div className="job-apply-profile-summary">
                    <strong>Ringkasan lamaran</strong>
                    <div className="job-apply-profile-grid">
                      <span>Perusahaan: {companyName}</span>
                      <span>Posisi: {job.title}</span>
                      <span>Resume dipilih: {selectedResumeLabel}</span>
                      <span>
                        Screening terjawab:{' '}
                        {screeningQuestions.length > 0
                          ? `${applicationScreeningAnswers.filter((item) => String(item.answer || '').trim()).length}/${screeningQuestions.length}`
                          : 'Tidak ada screening'}
                      </span>
                      <span>
                        Video: {applicationVideoIntroUrl.trim() ? 'Sudah ditautkan' : 'Belum ditautkan'}
                      </span>
                      <span>
                        Lowongan tersimpan: {savedJobIds.has(Number(job.id)) ? 'Ya' : 'Belum'}
                      </span>
                    </div>
                  </div>

                  {isScreeningStepIncomplete && (
                    <p className="job-apply-feedback job-apply-feedback-error">
                      {unansweredRequiredScreeningCount > 0
                        ? `Masih ada ${unansweredRequiredScreeningCount} pertanyaan wajib yang belum dijawab.`
                        : 'Link video screening wajib masih kosong.'}
                    </p>
                  )}

                  {!hasScreeningRequirements && (
                    <p className="job-apply-company-copy">
                      Lowongan ini bisa langsung di-quick apply karena recruiter tidak menambahkan
                      pertanyaan HR atau video screening.
                    </p>
                  )}
                </section>
              </div>
            </div>
          )}

          {isSuccessStep && (
            <div className="job-apply-success-stack">
              <div className="job-apply-success-card">
                <strong>Berkas telah berhasil terkirim</strong>
                <h3>{job.title}</h3>
                <p>
                  Halo {candidateName}, berkas Anda sudah terkirim ke {companyName}. Sekarang Anda
                  bisa membuka Lamaran Saya atau kembali ke Lowongan Kerja untuk melihat peluang lain.
                </p>
                <div className="job-apply-chip-wrap">
                  <span className="job-apply-chip">Status awal: Menunggu review recruiter</span>
                  <span className="job-apply-chip job-apply-chip-secondary">
                    Terkirim{' '}
                    {new Date().toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {applicationFeedback && !isSuccessStep && (
            <p className={`job-apply-feedback job-apply-feedback-${applicationFeedback.type}`}>
              {applicationFeedback.message}
            </p>
          )}

          <div className={`job-apply-actions${!isSuccessStep ? ' is-story-step' : ''}`}>
            {isSuccessStep ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
                      state: {
                        candidateNotice: `Lamaran untuk ${job.title} berhasil dikirim.`,
                      },
                    })
                  }
                >
                  Buka Lamaran Saya
                </button>
                <button type="button" className="btn btn-outline" onClick={handleReturnToJobs}>
                  Kembali ke Lowongan Kerja
                </button>
              </>
            ) : (
              <>
                {isAlreadyApplied ? (
                  <>
                    <button type="button" className="btn btn-outline" onClick={() => navigate(APP_ROUTES.jobs)}>
                      Kembali
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleOpenApplications}>
                      Lihat Status Lamaran
                    </button>
                  </>
                ) : !user ? (
                  <>
                    <button type="button" className="btn btn-outline" onClick={() => navigate(APP_ROUTES.jobs)}>
                      Kembali
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleOpenLogin}>
                      Login sebagai Pelamar
                    </button>
                  </>
                ) : user.role !== 'candidate' ? (
                  <>
                    <button type="button" className="btn btn-outline" onClick={() => navigate(APP_ROUTES.jobs)}>
                      Kembali
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(getDefaultRouteForRole(user.role))}
                    >
                      Buka Area Recruiter
                    </button>
                  </>
                ) : !candidateCompletion.isReady ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline job-apply-story-secondary-button"
                      onClick={handleSavedJobToggle}
                    >
                      <JobApplyStoryButtonLabel
                        icon="save"
                        label={savedJobIds.has(Number(job.id)) ? 'Saved' : 'Save'}
                      />
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary job-apply-story-primary-button"
                      onClick={handleOpenProfile}
                    >
                      <JobApplyStoryButtonLabel icon="apply" label="Lengkapi Profil" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="job-apply-actions-copy">
                      <strong>Quick Apply dari halaman ini</strong>
                      <span>
                        Semua dokumen, pertanyaan HR, dan video screening sudah disusun dalam satu
                        alur. Pastikan jawaban Anda lengkap sebelum mengirim.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline job-apply-story-secondary-button"
                      onClick={handleSavedJobToggle}
                    >
                      <JobApplyStoryButtonLabel
                        icon="save"
                        label={savedJobIds.has(Number(job.id)) ? 'Saved' : 'Save'}
                      />
                    </button>
                    <button type="submit" className="btn btn-primary job-apply-story-primary-button" disabled={isApplying}>
                      <JobApplyStoryButtonLabel
                        icon="apply"
                        label={isApplying ? 'Mengirim...' : 'Quick Apply'}
                      />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobApplyPage;
