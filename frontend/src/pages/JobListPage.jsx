import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JobCard from '../components/JobCard.jsx';
import indonesiaLocationOptions from '../data/indonesiaLocationOptions.js';
import { getLocationCoordinates, normalizeLocationKey } from '../data/locationCoordinates.js';
import useApplications from '../hooks/useApplications.js';
import useAuth from '../hooks/useAuth.js';
import useJobs from '../hooks/useJobs';
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
import { APP_ROUTES, getDefaultRouteForRole } from '../utils/routeHelpers.js';
import {
  formatExperienceLevel,
  formatVideoScreeningRequirement,
} from '../utils/jobFormatters.js';
import '../styles/jobList.css';

const EARTH_RADIUS_IN_KILOMETERS = 6371;

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
  const locationDropdownRef = React.useRef(null);
  const hasRestoredApplyIntentRef = React.useRef(false);

  /**
   * Menyinkronkan daftar lowongan dengan kombinasi page dan filter yang sedang aktif.
   */
  useEffect(() => {
    fetchJobs(filters, currentPage);
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

    if (isLoading || isLoadingAppliedJobs) {
      return;
    }

    const matchingJob = jobs.find((job) => Number(job.id) === pendingApplyIntent.jobId);

    hasRestoredApplyIntentRef.current = true;

    if (!matchingJob) {
      clearCandidateApplyIntent();
      return;
    }

    if (appliedJobIds.has(pendingApplyIntent.jobId)) {
      clearCandidateApplyIntent();
      navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
        state: {
          candidateNotice: `Anda sudah pernah melamar ${matchingJob.title}. Cek status terbarunya di Lamaran Saya.`,
        },
      });
      return;
    }

    if (!candidateCompletion.isReady) {
      const missingPreview = candidateCompletion.missingRequiredItems.slice(0, 3).join(', ');

      clearCandidateApplyIntent();
      navigate(`${APP_ROUTES.candidateDashboard}#profile`, {
        state: {
          candidateNotice: `Lengkapi profil minimum terlebih dahulu sebelum melamar. Yang masih kurang: ${missingPreview}.`,
        },
      });
      return;
    }

    clearCandidateApplyIntent();
    setSelectedJob(matchingJob);
    setApplicationCoverLetter('');
    setApplicationScreeningAnswers(buildInitialScreeningAnswers(matchingJob));
    setApplicationVideoIntroUrl('');
    setApplicationFeedback(null);
  }, [
    appliedJobIds,
    candidateCompletion,
    isLoading,
    isLoadingAppliedJobs,
    jobs,
    navigate,
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
  }, []);

  const handleApply = React.useCallback(
    (job) => {
      if (!user) {
        saveCandidateApplyIntent({
          jobId: job.id,
          page: currentPage,
          filters: {
            ...filters,
            location: selectedLocation || filters.location || '',
          },
          selectedLocation: selectedLocation || filters.location || '',
        });
        navigate('/login?role=candidate');
        return;
      }

      if (user.role !== 'candidate') {
        navigate(getDefaultRouteForRole(user.role));
        return;
      }

      if (appliedJobIds.has(Number(job.id))) {
        navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
          state: {
            candidateNotice: `Anda sudah pernah melamar ${job.title}. Cek status terbarunya di Lamaran Saya.`,
          },
        });
        return;
      }

      if (!candidateCompletion.isReady) {
        const missingPreview = candidateCompletion.missingRequiredItems.slice(0, 3).join(', ');

        navigate(`${APP_ROUTES.candidateDashboard}#profile`, {
          state: {
            candidateNotice: `Lengkapi profil minimum terlebih dahulu sebelum melamar. Yang masih kurang: ${missingPreview}.`,
          },
        });
        return;
      }

      setSelectedJob(job);
      setApplicationCoverLetter('');
      setApplicationScreeningAnswers(buildInitialScreeningAnswers(job));
      setApplicationVideoIntroUrl('');
      setApplicationFeedback(null);
    },
    [appliedJobIds, candidateCompletion, currentPage, filters, navigate, selectedLocation, user]
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
      await applyForJob(
        selectedJob.id,
        applicationCoverLetter.trim(),
        applicationScreeningAnswers,
        applicationVideoIntroUrl.trim()
      );
      setAppliedJobIds((currentIds) => new Set([...currentIds, Number(selectedJob.id)]));
      closeApplyModal();
      navigate(`${APP_ROUTES.candidateDashboard}#applications`, {
        state: {
          candidateNotice: `Lamaran untuk ${selectedJob.title} berhasil dikirim.`,
        },
      });
    } catch (applyError) {
      setApplicationFeedback({
        type: 'error',
        message: applyError?.message || 'Lamaran belum berhasil dikirim.',
      });
    }
  };

  const groupedLocationOptions = indonesiaLocationOptions;

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
  const profileReadyMessage = candidateCompletion.isReady
    ? 'Profil Anda sudah siap dipakai untuk apply instan.'
    : `Lengkapi ${candidateCompletion.missingRequiredItems.length} komponen inti agar bisa melamar.`;
  const hasActiveFilters = Boolean(
    filters.search || filters.job_type || filters.experience_level || selectedLocation
  );

  return (
    <div className="job-list-page">
      <div className="filter-section" data-reveal data-reveal-delay="40ms">
        <h2>Filter Lowongan</h2>

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
              Buka profil kandidat
            </button>
          </div>
        )}

        <div className="job-security-banner">
          <strong>Keamanan KerjaNusa</strong>
          <p>
            Waspadai lowongan kerja penipuan. Jangan kirim uang, OTP, atau data sensitif di luar
            alur resmi KerjaNusa. Jika ada hal mencurigakan, gunakan chat dengan recruiter atau
            superadmin dari dalam platform.
          </p>
        </div>

        <div className="filter-group">
          <input
            type="text"
            name="search"
            placeholder="Cari pekerjaan..."
            value={filters.search ?? ''}
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
              onClick={() => setIsLocationDropdownOpen((currentValue) => !currentValue)}
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
                    <p className="location-dropdown-empty">Lokasi tidak ditemukan.</p>
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
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
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
        </div>
      </div>

      <div className="jobs-section">
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

        {!isLoading && jobs.length === 0 && (
          <div className="no-results" data-reveal>
            Tidak ada lowongan ditemukan
          </div>
        )}

        <div className="jobs-grid">
          {jobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              index={index}
              onApply={handleApply}
              actionLabel={
                appliedJobIds.has(Number(job.id)) ? 'Lihat Status Lamaran' : 'Lamar Sekarang'
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
        <div className="job-apply-modal-backdrop" role="presentation" onClick={closeApplyModal}>
          <div
            className="job-apply-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-apply-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="job-apply-modal-header">
              <div>
                <strong id="job-apply-modal-title">Lamar Lowongan</strong>
                <p>
                  {selectedJob.title} • {formatExperienceLevel(selectedJob.experience_level)}
                </p>
              </div>
              <button type="button" className="job-apply-modal-close" onClick={closeApplyModal}>
                ×
              </button>
            </div>

            <form className="job-apply-form" onSubmit={handleApplySubmit}>
              <div className="job-apply-profile-summary">
                <strong>Lamaran akan memakai profil kandidat yang sudah disimpan</strong>
                <div className="job-apply-profile-grid">
                  <span>Nama: {candidateProfile.fullName || user?.name || '-'}</span>
                  <span>Telepon: {candidateProfile.phone || user?.phone || '-'}</span>
                  <span>
                    Posisi incaran: {candidateProfile.preferredRoles.find((item) => item.trim()) || '-'}
                  </span>
                  <span>
                    Lokasi minat:{' '}
                    {candidateProfile.preferredLocations.find((item) => item.trim()) || '-'}
                  </span>
                  <span>CV tersimpan: {candidateProfile.resumeFiles[0] || 'Belum ada'}</span>
                  <span>Skill utama: {candidateProfile.skills.find((item) => item.trim()) || '-'}</span>
                </div>
              </div>

              {activeVideoScreeningLabel && (
                <p className="job-apply-video-screening-note">{activeVideoScreeningLabel}</p>
              )}

              {screeningQuestions.length > 0 && (
                <div className="job-apply-screening-stack">
                  <strong>Pertanyaan screening</strong>
                  {screeningQuestions.map((question) => {
                    const currentAnswer =
                      applicationScreeningAnswers.find(
                        (answer) => String(answer.question_id) === String(question.id)
                      )?.answer || '';

                    return (
                      <div key={question.id} className="job-apply-screening-card">
                        <span>{question.question}</span>
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
                </label>
              )}

              <label className="job-apply-field">
                <span>Catatan singkat</span>
                <textarea
                  rows="4"
                  placeholder="Tulis motivasi singkat atau informasi pendukung lain untuk recruiter."
                  value={applicationCoverLetter}
                  onChange={(event) => setApplicationCoverLetter(event.target.value)}
                />
              </label>

              {applicationFeedback && (
                <p className={`job-apply-feedback job-apply-feedback-${applicationFeedback.type}`}>
                  {applicationFeedback.message}
                </p>
              )}

              <div className="job-apply-actions">
                <button type="button" className="btn btn-outline" onClick={closeApplyModal}>
                  Kembali
                </button>
                <button type="submit" className="btn btn-primary" disabled={isApplying}>
                  {isApplying ? 'Mengirim...' : 'Kirim Lamaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobListPage;
