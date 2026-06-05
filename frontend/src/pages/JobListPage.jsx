import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JobCard from '../components/JobCard.jsx';
import { getLocationCoordinates, normalizeLocationKey } from '../data/locationCoordinates.js';
import useApplications from '../hooks/useApplications.js';
import useAuth from '../hooks/useAuth.js';
import useJobs from '../hooks/useJobs';
import ApplicationService from '../services/applicationService.js';
import JobService from '../services/jobService.js';
import {
  clearCandidateApplyIntent,
  readCandidateApplyIntent,
} from '../utils/candidateApplyIntent.js';
import {
  getCandidateProfileCompletion,
  readCandidateProfile,
} from '../utils/candidateFlow.js';
import { APP_ROUTES, getJobApplyRoute } from '../utils/routeHelpers.js';
import {
  formatExperienceLevel,
  formatInterviewType,
  formatJobType,
  formatWorkMode,
  formatVideoScreeningRequirement,
} from '../utils/jobFormatters.js';
import '../styles/jobList.css';

const EARTH_RADIUS_IN_KILOMETERS = 6371;
const SAVED_JOBS_STORAGE_PREFIX = 'candidate_saved_jobs';
const JOB_ACTIVE_WINDOW_IN_DAYS = 30;
const JOB_RECENT_WINDOW_IN_DAYS = 14;
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const SALARY_FILTER_OPTIONS = [
  { value: '', label: 'Semua Gaji' },
  { value: '3000000', label: 'Di atas Rp 3 juta' },
  { value: '5000000', label: 'Di atas Rp 5 juta' },
  { value: '8000000', label: 'Di atas Rp 8 juta' },
  { value: '10000000', label: 'Di atas Rp 10 juta' },
];
const JOB_APPLY_TOTAL_STEPS = 4;
const IDR_NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

/**
 * Mengambil maksimal beberapa entri string yang benar-benar terisi.
 */
const collectFilledStrings = (items = [], limit = 3) =>
  (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);

/**
 * Membuat inisial singkat untuk badge perusahaan di modal apply.
 */
const buildCompanyInitials = (value = '') =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('') || 'KN';

/**
 * Mengambil rekomendasi singkat untuk ditampilkan setelah lamaran sukses terkirim.
 */
const buildSuccessRecommendations = (jobs, selectedJobId) =>
  (Array.isArray(jobs) ? jobs : [])
    .filter((job) => Number(job.id) !== Number(selectedJobId))
    .slice(0, 2);

/**
 * Memadatkan label level pengalaman untuk chip dan ringkasan kandidat.
 */
const formatExperienceChip = (value = '') => {
  const label = formatExperienceLevel(value);
  return label.replace(/\s*\(.*?\)\s*/g, '').trim() || label;
};

/**
 * Memformat nominal gaji menjadi format juta singkat seperti mockup revisi.
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
 * Menyusun label rentang gaji baik untuk kartu utama maupun detail lowongan.
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
 * Memformat tanggal publish lowongan ke label pendek untuk panel detail kandidat.
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
 * Memotong deskripsi panjang menjadi teaser yang lebih mudah dipindai.
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
 * Memecah teks naratif menjadi daftar poin yang layak dipakai pada tampilan detail.
 */
const buildSentenceList = (value = '', limit = 4) =>
  String(value || '')
    .split(/[\n\r]+|[.!?]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);

/**
 * Mengubah skor rekomendasi ringan menjadi label kecocokan kandidat.
 */
const buildRecommendationMatchLabel = (score = 0) => {
  const numericScore = Number(score || 0);

  if (numericScore <= 0) {
    return '';
  }

  const percentage = Math.max(40, Math.min(95, 34 + numericScore * 8));
  return `${percentage}% cocok`;
};

/**
 * Mengubah link YouTube recruiter menjadi embed URL bila memungkinkan.
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
 * Membuat storage key bookmark lowongan per akun kandidat atau sesi guest.
 */
const getSavedJobsStorageKey = (userId) => `${SAVED_JOBS_STORAGE_PREFIX}:${userId || 'guest'}`;

/**
 * Membaca daftar lowongan yang disimpan kandidat dari localStorage.
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
 * Menyimpan daftar bookmark lowongan kandidat ke localStorage.
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
 * Mengambil tanggal batas lowongan dari data eksplisit atau fallback umur posting.
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
 * Mengubah sisa waktu lowongan menjadi label singkat yang mudah dipahami kandidat.
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

/**
 * Memfilter hasil lowongan di sisi kandidat untuk kebutuhan UI yang belum didukung backend.
 */
const filterCandidateFacingJobs = (jobs, filters, savedJobIds) => {
  const normalizedCompanyTerm = String(filters.company_name || '').trim().toLowerCase();
  const minimumSalaryFilter = Number(filters.salary_minimum || 0);
  const showSavedOnly = filters.saved_only === '1';
  const showRecentOnly = filters.recent_only === '1';

  return jobs.filter((job) => {
    const recruiterName = String(
      job?.recruiter?.company_name || job?.recruiter?.name || ''
    ).toLowerCase();
    const matchesCompany =
      !normalizedCompanyTerm || recruiterName.includes(normalizedCompanyTerm);
    const matchesMinimumSalary =
      !minimumSalaryFilter || Number(job.salary_max || job.salary_min || 0) >= minimumSalaryFilter;
    const matchesSavedState = !showSavedOnly || savedJobIds.has(Number(job.id));
    const matchesRecentState =
      !showRecentOnly ||
      (job?.created_at &&
        Date.now() - new Date(job.created_at).getTime() <=
          JOB_RECENT_WINDOW_IN_DAYS * ONE_DAY_IN_MILLISECONDS);

    return matchesCompany && matchesMinimumSalary && matchesSavedState && matchesRecentState;
  });
};

/**
 * Memberi skor rekomendasi ringan supaya lowongan yang paling relevan tampil lebih dulu.
 */
const scoreJobForCandidate = (job, candidateProfile) => {
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
 * Mengubah derajat geografis menjadi radian untuk perhitungan jarak.
 */
const toRadians = (value) => (value * Math.PI) / 180;

/**
 * Menghitung jarak antar dua titik koordinat memakai rumus haversine.
 */
const calculateDistanceInKilometers = (origin, destination) => {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversineResult =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_IN_KILOMETERS * Math.asin(Math.sqrt(haversineResult));
};

/**
 * Memformat jarak dalam kilometer menjadi label meter atau kilometer yang ramah UI.
 */
const formatDistance = (distanceInKilometers) => {
  if (distanceInKilometers < 1) {
    return `${Math.round(distanceInKilometers * 1000)} m`;
  }

  return `${distanceInKilometers.toFixed(1)} km`;
};

/**
 * Mengubah kode error geolocation browser menjadi pesan bantuan yang bisa dibaca user.
 */
const getLocationPermissionErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 1:
      return 'Izin lokasi ditolak. Aktifkan akses lokasi browser untuk menampilkan kota terdekat.';
    case 2:
      return 'Lokasi perangkat tidak berhasil dibaca. Coba lagi dalam beberapa saat.';
    case 3:
      return 'Permintaan lokasi melebihi batas waktu. Coba lagi.';
    default:
      return 'Gagal mengambil lokasi perangkat.';
  }
};

/**
 * Menyiapkan payload jawaban awal untuk setiap pertanyaan screening di modal apply.
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
 * Halaman daftar lowongan publik dengan filter pencarian, dropdown lokasi, dan pagination.
 */
const JobListPage = () => {
  const { jobs, pagination, isLoading, error, fetchJobs } = useJobs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { applyForJob, isLoading: isApplying } = useApplications();
  const initialApplyIntentRef = React.useRef(readCandidateApplyIntent());
  const initialApplyIntent = initialApplyIntentRef.current;
  const candidateProfile = React.useMemo(() => readCandidateProfile(user), [user]);
  const candidateCompletion = React.useMemo(
    () => getCandidateProfileCompletion(candidateProfile),
    [candidateProfile]
  );
  const [currentPage, setCurrentPage] = React.useState(() => initialApplyIntent?.page ?? 1);
  const [filters, setFilters] = React.useState(() => initialApplyIntent?.filters ?? {});
  const [selectedLocation, setSelectedLocation] = React.useState(
    () => initialApplyIntent?.selectedLocation ?? ''
  );
  const [availableLocations, setAvailableLocations] = React.useState([]);
  const [groupedLocationOptions, setGroupedLocationOptions] = React.useState([]);
  const [isLoadingLocationOptions, setIsLoadingLocationOptions] = React.useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = React.useState(false);
  const [locationNotice, setLocationNotice] = React.useState('');
  const [nearbyLocations, setNearbyLocations] = React.useState([]);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = React.useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = React.useState('');
  const [selectedJob, setSelectedJob] = React.useState(null);
  const [appliedJobIds, setAppliedJobIds] = React.useState(new Set());
  const [isLoadingAppliedJobs, setIsLoadingAppliedJobs] = React.useState(false);
  const [applicationCoverLetter, setApplicationCoverLetter] = React.useState('');
  const [applicationScreeningAnswers, setApplicationScreeningAnswers] = React.useState([]);
  const [applicationVideoIntroUrl, setApplicationVideoIntroUrl] = React.useState('');
  const [applicationFeedback, setApplicationFeedback] = React.useState(null);
  const [savedJobIds, setSavedJobIds] = React.useState(() => readSavedJobIds(user?.id));
  const [isSecurityBannerDismissed, setIsSecurityBannerDismissed] = React.useState(false);
  const [jobApplyStep, setJobApplyStep] = React.useState(1);
  const [jobApplySuccessState, setJobApplySuccessState] = React.useState(null);
  const locationDropdownRef = React.useRef(null);
  const hasRestoredApplyIntentRef = React.useRef(false);

  /**
   * Menyinkronkan daftar lowongan dengan kombinasi page dan filter yang sedang aktif.
   */
  useEffect(() => {
    fetchJobs(filters, currentPage, 60);
  }, [currentPage, filters, fetchJobs]);

  /**
   * Mengambil lokasi lowongan aktif untuk membantu rekomendasi kota terdekat dari perangkat user.
   */
  useEffect(() => {
    const loadAvailableLocations = async () => {
      try {
        const locations = await JobService.getAvailableLocations();
        setAvailableLocations(locations);
      } catch {
        setAvailableLocations([]);
      }
    };

    loadAvailableLocations();
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!selectedLocation) {
      return undefined;
    }

    const loadLocationOptions = async () => {
      setIsLoadingLocationOptions(true);

      try {
        const module = await import('../data/indonesiaLocationOptions.js');

        if (!isMounted) {
          return;
        }

        setGroupedLocationOptions(module.default || []);
      } catch {
        if (isMounted) {
          setGroupedLocationOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingLocationOptions(false);
        }
      }
    };

    loadLocationOptions();

    return () => {
      isMounted = false;
    };
  }, [selectedLocation]);

  useEffect(() => {
    let isMounted = true;

    const loadAppliedJobs = async () => {
      if (user?.role !== 'candidate') {
        if (isMounted) {
          setAppliedJobIds(new Set());
          setIsLoadingAppliedJobs(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoadingAppliedJobs(true);
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
      } finally {
        if (isMounted) {
          setIsLoadingAppliedJobs(false);
        }
      }
    };

    loadAppliedJobs();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    setSavedJobIds(readSavedJobIds(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (hasRestoredApplyIntentRef.current) {
      return;
    }

    const pendingApplyIntent = readCandidateApplyIntent();

    if (!pendingApplyIntent) {
      hasRestoredApplyIntentRef.current = true;
      return;
    }

    if (user && user.role !== 'candidate') {
      hasRestoredApplyIntentRef.current = true;
      clearCandidateApplyIntent();
      return;
    }

    if (!user) {
      return;
    }

    if (!user || isLoading || isLoadingAppliedJobs) {
      return;
    }

    hasRestoredApplyIntentRef.current = true;
    clearCandidateApplyIntent();
    navigate(getJobApplyRoute(pendingApplyIntent.jobId), { replace: true });
  }, [
    isLoading,
    isLoadingAppliedJobs,
    navigate,
    user,
    user?.role,
  ]);

  /**
   * Menutup dropdown lokasi saat user klik area di luar panel filter lokasi.
   */
  useEffect(() => {
    const handleOutsidePointer = (event) => {
      if (!locationDropdownRef.current?.contains(event.target)) {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsidePointer);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
    };
  }, []);

  /**
   * Menyatukan perubahan filter ke satu helper agar pagination selalu reset saat filter berubah.
   */
  const updateFilter = React.useCallback((name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setCurrentPage(1);
  }, []);

  /**
   * Mengubah filter non-lokasi langsung dari event input/select standar.
   */
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    updateFilter(name, value);
  };

  /**
   * Mengubah kota aktif dari dropdown lalu menyinkronkan filter lokasi ke query lowongan.
   */
  const handleLocationSelect = React.useCallback(
    (locationValue) => {
      setSelectedLocation(locationValue);
      updateFilter('location', locationValue);
      setIsLocationDropdownOpen(false);
      setLocationSearchQuery('');
    },
    [updateFilter]
  );

  const handleLocationClear = React.useCallback(() => {
    setSelectedLocation('');
    updateFilter('location', '');
    setIsLocationDropdownOpen(false);
    setLocationSearchQuery('');
  }, [updateFilter]);

  const ensureLocationOptionsLoaded = React.useCallback(async () => {
    if (groupedLocationOptions.length > 0 || isLoadingLocationOptions) {
      return;
    }

    setIsLoadingLocationOptions(true);

    try {
      const module = await import('../data/indonesiaLocationOptions.js');
      setGroupedLocationOptions(module.default || []);
    } catch {
      setGroupedLocationOptions([]);
    } finally {
      setIsLoadingLocationOptions(false);
    }
  }, [groupedLocationOptions.length, isLoadingLocationOptions]);

  const handleResetFilters = React.useCallback(() => {
    setFilters({});
    setSelectedLocation('');
    setCurrentPage(1);
    setNearbyLocations([]);
    setLocationNotice('');
    setLocationSearchQuery('');
    setIsLocationDropdownOpen(false);
  }, []);

  /**
   * Mengaktifkan lokasi tertentu dari rekomendasi terdekat.
   */
  const handleNearbyLocationPick = React.useCallback(
    (locationName) => {
      handleLocationSelect(locationName);
    },
    [handleLocationSelect]
  );

  const handleSavedJobToggle = React.useCallback(
    (jobId) => {
      setSavedJobIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (nextIds.has(Number(jobId))) {
          nextIds.delete(Number(jobId));
        } else {
          nextIds.add(Number(jobId));
        }

        persistSavedJobIds(user?.id, nextIds);
        return nextIds;
      });
    },
    [user?.id]
  );

  /**
   * Meminta lokasi perangkat, lalu memilih kota lowongan yang paling dekat dengan user.
   */
  const handleUseCurrentLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setLocationNotice('Browser Anda belum mendukung akses lokasi perangkat.');
      setNearbyLocations([]);
      return;
    }

    if (availableLocations.length === 0) {
      setLocationNotice('Belum ada lokasi lowongan aktif yang bisa dicocokkan.');
      setNearbyLocations([]);
      return;
    }

    setIsDetectingLocation(true);
    setLocationNotice('Mencari kota lowongan terdekat dari lokasi Anda...');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const sortedNearbyLocations = availableLocations
          .map((locationName) => {
            const coordinates = getLocationCoordinates(locationName);

            if (!coordinates) {
              return null;
            }

            const distanceInKilometers = calculateDistanceInKilometers(
              {
                latitude: coords.latitude,
                longitude: coords.longitude,
              },
              coordinates
            );

            return {
              name: locationName,
              distanceInKilometers,
              distanceLabel: formatDistance(distanceInKilometers),
            };
          })
          .filter(Boolean)
          .sort(
            (firstLocation, secondLocation) =>
              firstLocation.distanceInKilometers - secondLocation.distanceInKilometers
          );

        setIsDetectingLocation(false);

        if (sortedNearbyLocations.length === 0) {
          setNearbyLocations([]);
          setLocationNotice(
            'Lokasi perangkat aktif, tetapi kota lowongan yang tersedia belum punya titik koordinat yang cocok.'
          );
          return;
        }

        const closestLocation = sortedNearbyLocations[0];

        setNearbyLocations(sortedNearbyLocations.slice(0, 3));
        setLocationNotice(`Lowongan terdekat ditemukan di ${closestLocation.name}.`);
        handleNearbyLocationPick(closestLocation.name);
      },
      (error) => {
        setIsDetectingLocation(false);
        setNearbyLocations([]);
        setLocationNotice(getLocationPermissionErrorMessage(error.code));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [availableLocations, handleNearbyLocationPick]);

  const closeApplyModal = React.useCallback(() => {
    setSelectedJob(null);
    setApplicationCoverLetter('');
    setApplicationScreeningAnswers([]);
    setApplicationVideoIntroUrl('');
    setApplicationFeedback(null);
    setJobApplyStep(1);
    setJobApplySuccessState(null);
  }, []);

  const handleApply = React.useCallback(
    (job) => {
      if (appliedJobIds.has(Number(job.id))) {
        navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
          state: {
            candidateNotice: `Anda sudah pernah melamar ${job.title}. Cek status terbarunya di Lamaran Saya.`,
          },
        });
        return;
      }

      navigate(getJobApplyRoute(job.id));
    },
    [appliedJobIds, navigate]
  );

  const handleScreeningAnswerChange = React.useCallback((questionId, questionText, answerValue) => {
    setApplicationScreeningAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      const existingIndex = nextAnswers.findIndex(
        (answer) => String(answer.question_id) === String(questionId)
      );
      const nextAnswer = {
        question_id: questionId,
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

  const handleApplySubmit = async (event) => {
    event.preventDefault();

    if (!selectedJob) {
      return;
    }

    if (!candidateCompletion.isReady) {
      setApplicationFeedback({
        type: 'error',
        message: 'Profil minimum belum siap. Lengkapi profil kandidat Anda terlebih dahulu.',
      });
      return;
    }

    try {
      const submittedAt = new Date().toISOString();

      await applyForJob(
        selectedJob.id,
        applicationCoverLetter.trim(),
        applicationScreeningAnswers,
        applicationVideoIntroUrl.trim()
      );

      setAppliedJobIds((currentIds) => new Set([...currentIds, Number(selectedJob.id)]));
      setApplicationFeedback({
        type: 'success',
        message: `Lamaran untuk ${selectedJob.title} berhasil dikirim.`,
      });
      setJobApplySuccessState({
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        companyName:
          selectedJob.recruiter?.company_name || selectedJob.recruiter?.name || 'Perusahaan',
        submittedAt,
        recommendations: buildSuccessRecommendations(filteredJobs, selectedJob.id),
      });
      setJobApplyStep(JOB_APPLY_TOTAL_STEPS);
    } catch (applyError) {
      setApplicationFeedback({
        type: 'error',
        message: applyError?.message || 'Lamaran belum berhasil dikirim.',
      });
    }
  };

  /**
   * Memindahkan kandidat ke halaman Lamaran Saya setelah proses apply selesai.
   */
  const handleOpenApplicationsAfterSuccess = React.useCallback(() => {
    const submittedJobTitle = jobApplySuccessState?.jobTitle || selectedJob?.title || 'lowongan ini';

    closeApplyModal();
    navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
      state: {
        candidateNotice: `Lamaran untuk ${submittedJobTitle} berhasil dikirim.`,
      },
    });
  }, [closeApplyModal, jobApplySuccessState?.jobTitle, navigate, selectedJob?.title]);

  const handleShareSelectedJob = React.useCallback(async () => {
    if (!selectedJob) {
      return;
    }

    const selectedJobCompanyNameForShare =
      selectedJob.recruiter?.company_name || selectedJob.recruiter?.name || 'Perusahaan';
    const shareTitle = `${selectedJob.title} • ${selectedJobCompanyNameForShare}`;
    const shareText = `Lihat lowongan ${selectedJob.title} dari ${selectedJobCompanyNameForShare}.`;
    const shareUrl =
      typeof window !== 'undefined' ? window.location.href : APP_ROUTES.jobs;

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
        return;
      }

      setApplicationFeedback({
        type: 'success',
        message: 'Detail lowongan siap dibagikan.',
      });
    } catch (shareError) {
      if (shareError?.name === 'AbortError') {
        return;
      }

      setApplicationFeedback({
        type: 'error',
        message: 'Lowongan belum berhasil dibagikan.',
      });
    }
  }, [selectedJob]);

  const filteredLocationGroups = React.useMemo(() => {
    const normalizedQuery = normalizeLocationKey(locationSearchQuery);

    if (!normalizedQuery) {
      return groupedLocationOptions;
    }

    return groupedLocationOptions
      .map((group) => ({
        province: group.province,
        options: group.options.filter((option) => {
          const searchableText = `${group.province} ${option.label} ${option.rawName}`.toLowerCase();
          return searchableText.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.options.length > 0);
  }, [groupedLocationOptions, locationSearchQuery]);

  const selectedLocationLabel = React.useMemo(() => {
    if (!selectedLocation) {
      return 'Semua Lokasi';
    }

    for (const group of groupedLocationOptions) {
      const matchingOption = group.options.find(
        (option) => normalizeLocationKey(option.value) === normalizeLocationKey(selectedLocation)
      );

      if (matchingOption) {
        return matchingOption.label;
      }
    }

    return selectedLocation;
  }, [groupedLocationOptions, selectedLocation]);

  const hasNearbyLocations = nearbyLocations.length > 0;
  const isLocationNoticePositive = hasNearbyLocations && !isDetectingLocation;
  const canUseCurrentLocation = availableLocations.length > 0 && !isDetectingLocation;
  const activeVideoScreeningLabel = formatVideoScreeningRequirement(
    selectedJob?.video_screening_requirement
  );
  const screeningQuestions = Array.isArray(selectedJob?.quiz_screening_questions)
    ? selectedJob.quiz_screening_questions
    : [];
  const candidateStrengths = React.useMemo(
    () => collectFilledStrings(candidateProfile.strengths, 3),
    [candidateProfile.strengths]
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
  const candidateAchievements = React.useMemo(
    () => collectFilledStrings(candidateProfile.achievements, 3),
    [candidateProfile.achievements]
  );
  const candidateResumeFiles = React.useMemo(
    () => collectFilledStrings(candidateProfile.resumeFiles, 3),
    [candidateProfile.resumeFiles]
  );
  const candidateCertificateFiles = React.useMemo(
    () => collectFilledStrings(candidateProfile.certificateFiles, 5),
    [candidateProfile.certificateFiles]
  );
  const profileReadyMessage = candidateCompletion.isReady
    ? 'Profil Anda sudah siap dipakai untuk mulai melamar.'
    : `Lengkapi ${candidateCompletion.missingRequiredItems.length} komponen inti agar bisa melamar.`;
  const hasActiveFilters = Boolean(
    filters.search ||
      filters.company_name ||
      filters.job_type ||
      filters.experience_level ||
      filters.salary_minimum ||
      filters.recent_only === '1' ||
      filters.saved_only === '1' ||
      selectedLocation
  );
  const filteredJobs = React.useMemo(() => {
    const visibleJobs = filterCandidateFacingJobs(jobs, filters, savedJobIds);

    return [...visibleJobs]
      .map((job) => ({
        ...job,
        recommendationScore: scoreJobForCandidate(job, candidateProfile),
      }))
      .sort((leftJob, rightJob) => {
        if (rightJob.recommendationScore !== leftJob.recommendationScore) {
          return rightJob.recommendationScore - leftJob.recommendationScore;
        }

        const rightCreatedAt = new Date(rightJob.created_at || 0).getTime();
        const leftCreatedAt = new Date(leftJob.created_at || 0).getTime();
        return rightCreatedAt - leftCreatedAt;
      })
      .map((job) => ({
        ...job,
        isRecommended: job.recommendationScore > 0,
        recommendationMatchLabel: buildRecommendationMatchLabel(job.recommendationScore),
      }));
  }, [candidateProfile, filters, jobs, savedJobIds]);
  const featuredJob = React.useMemo(() => filteredJobs[0] || null, [filteredJobs]);
  const remainingJobs = React.useMemo(() => {
    if (!featuredJob) {
      return filteredJobs;
    }

    return filteredJobs.filter((job) => Number(job.id) !== Number(featuredJob.id));
  }, [featuredJob, filteredJobs]);
  const selectedJobCompanyName =
    selectedJob?.recruiter?.company_name || selectedJob?.recruiter?.name || 'Perusahaan';
  const selectedJobRecruiterProfile = selectedJob?.recruiter?.recruiter_profile || {};
  const selectedJobCompanyVideoUrl = toYouTubeEmbedUrl(
    selectedJobRecruiterProfile.website || ''
  );
  const selectedJobSalaryLabel = selectedJob
    ? formatSalaryRangeLabel(selectedJob.salary_min, selectedJob.salary_max)
    : '-';
  const featuredJobSalaryLabel = featuredJob
    ? formatSalaryRangeLabel(featuredJob.salary_min, featuredJob.salary_max, true)
    : '';
  const featuredJobMetaChips = React.useMemo(
    () =>
      featuredJob
        ? [
            featuredJob.location,
            formatExperienceChip(featuredJob.experience_level),
            formatWorkMode(featuredJob.work_mode),
          ].filter(Boolean)
        : [],
    [featuredJob]
  );
  const selectedJobFocusChips = React.useMemo(() => {
    const focusSource = Array.isArray(selectedJobRecruiterProfile.hiringFocus)
      ? selectedJobRecruiterProfile.hiringFocus
      : [selectedJobRecruiterProfile.hiringFocus];

    const focusItems = collectFilledStrings(focusSource, 4);

    if (focusItems.length > 0) {
      return focusItems;
    }

    return [
      selectedJob?.category ? String(selectedJob.category).replace(/[-_]+/g, ' ') : '',
      formatExperienceChip(selectedJob?.experience_level),
      formatJobType(selectedJob?.job_type),
      formatWorkMode(selectedJob?.work_mode),
    ].filter(Boolean);
  }, [
    selectedJob?.category,
    selectedJob?.experience_level,
    selectedJob?.job_type,
    selectedJob?.work_mode,
    selectedJobRecruiterProfile.hiringFocus,
  ]);
  const selectedJobQualifications = React.useMemo(() => {
    const qualificationItems = [
      ...selectedJobFocusChips,
      ...buildSentenceList(selectedJob?.description || '', 4),
    ].filter(Boolean);

    if (qualificationItems.length > 0) {
      return qualificationItems.slice(0, 5);
    }

    return [
      `Level pengalaman ${formatExperienceChip(selectedJob?.experience_level)}.`,
      `Tipe kerja ${formatJobType(selectedJob?.job_type)} dengan pola ${formatWorkMode(selectedJob?.work_mode)}.`,
      selectedJob?.location
        ? `Penempatan utama di ${selectedJob.location}.`
        : 'Penempatan mengikuti kebutuhan recruiter.',
    ];
  }, [
    selectedJob?.description,
    selectedJob?.experience_level,
    selectedJob?.job_type,
    selectedJob?.location,
    selectedJob?.work_mode,
    selectedJobFocusChips,
  ]);
  const selectedJobQuestionPreview = React.useMemo(() => {
    if (screeningQuestions.length > 0) {
      return screeningQuestions.slice(0, 4).map((question) => ({
        title: question.question,
        meta: Array.isArray(question.answers) && question.answers.length > 0
          ? `${question.answers.length} pilihan jawaban`
          : 'Jawaban naratif singkat',
      }));
    }

    return [
      {
        title: 'Berapa gaji bulanan yang Anda inginkan?',
        meta: 'Ekspektasi kompensasi',
      },
      {
        title: 'Kualifikasi mana yang paling kuat dari profil Anda?',
        meta: 'Kecocokan inti',
      },
      {
        title: 'Berapa tahun pengalaman yang paling relevan?',
        meta: 'Riwayat pengalaman',
      },
      {
        title: 'Tool kerja apa yang paling sering Anda gunakan?',
        meta: 'Workflow harian',
      },
    ];
  }, [screeningQuestions]);
  const selectedJobBenefitCards = React.useMemo(
    () => [
      {
        kicker: 'Penempatan',
        title: formatWorkMode(selectedJob?.work_mode),
        description: selectedJob?.location
          ? `Lokasi prioritas ${selectedJob.location}.`
          : 'Lokasi mengikuti kebutuhan perusahaan.',
      },
      {
        kicker: 'Proses seleksi',
        title: selectedJob?.interview_type
          ? formatInterviewType(selectedJob.interview_type)
          : 'Mengikuti recruiter',
        description: activeVideoScreeningLabel || 'Tidak ada kewajiban video tambahan.',
      },
      {
        kicker: 'Kebutuhan tim',
        title:
          Number(selectedJob?.openings_count) > 0
            ? `${selectedJob.openings_count} posisi`
            : 'Lowongan aktif',
        description:
          formatJobCountdownLabel(selectedJob) || 'Masih menerima kandidat yang relevan.',
      },
    ],
    [
      activeVideoScreeningLabel,
      selectedJob?.interview_type,
      selectedJob?.location,
      selectedJob?.openings_count,
      selectedJob?.work_mode,
      selectedJob,
    ]
  );
  const selectedJobCandidateName = candidateProfile.fullName || user?.name || 'Pelamar';
  const selectedJobStoryPublishedLabel = React.useMemo(
    () => formatJobStoryDate(selectedJob?.created_at),
    [selectedJob?.created_at]
  );
  const selectedJobStoryMetaItems = React.useMemo(
    () =>
      [
        {
          value: selectedJob?.location || selectedJobRecruiterProfile.companyLocation || 'Indonesia',
          label: 'Lokasi penempatan',
        },
        {
          value: `${formatJobType(selectedJob?.job_type)} • ${formatWorkMode(selectedJob?.work_mode)}`,
          label: 'Skema kerja',
        },
        {
          value: selectedJob?.interview_type
            ? formatInterviewType(selectedJob.interview_type)
            : 'Mengikuti recruiter',
          label: 'Proses interview',
        },
        {
          value: selectedJobSalaryLabel,
          label: 'Competitive salary',
        },
      ].filter((item) => item.value),
    [
      selectedJob?.interview_type,
      selectedJob?.job_type,
      selectedJob?.location,
      selectedJob?.work_mode,
      selectedJobRecruiterProfile.companyLocation,
      selectedJobSalaryLabel,
    ]
  );
  const selectedJobStoryCultureChips = React.useMemo(() => {
    const chipPool = [
      ...selectedJobFocusChips,
      formatJobType(selectedJob?.job_type),
      formatWorkMode(selectedJob?.work_mode),
      formatExperienceChip(selectedJob?.experience_level),
    ].filter(Boolean);

    return [...new Set(chipPool)].slice(0, 4);
  }, [
    selectedJob?.experience_level,
    selectedJob?.job_type,
    selectedJob?.work_mode,
    selectedJobFocusChips,
  ]);
  const selectedJobStoryQuote =
    buildDescriptionPreview(
      selectedJobRecruiterProfile.companyDescription ||
        selectedJob?.description ||
        'Lowongan ini dirancang untuk kandidat yang siap tumbuh bersama tim yang tepat.',
      220
    ) || 'Lowongan ini dirancang untuk kandidat yang siap tumbuh bersama tim yang tepat.';
  const hasExtraApplicationRequirements =
    screeningQuestions.length > 0 || Boolean(selectedJob?.video_screening_requirement);
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
    selectedJob?.video_screening_requirement === 'required' &&
    !applicationVideoIntroUrl.trim();
  const isScreeningStepIncomplete =
    unansweredRequiredScreeningCount > 0 || isRequiredVideoMissing;
  const isSuccessStep = jobApplyStep === JOB_APPLY_TOTAL_STEPS;
  const isDetailStoryStep = !isSuccessStep && jobApplyStep === 1;
  const nextApplyStepFromDetail = hasExtraApplicationRequirements ? 2 : 3;
  const selectedJobSuccessRecommendations =
    jobApplySuccessState?.recommendations || buildSuccessRecommendations(filteredJobs, selectedJob?.id);
  const jobApplyStepSummary =
    jobApplyStep === 1
      ? {
          label: 'Periksa detail lowongan',
          description:
            'Pahami isi lowongan, kecocokan profil, dan ekspektasi recruiter sebelum mulai melamar.',
        }
      : jobApplyStep === 2
        ? {
            label: 'Jawab kebutuhan recruiter',
            description: hasExtraApplicationRequirements
              ? 'Jawab pertanyaan screening dan siapkan video jika lowongan memintanya.'
              : 'Lowongan ini tidak meminta pertanyaan tambahan. Anda bisa langsung lanjut ke review.',
          }
        : jobApplyStep === 3
          ? {
              label: 'Review sebelum kirim',
              description:
                'Tambahkan catatan singkat untuk recruiter, lalu kirim hanya saat semua detail sudah yakin.',
            }
          : {
              label: 'Lamaran berhasil dikirim',
              description:
                'Gunakan langkah berikutnya untuk memantau status dan melanjutkan proses kandidat Anda.',
            };

  return (
    <div className="job-list-page">
      <div className="filter-section" data-reveal data-reveal-delay="40ms">
        <h2>Filter Lowongan Kerja</h2>

        {user?.role === 'candidate' && (
          <div
            className={`candidate-readiness-banner${
              candidateCompletion.isReady ? ' is-ready' : ' is-incomplete'
            }`}
          >
            <strong>{candidateCompletion.isReady ? 'Siap melamar' : 'Profil belum siap'}</strong>
            <p>{profileReadyMessage}</p>
            <button
              type="button"
              className="candidate-readiness-link"
              onClick={() => navigate(`${APP_ROUTES.candidateDashboard}#profile`)}
            >
              Buka Profil Siap Lamar
            </button>
          </div>
        )}

        {!isSecurityBannerDismissed && (
          <div className="job-security-banner">
            <div className="job-security-banner-head">
              <strong>Waspada penipuan lowongan</strong>
              <button
                type="button"
                className="job-security-banner-close"
                onClick={() => setIsSecurityBannerDismissed(true)}
                aria-label="Tutup peringatan keamanan"
              >
                ×
              </button>
            </div>
            <p>
              Jangan kirim uang, OTP, atau data sensitif di luar alur resmi KerjaNusa. Jika ada hal
              mencurigakan, gunakan chat dengan recruiter atau superadmin dari dalam platform.
            </p>
          </div>
        )}

        <div className="filter-group">
          <input
            type="text"
            name="search"
            placeholder="Cari nama pekerjaan..."
            value={filters.search ?? ''}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <input
            type="text"
            name="company_name"
            placeholder="Cari nama perusahaan..."
            value={filters.company_name ?? ''}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-actions">
          <button
            type="button"
            className="filter-reset-button"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
          >
            Reset Filter
          </button>
        </div>

        <div className="filter-row">
          <div className="filter-location-group" ref={locationDropdownRef}>
            <button
              type="button"
              className={`location-dropdown-trigger${
                isLocationDropdownOpen ? ' is-open' : ''
              }${selectedLocation ? ' has-selection' : ''}`}
              aria-expanded={isLocationDropdownOpen}
              onClick={() => {
                const nextValue = !isLocationDropdownOpen;
                setIsLocationDropdownOpen(nextValue);

                if (nextValue) {
                  ensureLocationOptionsLoaded();
                }
              }}
            >
              <span className="location-dropdown-trigger-label">{selectedLocationLabel}</span>
              <span className="location-dropdown-trigger-icon" aria-hidden="true">
                ⌄
              </span>
            </button>

            {isLocationDropdownOpen && (
              <div className="location-dropdown-menu">
                <div className="location-dropdown-search">
                  <input
                    type="text"
                    className="location-dropdown-search-input"
                    placeholder="Cari kota / kabupaten..."
                    value={locationSearchQuery}
                    onChange={(event) => setLocationSearchQuery(event.target.value)}
                    autoFocus
                  />
                </div>

                <div className="location-dropdown-options">
                  <button
                    type="button"
                    className={`location-dropdown-option${
                      selectedLocation === '' ? ' active' : ''
                    }`}
                    onClick={handleLocationClear}
                  >
                    Semua Lokasi
                  </button>

                  {filteredLocationGroups.map((group) => (
                    <div key={group.province} className="location-dropdown-group">
                      <p className="location-dropdown-group-label">{group.province}</p>
                      <div className="location-dropdown-group-list">
                        {group.options.map((option) => (
                          <button
                            key={`${group.province}-${option.rawName}`}
                            type="button"
                            className={`location-dropdown-option${
                              normalizeLocationKey(selectedLocation) ===
                              normalizeLocationKey(option.value)
                                ? ' active'
                                : ''
                            }`}
                            onClick={() => handleLocationSelect(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredLocationGroups.length === 0 && (
                    <p className="location-dropdown-empty">
                      {isLoadingLocationOptions
                        ? 'Memuat daftar lokasi...'
                        : 'Lokasi tidak ditemukan.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              className="location-trigger-button"
              onClick={handleUseCurrentLocation}
              disabled={!canUseCurrentLocation}
            >
              {isDetectingLocation ? 'Mencari lokasi terdekat...' : 'Gunakan lokasi perangkat'}
            </button>

            {locationNotice && (
              <p
                className={`location-notice${
                  isLocationNoticePositive ? ' location-notice-success' : ''
                }`}
              >
                {locationNotice}
              </p>
            )}

            {hasNearbyLocations && (
              <div className="nearby-location-list">
                {nearbyLocations.map((location) => (
                  <button
                    key={location.name}
                    type="button"
                    className={`nearby-location-chip${
                      selectedLocation === location.name ? ' active' : ''
                    }`}
                    onClick={() => handleNearbyLocationPick(location.name)}
                  >
                    <strong>{location.name}</strong>
                    <span>{location.distanceLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            className="filter-control"
            name="job_type"
            value={filters.job_type ?? ''}
            onChange={handleFilterChange}
          >
            <option value="">Semua Tipe</option>
            <option value="full-time">Fulltime / Tetap</option>
            <option value="part-time">Magang / Paruh waktu</option>
            <option value="contract">Kontrak</option>
            <option value="freelance">Freelance</option>
          </select>

          <select
            className="filter-control"
            name="experience_level"
            value={filters.experience_level ?? ''}
            onChange={handleFilterChange}
          >
            <option value="">Semua Level</option>
            <option value="entry">Entry Level (Freshgraduate)</option>
            <option value="junior">Junior Level (1 - 3 tahun)</option>
            <option value="mid">Mid Level (3 - 5 tahun)</option>
            <option value="senior">Senior Level (5 + tahun)</option>
          </select>

          <select
            className="filter-control"
            name="salary_minimum"
            value={filters.salary_minimum ?? ''}
            onChange={handleFilterChange}
          >
            {SALARY_FILTER_OPTIONS.map((option) => (
              <option key={`salary-filter-${option.value || 'all'}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`filter-saved-toggle${filters.saved_only === '1' ? ' is-active' : ''}`}
            onClick={() => updateFilter('saved_only', filters.saved_only === '1' ? '' : '1')}
          >
            {filters.saved_only === '1' ? 'Tampilkan semua peluang' : 'Hanya lowongan tersimpan'}
          </button>

          <button
            type="button"
            className={`filter-saved-toggle${filters.recent_only === '1' ? ' is-active' : ''}`}
            onClick={() => updateFilter('recent_only', filters.recent_only === '1' ? '' : '1')}
          >
            {filters.recent_only === '1' ? 'Tampilkan semua lowongan' : 'Hanya loker terbaru'}
          </button>
        </div>
      </div>

      <div className="jobs-section">
        <div className="job-results-hero" data-reveal data-reveal-delay="40ms">
          <span className="job-results-kicker">Lowongan rekomendasi</span>
          <h1>Prioritas lowongan untuk Anda</h1>
          <p>
            {user?.role === 'candidate'
              ? 'Rekomendasi disusun dari posisi incaran, lokasi minat, dan skill utama yang sudah Anda simpan di profil.'
              : 'KerjaNusa menampilkan peluang aktif yang paling relevan lebih dulu agar proses melamar terasa lebih fokus.'}
          </p>

          {(candidatePreferredRoles[0] || candidatePreferredLocations[0] || candidateSkills[0]) && (
            <div className="job-results-context">
              {candidatePreferredRoles[0] && (
                <span className="job-results-context-chip">
                  Role incaran: {candidatePreferredRoles[0]}
                </span>
              )}
              {candidatePreferredLocations[0] && (
                <span className="job-results-context-chip">
                  Lokasi minat: {candidatePreferredLocations[0]}
                </span>
              )}
              {candidateSkills[0] && (
                <span className="job-results-context-chip">
                  Skill utama: {candidateSkills[0]}
                </span>
              )}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="loading" data-reveal>
            Memuat...
          </div>
        )}
        {error && (
          <div className="error" data-reveal>
            {error}
          </div>
        )}

        {!isLoading && filteredJobs.length === 0 && (
          <div className="no-results" data-reveal>
            Tidak ada peluang kerja yang cocok dengan filter Anda
          </div>
        )}

        {!isLoading && featuredJob && (
          <article className="job-featured-card" data-reveal data-reveal-delay="80ms">
            <div className="job-featured-card-header">
              <div className="job-featured-brand">
                <div className="job-featured-badge" aria-hidden="true">
                  {buildCompanyInitials(
                    featuredJob.recruiter?.company_name || featuredJob.recruiter?.name
                  )}
                </div>
                <div className="job-featured-brand-copy">
                  <h2>{featuredJob.title}</h2>
                  <p>
                    {featuredJob.recruiter?.company_name ||
                      featuredJob.recruiter?.name ||
                      'Perusahaan'}
                  </p>
                </div>
              </div>

              {featuredJob.recommendationMatchLabel && (
                <span className="job-featured-match">{featuredJob.recommendationMatchLabel}</span>
              )}
            </div>

            <div className="job-featured-pill-row">
              {featuredJobMetaChips.map((item) => (
                <span key={`featured-job-${featuredJob.id}-${item}`} className="job-featured-pill">
                  {item}
                </span>
              ))}
            </div>

            <p className="job-featured-description">
              {buildDescriptionPreview(featuredJob.description, 190) ||
                'Peluang ini dipilih paling dekat dengan minat kandidat dan kesiapan profil Anda.'}
            </p>

            <div className="job-featured-footer">
              <div className="job-featured-salary">
                <span className="job-featured-salary-label">Estimasi gaji</span>
                <strong>{featuredJobSalaryLabel}</strong>
              </div>

              <button type="button" className="btn btn-primary" onClick={() => handleApply(featuredJob)}>
                {appliedJobIds.has(Number(featuredJob.id)) ? 'Lihat Status Lamaran' : 'Buka & Lamar'}
              </button>
            </div>
          </article>
        )}

        {!isLoading && remainingJobs.length > 0 && (
          <div className="job-results-subhead" data-reveal data-reveal-delay="120ms">
            <strong>Lowongan lainnya</strong>
            <span>
              Peluang tambahan di bawah ini tetap aktif dan bisa langsung Anda buka untuk melamar.
            </span>
          </div>
        )}

        <div className="jobs-grid">
          {remainingJobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={{
                ...job,
                closingCountdownLabel: formatJobCountdownLabel(job),
              }}
              index={index}
              onApply={handleApply}
              onToggleSave={handleSavedJobToggle}
              isSaved={savedJobIds.has(Number(job.id))}
              actionLabel={
                appliedJobIds.has(Number(job.id)) ? 'Lihat Status Lamaran' : 'Buka & Lamar'
              }
              actionVariant={appliedJobIds.has(Number(job.id)) ? 'outline' : 'primary'}
            />
          ))}
        </div>

        {pagination && pagination.last_page > 1 && (
          <div className="pagination" data-reveal>
            {Array.from({ length: pagination.last_page }).map((_, index) => (
              <button
                key={index + 1}
                className={`page-btn ${currentPage === index + 1 ? 'active' : ''}`}
                onClick={() => setCurrentPage(index + 1)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <div
          className={`job-apply-modal-backdrop${isDetailStoryStep ? ' is-story-step' : ''}`}
          role="presentation"
          onClick={closeApplyModal}
        >
          <div
            className={`job-apply-modal${isDetailStoryStep ? ' is-story-step' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-apply-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            {isDetailStoryStep ? (
              <div className="job-apply-modal-header job-apply-modal-header-story">
                <button
                  type="button"
                  className="job-apply-story-topbar-button"
                  onClick={closeApplyModal}
                  aria-label="Kembali ke Lowongan Kerja"
                >
                  ←
                </button>
                <div className="job-apply-story-topbar-copy">
                  <span>Detail lowongan</span>
                  <strong id="job-apply-modal-title">{selectedJob.title}</strong>
                </div>
                <button
                  type="button"
                  className="job-apply-story-topbar-button"
                  onClick={handleShareSelectedJob}
                  aria-label="Bagikan lowongan"
                >
                  ↗
                </button>
              </div>
            ) : (
              <div className="job-apply-modal-header">
                <div>
                  <span className="job-apply-step-index">
                    {isSuccessStep
                      ? 'Lamaran terkirim'
                      : `Tahap ${jobApplyStep} dari ${JOB_APPLY_TOTAL_STEPS - 1}`}
                  </span>
                  <strong id="job-apply-modal-title">
                    {isSuccessStep
                      ? 'Lamaran Berhasil'
                      : jobApplyStep === 1
                        ? 'Detail Lowongan Kerja'
                        : 'Quick Apply'}
                  </strong>
                  <p>
                    {jobApplyStep === 1
                      ? `${selectedJobCompanyName} • ${selectedJob.title}`
                      : `${jobApplyStepSummary.label} • ${selectedJob.title}`}
                  </p>
                  <small className="job-apply-step-description">
                    {jobApplyStepSummary.description}
                  </small>
                </div>
                <button type="button" className="job-apply-modal-close" onClick={closeApplyModal}>
                  ×
                </button>
              </div>
            )}

            {!isSuccessStep && jobApplyStep > 1 && (
              <div className="job-apply-step-tabs" aria-label="Tahapan melamar">
                {[1, 2, 3].map((step) => (
                  <button
                    key={`job-apply-step-${step}`}
                    type="button"
                    className={`job-apply-step-tab${
                      jobApplyStep === step ? ' is-active' : ''
                    }${jobApplyStep > step ? ' is-done' : ''}`}
                    onClick={() => setJobApplyStep(step)}
                  >
                    <span>{step}</span>
                    <strong>
                      {step === 1
                        ? 'Profil'
                        : step === 2
                          ? 'Screening'
                          : 'Review'}
                    </strong>
                  </button>
                ))}
              </div>
            )}

            <form
              className={`job-apply-form${isDetailStoryStep ? ' is-story-step' : ''}`}
              onSubmit={handleApplySubmit}
            >
              {jobApplyStep === 1 && (
                <div className="job-apply-story-shell">
                  <section className="job-apply-story-hero">
                    <div className="job-apply-story-cover">
                      <div className="job-apply-story-cover-card">
                        <span className="job-apply-story-cover-eyebrow">
                          {String(selectedJobCompanyName).toUpperCase()}
                        </span>
                        <strong>{selectedJob.category || 'Career Opportunity'}</strong>
                        <small>
                          {formatJobType(selectedJob.job_type)} •{' '}
                          {formatWorkMode(selectedJob.work_mode)}
                        </small>
                      </div>
                      <div className="job-apply-company-badge" aria-hidden="true">
                        {buildCompanyInitials(selectedJobCompanyName)}
                      </div>
                    </div>

                    <div className="job-apply-story-hero-copy">
                      <h3 className="job-apply-hero-title">{selectedJob.title}</h3>
                      <p className="job-apply-hero-company">{selectedJobCompanyName}</p>

                      <div className="job-apply-story-chip-row">
                        <span className="job-apply-story-chip">
                          {formatExperienceChip(selectedJob.experience_level)}
                        </span>
                        <span className="job-apply-story-chip">
                          {formatWorkMode(selectedJob.work_mode)}
                        </span>
                        <span className="job-apply-story-chip">
                          {selectedJob.recommendationMatchLabel || 'No exact match'}
                        </span>
                      </div>

                      <div className="job-apply-story-meta-list">
                        {selectedJobStoryMetaItems.map((item) => (
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
                      <span>{selectedJobStoryPublishedLabel}</span>
                      <strong>{formatJobCountdownLabel(selectedJob) || 'Masih dibuka'}</strong>
                    </div>

                    <div className="job-apply-quote-card job-apply-quote-card-story">
                      <p>"{selectedJobStoryQuote}"</p>
                    </div>

                    <section className="job-apply-story-section">
                      <div className="job-apply-story-heading">
                        <strong>Keterampilan dan Kualifikasi</strong>
                      </div>

                      <ul className="job-apply-story-bullet-list">
                        {selectedJobQualifications.map((item, index) => (
                          <li key={`job-qualification-${index}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </section>

                    <section className="job-apply-story-question-panel">
                      <div className="job-apply-story-question-heading">
                        <strong>Employer questions</strong>
                        <p>
                          Jawaban Anda akan ikut terkirim untuk membantu recruiter memahami
                          kesiapan dan ritme kerja Anda.
                        </p>
                      </div>

                      <div className="job-apply-question-list">
                        {selectedJobQuestionPreview.map((item, index) => (
                          <article
                            key={`job-question-preview-${index}`}
                            className="job-apply-question-card"
                          >
                            <small>{`Pertanyaan ${index + 1}`}</small>
                            <strong>{item.title}</strong>
                            <span>{item.meta}</span>
                          </article>
                        ))}
                      </div>

                      <div className="job-apply-story-question-tags">
                        {selectedJobQuestionPreview.map((item, index) => (
                          <span key={`question-tag-${index}-${item.meta}`}>
                            {item.meta || `Prompt ${index + 1}`}
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="job-apply-story-section">
                      <div className="job-apply-story-heading">
                        <strong>Manfaat Utama</strong>
                      </div>

                      <div className="job-apply-benefit-grid">
                        {selectedJobBenefitCards.map((item) => (
                          <article key={item.kicker} className="job-apply-benefit-card">
                            <span>{item.kicker}</span>
                            <strong>{item.title}</strong>
                            <p>{item.description}</p>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="job-apply-story-section job-apply-story-about-card">
                      <div className="job-apply-story-heading">
                        <strong>Tentang Kami</strong>
                        <span>{selectedJobCompanyName}</span>
                      </div>

                      <p className="job-apply-company-copy">
                        {selectedJobRecruiterProfile.companyDescription ||
                          buildDescriptionPreview(selectedJob.description, 260) ||
                          'Recruiter akan menjelaskan kultur kerja dan detail tim pada tahap seleksi berikutnya.'}
                      </p>

                      <div className="job-apply-story-question-tags job-apply-story-culture-tags">
                        {selectedJobStoryCultureChips.map((item) => (
                          <span key={`job-focus-chip-${item}`}>{item}</span>
                        ))}
                      </div>

                      <div className="job-apply-visual-card job-apply-visual-card-story">
                        <div className="job-apply-visual-stage" aria-hidden="true">
                          <span className="job-apply-visual-window" />
                          <span className="job-apply-visual-desk" />
                        </div>
                        <div className="job-apply-visual-plaque">
                          <strong>{selectedJobRecruiterProfile.contactRole || 'Hiring team'}</strong>
                          <span>
                            {selectedJobRecruiterProfile.companyLocation ||
                              selectedJob.location ||
                              'Indonesia'}
                          </span>
                        </div>
                      </div>

                      {selectedJobRecruiterProfile.website && (
                        <a
                          className="job-apply-company-link"
                          href={selectedJobRecruiterProfile.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Buka company profile
                        </a>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {jobApplyStep === 2 && (
                <>
                  <div className="job-apply-profile-summary">
                    <strong>Jawab screening recruiter</strong>
                    <p className="job-apply-company-copy">
                      Lengkapi pertanyaan HR dan video screening bila lowongan ini memintanya.
                    </p>
                  </div>

                  {activeVideoScreeningLabel && (
                    <p className="job-apply-video-screening-note">
                      {activeVideoScreeningLabel}
                    </p>
                  )}

                  {screeningQuestions.length > 0 ? (
                    <div className="job-apply-screening-stack">
                      <strong>Pertanyaan screening</strong>
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
                        Recruiter tidak menambahkan kuis screening. Anda bisa lanjut ke review
                        akhir.
                      </p>
                    </div>
                  )}

                  {selectedJob?.video_screening_requirement && (
                    <label className="job-apply-field">
                      <span>
                        Link video screening
                        {selectedJob.video_screening_requirement === 'required'
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
                  )}

                  {isScreeningStepIncomplete && (
                    <p className="job-apply-feedback job-apply-feedback-error">
                      {unansweredRequiredScreeningCount > 0
                        ? `Masih ada ${unansweredRequiredScreeningCount} pertanyaan wajib yang belum dijawab.`
                        : 'Link video screening wajib masih kosong.'}
                    </p>
                  )}
                </>
              )}

              {jobApplyStep === 3 && (
                <>
                  <div className="job-apply-profile-summary">
                    <strong>Review singkat sebelum kirim</strong>
                    <div className="job-apply-profile-grid">
                      <span>Perusahaan: {selectedJobCompanyName}</span>
                      <span>Posisi: {selectedJob.title}</span>
                      <span>CV utama: {candidateResumeFiles[0] || 'Belum ada CV tersimpan'}</span>
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
                        Lowongan tersimpan:{' '}
                        {savedJobIds.has(Number(selectedJob.id)) ? 'Ya' : 'Belum'}
                      </span>
                    </div>
                  </div>

                  <label className="job-apply-field">
                    <span>Catatan singkat untuk recruiter</span>
                    <textarea
                      rows="4"
                      placeholder="Tulis motivasi singkat atau informasi pendukung lain untuk recruiter."
                      value={applicationCoverLetter}
                      onChange={(event) => setApplicationCoverLetter(event.target.value)}
                    />
                    <small>
                      Anda bisa menjelaskan motivasi melamar, kesiapan kerja, atau konteks singkat
                      yang belum tertangkap dari CV.
                    </small>
                  </label>

                  <div className="job-apply-profile-summary">
                    <strong>Checklist sebelum kirim</strong>
                    <div className="job-apply-chip-wrap">
                      <span className="job-apply-chip">
                        {candidateCompletion.isReady
                          ? 'Profil kandidat siap'
                          : 'Profil kandidat belum lengkap'}
                      </span>
                      <span
                        className={`job-apply-chip${
                          screeningQuestions.length > 0
                            ? ' job-apply-chip-secondary'
                            : ' job-apply-chip-muted'
                        }`}
                      >
                        {screeningQuestions.length > 0
                          ? `${applicationScreeningAnswers.filter((item) => String(item.answer || '').trim()).length} jawaban screening terisi`
                          : 'Tidak ada pertanyaan screening'}
                      </span>
                      <span
                        className={`job-apply-chip${
                          applicationVideoIntroUrl.trim()
                            ? ' job-apply-chip-secondary'
                            : ' job-apply-chip-muted'
                        }`}
                      >
                        {applicationVideoIntroUrl.trim()
                          ? 'Video screening siap'
                          : 'Video screening belum ditautkan'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {isSuccessStep && (
                <div className="job-apply-success-stack">
                  <div className="job-apply-success-card">
                    <strong>Lamaran berhasil dikirim</strong>
                    <h3>{jobApplySuccessState?.jobTitle || selectedJob.title}</h3>
                    <p>
                      Hallo {selectedJobCandidateName}, berkas Anda berhasil terkirim ke{' '}
                      {jobApplySuccessState?.companyName || selectedJobCompanyName}. Pantau
                      statusnya di Lamaran Saya dan gunakan momen ini untuk melamar peluang
                      relevan lain.
                    </p>
                    <div className="job-apply-chip-wrap">
                      <span className="job-apply-chip">
                        Dikirim{' '}
                        {new Date(
                          jobApplySuccessState?.submittedAt || new Date().toISOString()
                        ).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <span className="job-apply-chip job-apply-chip-secondary">
                        Status awal: Menunggu review recruiter
                      </span>
                    </div>
                  </div>

                  {selectedJobSuccessRecommendations.length > 0 && (
                    <div className="job-apply-profile-summary">
                      <strong>Peluang lain yang masih sejalur</strong>
                      <div className="job-apply-success-grid">
                        {selectedJobSuccessRecommendations.map((job) => (
                          <article key={`apply-success-${job.id}`} className="job-apply-success-job-card">
                            <strong>{job.title}</strong>
                            <span>{job.recruiter?.company_name || job.recruiter?.name || 'Perusahaan'}</span>
                            <small>
                              {job.location || '-'} • {formatExperienceLevel(job.experience_level)}
                            </small>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleApply(job)}
                            >
                              Buka & Lamar
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {applicationFeedback && !isSuccessStep && (
                <p className={`job-apply-feedback job-apply-feedback-${applicationFeedback.type}`}>
                  {applicationFeedback.message}
                </p>
              )}

              <div
                className={`job-apply-actions${
                  isDetailStoryStep ? ' is-story-step' : ''
                }`}
              >
                {isSuccessStep ? (
                  <>
                    <div className="job-apply-actions-copy">
                      <strong>Lanjutkan momentum kandidat</strong>
                      <span>
                        Buka Lamaran Saya untuk memantau status terbaru, atau kembali melamar
                        peluang lain yang relevan.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleOpenApplicationsAfterSuccess}
                    >
                      Buka Lamaran Saya
                    </button>
                    <button type="button" className="btn btn-outline" onClick={closeApplyModal}>
                      Kembali ke lowongan
                    </button>
                  </>
                ) : jobApplyStep === 1 ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline job-apply-story-secondary-button"
                      onClick={() => handleSavedJobToggle(selectedJob.id)}
                    >
                      {savedJobIds.has(Number(selectedJob.id))
                        ? 'Saved'
                        : 'Save'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary job-apply-story-primary-button"
                      onClick={() => setJobApplyStep(nextApplyStepFromDetail)}
                    >
                      Quick Apply
                    </button>
                  </>
                ) : (
                  <>
                    <div className="job-apply-actions-copy">
                      <strong>
                        {jobApplyStep === 2
                          ? 'Lengkapi kebutuhan recruiter'
                          : 'Siap kirim?'}
                      </strong>
                      <span>
                        {jobApplyStep === 2
                          ? 'Gunakan jawaban singkat yang jujur dan kirim link video yang benar-benar bisa dibuka.'
                          : 'Pastikan Anda memakai email aktif dan tidak mengubah link reset atau video saat proses masih berjalan.'}
                      </span>
                    </div>

                    {jobApplyStep > 1 ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setJobApplyStep((currentValue) => Math.max(1, currentValue - 1))}
                      >
                        Kembali
                      </button>
                    ) : (
                      <button type="button" className="btn btn-outline" onClick={closeApplyModal}>
                        Tutup
                      </button>
                    )}

                    {jobApplyStep < 3 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={jobApplyStep === 2 && isScreeningStepIncomplete}
                        onClick={() => setJobApplyStep((currentValue) => Math.min(3, currentValue + 1))}
                      >
                        {jobApplyStep === 1 ? 'Lanjut ke screening' : 'Lanjut ke review'}
                      </button>
                    ) : (
                      <button type="submit" className="btn btn-primary" disabled={isApplying}>
                        {isApplying ? 'Mengirim...' : 'Kirim Lamaran'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobListPage;
