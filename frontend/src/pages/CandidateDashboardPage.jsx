import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import InboxWorkspace from '../components/InboxWorkspace.jsx';
import locationCoordinates from '../data/locationCoordinates.js';
import useApplications from '../hooks/useApplications.js';
import useAuth from '../hooks/useAuth.js';
import useChat from '../hooks/useChat.js';
import useJobs from '../hooks/useJobs.js';
import {
  formatCandidateApplicationStatus,
  formatCandidateCareerStage,
  getCandidateApplicationMeta,
  getCandidateApplicationTimeline,
  getCandidateProfileCompletion,
  getCandidateProfileStatusLabel,
  isCandidateApplicationActive,
  readCandidateProfile,
  saveCandidateProfile,
  sortCandidateRecommendedJobs,
} from '../utils/candidateFlow.js';
import { saveCandidateApplyIntent } from '../utils/candidateApplyIntent.js';
import { formatExperienceLevel, formatWorkMode } from '../utils/jobFormatters.js';
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/workspace.css';

const CANDIDATE_SECTION_OPTIONS = [
  { value: 'overview', label: 'Dashboard', mobileLabel: 'Beranda' },
  { value: 'profile', label: 'Profil Siap Lamar', mobileLabel: 'Profil' },
  { value: 'jobs', label: 'Lowongan', mobileLabel: 'Lowongan' },
  { value: 'applications', label: 'Lamaran Saya', mobileLabel: 'Lamaran' },
  { value: 'messages', label: 'Chat', mobileLabel: 'Chat' },
];

const CONTACT_WHATSAPP_LINK =
  'https://api.whatsapp.com/send?phone=6281286402753&text=Halo%20KerjaNusa';

/**
 * Mengambil ekstensi file dengan aman untuk validasi dokumen kandidat.
 */
const getFileExtension = (fileName = '') => {
  const normalizedFileName = String(fileName || '').trim().toLowerCase();
  const segments = normalizedFileName.split('.');

  return segments.length > 1 ? segments.pop() || '' : '';
};

/**
 * Memastikan file resume yang dipilih memang berupa PDF dari mime type atau nama file.
 */
const isPdfResumeFile = (file) => {
  if (!file) {
    return false;
  }

  return file.type === 'application/pdf' || getFileExtension(file.name) === 'pdf';
};

/**
 * Mengecek nama file resume yang tersimpan agar hanya PDF yang diterima.
 */
const isPdfResumeFileName = (fileName = '') => getFileExtension(fileName) === 'pdf';
const EARTH_RADIUS_IN_KILOMETERS = 6371;
const MAX_LOCATION_FALLBACK_DISTANCE_IN_KILOMETERS = 60;
const DEFAULT_VISIBLE_EXPERIENCE_ENTRIES = 1;
const MAX_ADDITIONAL_EXPERIENCE_ENTRIES = 3;
const MAX_VISIBLE_EXPERIENCE_ENTRIES =
  DEFAULT_VISIBLE_EXPERIENCE_ENTRIES + MAX_ADDITIONAL_EXPERIENCE_ENTRIES;
const PROFILE_PHOTO_MAX_FILE_SIZE_IN_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MAX_DIMENSION_IN_PIXELS = 480;
const PROFILE_PHOTO_OUTPUT_QUALITY = 0.82;
const PROFILE_PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CANDIDATE_GENDER_OPTIONS = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
];
const EDUCATION_END_STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Masih pendidikan' },
  { value: 'not_graduated', label: 'Tidak lulus' },
];
const ORGANIZATION_ACTIVITY_CURRENT_LABEL = 'Masih aktif';
const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
const EXPERIENCE_YEAR_OPTIONS = Array.from(
  { length: 51 },
  (_, index) => String(CURRENT_CALENDAR_YEAR - index)
);

/**
 * Menyediakan template kosong untuk satu entri pengalaman kerja kandidat.
 */
const createEmptyExperienceEntry = () => ({
  company: '',
  position: '',
  year: '',
  startYear: '',
  endYear: '',
  responsibilities: '',
  achievement: '',
  reasonForLeaving: '',
  referenceName: '',
  referencePhone: '',
});

/**
 * Mengubah derajat menjadi radian untuk perhitungan jarak lokasi kandidat.
 */
const toRadians = (value) => (value * Math.PI) / 180;

/**
 * Menghitung jarak dua titik koordinat dengan rumus haversine.
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
 * Mengubah teks lokasi ke title case agar fallback label lebih rapi di UI.
 */
const toTitleCase = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

/**
 * Menyusun label lokasi fallback dari dataset koordinat lokal.
 */
const formatFallbackLocationLabel = (locationName = '') => {
  const normalizedLocationName = String(locationName || '').trim().toLowerCase();

  if (!normalizedLocationName) {
    return '';
  }

  if (normalizedLocationName.endsWith(' kota')) {
    return `Kota ${toTitleCase(normalizedLocationName.replace(/\s+kota$/, ''))}`;
  }

  if (normalizedLocationName.startsWith('kabupaten ')) {
    return `Kabupaten ${toTitleCase(normalizedLocationName.replace(/^kabupaten\s+/, ''))}`;
  }

  return toTitleCase(normalizedLocationName);
};

const knownCurrentLocationFallbacks = Object.entries(locationCoordinates).map(
  ([locationName, coordinates]) => ({
    locationName: formatFallbackLocationLabel(locationName),
    coordinates,
  })
);

/**
 * Mengubah kode error geolocation menjadi pesan bantuan yang bisa dibaca kandidat.
 */
const getLocationPermissionErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 1:
      return 'Izin lokasi ditolak. Aktifkan akses GPS atau lokasi browser untuk mengisi domisili otomatis.';
    case 2:
      return 'Lokasi perangkat tidak berhasil dibaca. Coba lagi dalam beberapa saat.';
    case 3:
      return 'Permintaan lokasi melebihi batas waktu. Coba lagi.';
    default:
      return 'Gagal mengambil lokasi perangkat.';
  }
};

/**
 * Menormalkan label lokasi hasil reverse geocoding ke bentuk kota/kabupaten yang konsisten.
 */
const normalizeDetectedLocationLabel = (value = '') => {
  let normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  if (/\bregency\b/i.test(normalizedValue)) {
    normalizedValue = `Kabupaten ${normalizedValue.replace(/\bregency\b/gi, '').trim()}`;
  }

  if (/\bcity\b/i.test(normalizedValue)) {
    normalizedValue = `Kota ${normalizedValue.replace(/\bcity\b/gi, '').trim()}`;
  }

  normalizedValue = normalizedValue
    .replace(/\bkota administrasi\b/gi, '')
    .replace(/\bkabupaten administrasi\b/gi, 'Kabupaten')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^kabupaten\s+/i.test(normalizedValue)) {
    return `Kabupaten ${toTitleCase(normalizedValue.replace(/^kabupaten\s+/i, ''))}`;
  }

  if (/^kota\s+/i.test(normalizedValue)) {
    return `Kota ${toTitleCase(normalizedValue.replace(/^kota\s+/i, ''))}`;
  }

  return toTitleCase(normalizedValue);
};

/**
 * Membuang label lokasi yang terlalu granular untuk dipakai sebagai domisili kandidat.
 */
const isTooGranularLocationLabel = (value = '') =>
  /^(kecamatan|kelurahan|desa|dusun|kampung|village|subdistrict)\b/i.test(
    String(value || '').trim()
  );

/**
 * Memilih kandidat label lokasi terbaik dari payload reverse geocoding.
 */
const extractDetectedLocationLabel = (payload) => {
  const address = payload?.address || {};
  const displayNameSegments = String(payload?.display_name || '')
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const candidates = [
    address.county,
    address.city,
    address.town,
    address.municipality,
    address.city_district,
    address.state_district,
    payload?.name,
    ...displayNameSegments,
  ]
    .map(normalizeDetectedLocationLabel)
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!isTooGranularLocationLabel(candidate) && !/^Indonesia$/i.test(candidate)) {
      return candidate;
    }
  }

  return '';
};

/**
 * Mencari kota fallback terdekat dari koordinat perangkat bila reverse geocoding kurang spesifik.
 */
const findClosestKnownLocation = (coordinates) => {
  const closestKnownLocation = knownCurrentLocationFallbacks
    .map((location) => ({
      ...location,
      distanceInKilometers: calculateDistanceInKilometers(coordinates, location.coordinates),
    }))
    .sort(
      (firstLocation, secondLocation) =>
        firstLocation.distanceInKilometers - secondLocation.distanceInKilometers
    )[0];

  if (
    !closestKnownLocation ||
    closestKnownLocation.distanceInKilometers > MAX_LOCATION_FALLBACK_DISTANCE_IN_KILOMETERS
  ) {
    return '';
  }

  return closestKnownLocation.locationName;
};

/**
 * Meminta koordinat perangkat kandidat dengan pengaturan akurasi yang cukup agresif.
 */
const requestCurrentCoordinates = () =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

/**
 * Menjalankan reverse geocoding dari koordinat perangkat ke label lokasi yang lebih manusiawi.
 */
const reverseGeocodeCoordinates = async ({ latitude, longitude }) => {
  const reverseGeocodeUrl = new URL('https://nominatim.openstreetmap.org/reverse');
  reverseGeocodeUrl.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '10',
    addressdetails: '1',
    'accept-language': 'id',
  }).toString();

  const response = await fetch(reverseGeocodeUrl.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Reverse geocoding lokasi belum berhasil.');
  }

  return response.json();
};

/**
 * Menghitung jumlah entri pengalaman yang benar-benar terisi oleh kandidat.
 */
const countFilledExperienceEntries = (experiences = []) =>
  experiences.filter((item) => item?.company?.trim() || item?.position?.trim()).length;

/**
 * Menentukan berapa banyak kartu pengalaman yang perlu dibuka di UI kandidat.
 */
const getVisibleExperienceCount = (profile) =>
  Math.min(
    MAX_VISIBLE_EXPERIENCE_ENTRIES,
    Math.max(
      DEFAULT_VISIBLE_EXPERIENCE_ENTRIES,
      countFilledExperienceEntries(profile?.experiences || [])
    )
  );

/**
 * Menyaring input usia agar hanya berisi maksimal tiga digit angka.
 */
const normalizeAgeInput = (value = '') =>
  String(value ?? '')
    .replace(/[^\d]/g, '')
    .slice(0, 3);

/**
 * Menormalkan input gaji menjadi angka bersih tanpa separator UI.
 */
const normalizeSalaryInputValue = (value = '') =>
  String(value ?? '')
    .replace(/[^\d]/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 12);

/**
 * Menambahkan separator ribuan pada input ekspektasi gaji kandidat.
 */
const formatAccountingCurrencyValue = (value = '') => {
  const normalizedValue = normalizeSalaryInputValue(value);

  if (!normalizedValue) {
    return '';
  }

  return Number.parseInt(normalizedValue, 10).toLocaleString('id-ID');
};

/**
 * Membangun label rentang tahun pengalaman atau pendidikan untuk preview profil.
 */
const buildYearRangeLabel = (startYear = '', endYear = '', currentLabel = 'Masih bekerja') => {
  const normalizedStartYear = String(startYear || '').trim();
  const normalizedEndYear = String(endYear || '').trim();

  if (!normalizedStartYear && !normalizedEndYear) {
    return '';
  }

  if (normalizedStartYear && !normalizedEndYear) {
    return normalizedStartYear;
  }

  if (!normalizedStartYear && normalizedEndYear === 'current') {
    return currentLabel;
  }

  return `${normalizedStartYear || '-'} - ${
    normalizedEndYear === 'current' ? currentLabel : normalizedEndYear
  }`;
};

/**
 * Memastikan file foto profil menggunakan tipe mime yang diizinkan.
 */
const isSupportedProfilePhotoFile = (file) =>
  Boolean(file && PROFILE_PHOTO_ALLOWED_TYPES.has(String(file.type || '').toLowerCase()));

const convertProfilePhotoToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Browser tidak mendukung upload foto profil.'));
      return;
    }

    const imageUrl = window.URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      const scaleRatio = Math.min(
        1,
        PROFILE_PHOTO_MAX_DIMENSION_IN_PIXELS / Math.max(image.width, image.height)
      );
      const targetWidth = Math.max(1, Math.round(image.width * scaleRatio));
      const targetHeight = Math.max(1, Math.round(image.height * scaleRatio));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      window.URL.revokeObjectURL(imageUrl);

      if (!context) {
        reject(new Error('Preview foto belum bisa diproses di browser ini.'));
        return;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      resolve(canvas.toDataURL('image/jpeg', PROFILE_PHOTO_OUTPUT_QUALITY));
    };

    image.onerror = () => {
      window.URL.revokeObjectURL(imageUrl);
      reject(new Error('File foto belum bisa dibaca. Coba gunakan gambar lain.'));
    };

    image.src = imageUrl;
  });

const CANDIDATE_EMPLOYMENT_TYPE_OPTIONS = [
  'Full-time / Tetap',
  'Part-time',
  'Kontrak',
  'Freelance',
  'Magang',
];

const CANDIDATE_EDUCATION_LEVEL_OPTIONS = [
  'SMA / SMK',
  'D1 / D2',
  'D3',
  'S1 - Sarjana',
  'S2 - Magister',
  'S3 - Doktor',
];

/**
 * Mengubah hash URL kandidat menjadi nama tab dashboard yang valid.
 */
const resolveCandidateSectionFromHash = (hash) => {
  if (hash === '#profile') {
    return 'profile';
  }

  if (hash === '#jobs') {
    return 'jobs';
  }

  if (hash === '#applications') {
    return 'applications';
  }

  if (hash === '#messages') {
    return 'messages';
  }

  return 'overview';
};

/**
 * Menyusun URL section kandidat agar perpindahan tab konsisten di satu helper.
 */
const getCandidateSectionRoute = (section) =>
  section === 'overview'
    ? APP_ROUTES.candidateDashboard
    : `${APP_ROUTES.candidateDashboard}#${section}`;

/**
 * Memformat timestamp untuk riwayat aktivitas, aplikasi, dan chat kandidat.
 */
const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

/**
 * Memformat nilai mata uang ke bentuk rupiah standar untuk detail lowongan.
 */
const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return `Rp ${numericValue.toLocaleString('id-ID')}`;
};

/**
 * Menyingkat angka gaji menjadi format jutaan yang padat untuk kartu lowongan.
 */
const formatCompactSalaryValue = (value) => {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '0,0jt';
  }

  return `${(numericValue / 1000000).toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}jt`;
};

/**
 * Menggabungkan gaji minimum dan maksimum ke satu label singkat.
 */
const formatCompactSalaryRange = (minimumValue, maximumValue) =>
  `Rp ${formatCompactSalaryValue(minimumValue)} - ${formatCompactSalaryValue(maximumValue)}`;

/**
 * Mengubah skor match kandidat dari backend ke persentase 0 sampai 100 untuk badge UI.
 */
const formatCandidateJobScorePercent = (job) => {
  const rawScore = Number(job?.candidate_match?.score || 0);

  if (!Number.isFinite(rawScore) || rawScore <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((rawScore / 10) * 100));
};

/**
 * Menyederhanakan label level pengalaman agar lebih ringkas pada kartu rekomendasi.
 */
const formatCompactExperienceLevel = (value = '') =>
  String(formatExperienceLevel(value)).replace(/\s*\(.*?\)/g, '').trim() || '-';

/**
 * Membuat inisial avatar dari nama kandidat atau kontak.
 */
const buildInitials = (value = '') =>
  String(value)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('') || 'KN';

/**
 * Memotong deskripsi lowongan panjang untuk tampilan preview yang lebih padat.
 */
const truncateJobDescription = (description = '', maxLength = 132) => {
  const normalizedDescription = String(description || '').trim();

  if (normalizedDescription.length <= maxLength) {
    return normalizedDescription;
  }

  return `${normalizedDescription.slice(0, maxLength).trim()}...`;
};

/**
 * Mengambil item pertama yang terisi dari daftar field kandidat.
 */
const firstFilledItem = (items = [], fallback = '-') =>
  items.find((item) => String(item || '').trim()) || fallback;

/**
 * Menyusun satu item checklist dengan status dan label tindakan lanjut.
 */
const createChecklistStatusItem = (label, isComplete, pendingAction = 'Lengkapi') => ({
  label,
  isComplete,
  actionLabel: isComplete ? 'Siap' : pendingAction,
});

/**
 * Membangun section checklist utama yang dipakai di dashboard kesiapan kandidat.
 */
const buildCandidateDashboardChecklistSections = (profile, completion) => {
  const checklistLookup = Object.fromEntries(
    completion.checklist.map((item) => [item.key, item])
  );
  const hasLatestEducation =
    Boolean(profile.education?.institution?.trim()) || Boolean(profile.education?.major?.trim());
  const hasLatestExperience = profile.experiences.some(
    (item) => item.company?.trim() || item.position?.trim()
  );

  return [
    {
      id: 'personal',
      title: 'Data Pribadi',
      description: 'Pastikan recruiter langsung menemukan identitas dan kontak utama Anda.',
      items: [
        createChecklistStatusItem('Nama Lengkap', checklistLookup.fullName?.isComplete),
        createChecklistStatusItem('Nomor Telepon', checklistLookup.phone?.isComplete),
        createChecklistStatusItem('Email Akun', checklistLookup.email?.isComplete),
        createChecklistStatusItem('Domisili', checklistLookup.currentAddress?.isComplete),
      ],
    },
    {
      id: 'professional',
      title: 'Profesional',
      description: 'Bagian ini dipakai untuk menilai kesiapan kerja dan arah pencarian Anda.',
      items: [
        createChecklistStatusItem(
          'Posisi yang Diminati',
          checklistLookup.preferredRoles?.isComplete
        ),
        createChecklistStatusItem(
          'Tipe Pekerjaan',
          checklistLookup.employmentType?.isComplete
        ),
        createChecklistStatusItem(
          'Industri Target',
          checklistLookup.targetIndustry?.isComplete
        ),
      ],
    },
    {
      id: 'documents',
      title: 'Dokumen',
      description: 'CV dan riwayat dasar membantu recruiter menilai kecocokan lebih cepat.',
      items: [
        createChecklistStatusItem('Pendidikan Terbaru', hasLatestEducation),
        createChecklistStatusItem('Pengalaman Terbaru', hasLatestExperience),
        createChecklistStatusItem('CV / Resume', checklistLookup.resumeFiles?.isComplete, 'Unggah'),
      ],
    },
  ].map((section) => ({
    ...section,
    completedItems: section.items.filter((item) => item.isComplete).length,
    totalItems: section.items.length,
  }));
};

/**
 * Menjadi workspace utama kandidat untuk profil, lowongan, lamaran, dan komunikasi.
 */
const CandidateDashboardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, updateProfile, getCurrentUser } = useAuth();
  const { jobs, isLoading: isLoadingJobs, error: jobsError, fetchJobs } = useJobs();
  const {
    applications,
    isLoading: isLoadingApplications,
    error: applicationsError,
    getMyApplications,
    withdrawApplication,
  } = useApplications();
  const {
    threads,
    contacts,
    messages,
    isLoadingThreads,
    isLoadingContacts,
    isLoadingMessages,
    isSendingMessage,
    loadThreads,
    loadContacts,
    loadConversation,
    sendMessage,
    error: chatError,
  } = useChat();
  const [activeSection, setActiveSection] = useState(resolveCandidateSectionFromHash(location.hash));
  const [profile, setProfile] = useState(() =>
    readCandidateProfile(user, { preferStoredDraft: false })
  );
  const [visibleExperienceCount, setVisibleExperienceCount] = useState(() =>
    getVisibleExperienceCount(readCandidateProfile(user, { preferStoredDraft: false }))
  );
  const [feedback, setFeedback] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDetectingCurrentLocation, setIsDetectingCurrentLocation] = useState(false);
  const [applicationBucket, setApplicationBucket] = useState('active');
  const [applicationActionInFlightId, setApplicationActionInFlightId] = useState(null);
  const [selectedChatContact, setSelectedChatContact] = useState(null);
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [resumePreview, setResumePreview] = useState(null);

  useEffect(() => {
    setActiveSection(resolveCandidateSectionFromHash(location.hash));
    setIsMobileNavOpen(false);
  }, [location.hash]);

  useEffect(() => {
    const nextProfile = readCandidateProfile(user, { preferStoredDraft: false });
    setProfile(nextProfile);
    setVisibleExperienceCount(getVisibleExperienceCount(nextProfile));
  }, [user]);

  useEffect(() => {
    if (!resumePreview?.url) {
      return undefined;
    }

    return () => {
      window.URL.revokeObjectURL(resumePreview.url);
    };
  }, [resumePreview?.url]);

  useEffect(() => {
    setResumePreview(null);
  }, [user?.id]);

  useEffect(() => {
    if (user?.role !== 'candidate') {
      return;
    }

    fetchJobs({}, 1, 24);
    getMyApplications(1, 30);
  }, [fetchJobs, getMyApplications, user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== 'candidate') {
      return;
    }

    let isMounted = true;

    getCurrentUser()
      .then((freshUser) => {
        if (!isMounted || !freshUser) {
          return;
        }

        const nextProfile = readCandidateProfile(freshUser, { preferStoredDraft: false });
        setProfile(nextProfile);
        setVisibleExperienceCount(getVisibleExperienceCount(nextProfile));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [getCurrentUser, user?.id, user?.role]);

  useEffect(() => {
    if (!location.state?.candidateNotice) {
      return;
    }

    setFeedback({
      type: 'success',
      message: location.state.candidateNotice,
    });
    navigate(`${APP_ROUTES.candidateDashboard}${location.hash}`, { replace: true });
  }, [location.hash, location.state, navigate]);

  useEffect(() => {
    if (activeSection !== 'messages') {
      return;
    }

    setFeedback(null);
    loadThreads().catch(() => {});
    loadContacts(chatSearchQuery).catch(() => {});
  }, [activeSection, chatSearchQuery, loadContacts, loadThreads]);

  useEffect(() => {
    if (activeSection !== 'messages' || !chatError) {
      return;
    }

    setFeedback({
      type: 'error',
      message: chatError,
    });
  }, [activeSection, chatError]);

  const persistedProfile = useMemo(
    () => readCandidateProfile(user, { preferStoredDraft: false }),
    [user]
  );
  const completion = useMemo(
    () => getCandidateProfileCompletion(persistedProfile),
    [persistedProfile]
  );
  const activeApplications = useMemo(
    () => applications.filter((application) => isCandidateApplicationActive(application.status, application)),
    [applications]
  );
  const completedApplications = useMemo(
    () =>
      applications.filter((application) => !isCandidateApplicationActive(application.status, application)),
    [applications]
  );
  const recommendedJobs = useMemo(
    () =>
      sortCandidateRecommendedJobs(jobs, persistedProfile, applications).filter(
        (job) => !job.alreadyApplied
      ),
    [applications, jobs, persistedProfile]
  );
  const spotlightJobs = recommendedJobs.slice(0, 6);
  const checklistSections = useMemo(
    () => buildCandidateDashboardChecklistSections(persistedProfile, completion),
    [completion, persistedProfile]
  );
  const activeApplicationsPreview = useMemo(
    () => activeApplications.slice(0, 3),
    [activeApplications]
  );
  const recommendedJobsPreview = useMemo(() => recommendedJobs.slice(0, 3), [recommendedJobs]);
  const recommendedJobsCount = recommendedJobs.length;
  const overviewHero = useMemo(() => {
    if (!completion.isReady) {
      return {
        title: 'Optimalkan Profil Profesional Anda',
        description:
          'Lengkapi data diri Anda untuk meningkatkan peluang dilirik recruiter. Semua indikator di dashboard ini diambil dari profil kandidat, lowongan, dan lamaran aktif pada akun Anda saat ini.',
        secondaryLabel: 'Buka Profil',
        secondarySection: 'profile',
      };
    }

    if (activeApplications.length > 0) {
      return {
        title: 'Pantau Progres Lamaran Profesional Anda',
        description:
          'Lamaran aktif, status recruiter, dan peluang lowongan baru kini tersaji dari data akun Anda secara real-time agar tindak lanjut tidak terlewat.',
        secondaryLabel: 'Lihat Lamaran',
        secondarySection: 'applications',
      };
    }

    return {
      title: 'Profil Anda Siap Didorong Lebih Jauh',
      description:
        'Gunakan profil yang sudah lengkap untuk mulai melamar lowongan yang paling sesuai dengan minat, lokasi, dan keahlian Anda saat ini.',
      secondaryLabel: 'Buka Profil',
      secondarySection: 'profile',
    };
  }, [activeApplications.length, completion.isReady]);
  const primaryPreferredRole = firstFilledItem(persistedProfile.preferredRoles, 'Belum diisi');
  const primaryPreferredLocation = firstFilledItem(
    persistedProfile.preferredLocations,
    'Belum diisi'
  );
  const resumePreviewName = resumePreview?.name || profile.resumeFiles[0] || 'CV belum diunggah';
  const hasProfilePhoto = Boolean(profile.photoDataUrl);
  const profilePhotoAlt = profile.fullName?.trim()
    ? `Foto profil ${profile.fullName.trim()}`
    : 'Foto profil kandidat';
  const formattedSalaryExpectation = formatAccountingCurrencyValue(profile.salaryMin);
  const persistedResumeName = profile.resumeFiles[0] || '';
  const persistedResumeExtension = getFileExtension(persistedResumeName);
  const hasResumePreview = Boolean(resumePreview?.url);
  const hasStoredResume = Boolean(persistedResumeName);
  const resumePreviewLabel = hasResumePreview
    ? 'Preview resume terbaru'
    : hasStoredResume
      ? 'Resume tersimpan'
      : 'Preview resume';
  const resumePreviewHint = hasResumePreview
    ? 'CV yang baru dipilih tampil di sini sebelum disimpan.'
    : persistedResumeExtension === 'pdf'
      ? 'Upload ulang file PDF bila ingin menampilkan preview visual CV di browser ini.'
      : hasStoredResume
        ? 'Preview visual saat ini hanya tersedia untuk file PDF yang baru dipilih.'
        : 'Unggah CV format PDF agar preview visual muncul di sini.';
  const completionRingRadius = 52;
  const completionRingCircumference = 2 * Math.PI * completionRingRadius;
  const completionRingOffset =
    completionRingCircumference -
    (completionRingCircumference * completion.completionPercent) / 100;
  const mobileBottomSections = CANDIDATE_SECTION_OPTIONS.filter((section) =>
    ['overview', 'jobs', 'applications', 'messages'].includes(section.value)
  );

  const applicationList = applicationBucket === 'active' ? activeApplications : completedApplications;

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setIsMobileNavOpen(false);
    navigate(getCandidateSectionRoute(section));
  };

  const handleOpenRecommendedJob = (job) => {
    saveCandidateApplyIntent({
      jobId: job.id,
      page: 1,
      filters: {
        search: job.title,
        experience_level: job.experience_level,
        location: job.location,
      },
      selectedLocation: job.location,
    });

    navigate(APP_ROUTES.jobs);
  };

  const handleLogout = async () => {
    setIsMobileNavOpen(false);
    await logout();
    navigate(APP_ROUTES.landing, { replace: true });
  };

  const handleProfileFieldChange = (field, value) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
    setFeedback(null);
  };

  const handleProfilePhotoChange = async (inputElement) => {
    const photoFile = inputElement?.files?.[0];

    if (!photoFile) {
      return;
    }

    if (!isSupportedProfilePhotoFile(photoFile)) {
      if (inputElement) {
        inputElement.value = '';
      }

      setFeedback({
        type: 'error',
        message: 'Foto profil harus berupa JPG, PNG, atau WEBP.',
      });
      return;
    }

    if (photoFile.size > PROFILE_PHOTO_MAX_FILE_SIZE_IN_BYTES) {
      if (inputElement) {
        inputElement.value = '';
      }

      setFeedback({
        type: 'error',
        message: 'Ukuran foto profil maksimal 5MB.',
      });
      return;
    }

    try {
      const photoDataUrl = await convertProfilePhotoToDataUrl(photoFile);

      setProfile((currentProfile) => ({
        ...currentProfile,
        photoFileName: photoFile.name,
        photoDataUrl,
      }));
      setFeedback(null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Foto profil belum berhasil diproses.',
      });
    } finally {
      if (inputElement) {
        inputElement.value = '';
      }
    }
  };

  const handleRemoveProfilePhoto = () => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      photoFileName: '',
      photoDataUrl: '',
    }));
    setFeedback(null);
  };

  const handleEducationChange = (field, value) => {
    setProfile((currentProfile) => {
      const nextEducation = {
        ...currentProfile.education,
        [field]: value,
      };

      if (
        field === 'startYear' &&
        nextEducation.endYear &&
        value &&
        Number(nextEducation.endYear) < Number(value)
      ) {
        nextEducation.endYear = '';
      }

      return {
        ...currentProfile,
        education: nextEducation,
      };
    });
    setFeedback(null);
  };

  const handleOrganizationActivityChange = (field, value) => {
    setProfile((currentProfile) => {
      const nextOrganizationActivity = {
        ...currentProfile.organizationActivity,
      };

      if (field === 'startYear') {
        nextOrganizationActivity.startYear = value;

        if (
          nextOrganizationActivity.endYear &&
          nextOrganizationActivity.endYear !== 'current' &&
          value &&
          Number(nextOrganizationActivity.endYear) < Number(value)
        ) {
          nextOrganizationActivity.endYear = '';
        }
      } else {
        nextOrganizationActivity[field] = value;
      }

      return {
        ...currentProfile,
        organizationActivity: nextOrganizationActivity,
      };
    });
    setFeedback(null);
  };

  const handleExperienceChange = (index, field, value) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      experiences: currentProfile.experiences.map((item, itemIndex) =>
        itemIndex === index
          ? (() => {
              if (field === 'startYear') {
                const nextStartYear = String(value || '').trim();
                const nextEndYear =
                  item.endYear !== 'current' &&
                  item.endYear &&
                  nextStartYear &&
                  Number(item.endYear) < Number(nextStartYear)
                    ? ''
                    : item.endYear;

                return {
                  ...item,
                  startYear: nextStartYear,
                  endYear: nextEndYear,
                  year: buildYearRangeLabel(nextStartYear, nextEndYear),
                };
              }

              if (field === 'endYear') {
                const nextEndYear = String(value || '').trim();

                return {
                  ...item,
                  endYear: nextEndYear,
                  year: buildYearRangeLabel(item.startYear, nextEndYear),
                };
              }

              return {
                ...item,
                [field]: value,
              };
            })()
          : item
      ),
    }));
    setFeedback(null);
  };

  const handleAddExperienceEntry = () => {
    if (visibleExperienceCount >= MAX_VISIBLE_EXPERIENCE_ENTRIES) {
      setFeedback({
        type: 'error',
        message: `Pengalaman kerja hanya bisa ditambah maksimal ${MAX_ADDITIONAL_EXPERIENCE_ENTRIES} kali.`,
      });
      return;
    }

    setVisibleExperienceCount((currentCount) =>
      Math.min(MAX_VISIBLE_EXPERIENCE_ENTRIES, currentCount + 1)
    );
    setFeedback(null);
  };

  const handleRemoveExperienceEntry = (index) => {
    if (index <= 0 || visibleExperienceCount <= DEFAULT_VISIBLE_EXPERIENCE_ENTRIES) {
      return;
    }

    setProfile((currentProfile) => {
      const nextExperiences = currentProfile.experiences
        .filter((_, itemIndex) => itemIndex !== index)
        .concat(createEmptyExperienceEntry());

      return {
        ...currentProfile,
        experiences: nextExperiences.slice(0, currentProfile.experiences.length),
      };
    });
    setVisibleExperienceCount((currentCount) =>
      Math.max(DEFAULT_VISIBLE_EXPERIENCE_ENTRIES, currentCount - 1)
    );
    setFeedback(null);
  };

  const handleListFieldChange = (field, index, value) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: currentProfile[field].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
    setFeedback(null);
  };

  const handleSalaryExpectationChange = (value) => {
    const normalizedSalaryValue = normalizeSalaryInputValue(value);

    setProfile((currentProfile) => ({
      ...currentProfile,
      salaryMin: normalizedSalaryValue,
      salaryMax: normalizedSalaryValue,
    }));
    setFeedback(null);
  };

  const handleFileChange = (field, inputElement, maxFiles) => {
    const nextFiles = Array.from(inputElement?.files || []).slice(0, maxFiles);
    const fileNames = nextFiles.map((file) => file.name);
    const primaryFile = nextFiles[0] || null;

    if (field === 'resumeFiles' && nextFiles.some((file) => !isPdfResumeFile(file))) {
      if (inputElement) {
        inputElement.value = '';
      }

      setFeedback({
        type: 'error',
        message: 'CV wajib format PDF. File selain PDF tidak bisa diunggah.',
      });
      return;
    }

    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: fileNames,
    }));

    if (field === 'resumeFiles') {
      setResumePreview(
        primaryFile && isPdfResumeFile(primaryFile)
          ? {
              name: primaryFile.name,
              url: window.URL.createObjectURL(primaryFile),
            }
          : primaryFile
            ? {
                name: primaryFile.name,
                url: '',
              }
            : null
      );
    }

    setFeedback(null);
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: 'error',
        message: 'Browser Anda belum mendukung akses lokasi perangkat.',
      });
      return;
    }

    setIsDetectingCurrentLocation(true);
    setFeedback(null);

    try {
      const position = await requestCurrentCoordinates();
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      let resolvedLocation = '';

      try {
        const reverseGeocodePayload = await reverseGeocodeCoordinates(coordinates);
        resolvedLocation = extractDetectedLocationLabel(reverseGeocodePayload);
      } catch {
        resolvedLocation = '';
      }

      if (!resolvedLocation) {
        resolvedLocation = findClosestKnownLocation(coordinates);
      }

      if (!resolvedLocation) {
        throw new Error(
          'Lokasi perangkat berhasil dibaca, tetapi kota atau kabupaten belum bisa dikenali otomatis.'
        );
      }

      setProfile((currentProfile) => ({
        ...currentProfile,
        currentAddress: resolvedLocation,
        preferredLocations: currentProfile.preferredLocations.map((item, index) =>
          index === 0 && !String(item || '').trim() ? resolvedLocation : item
        ),
      }));
      setFeedback({
        type: 'success',
        message: `Lokasi saat ini berhasil diisi otomatis: ${resolvedLocation}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          typeof error?.code === 'number'
            ? getLocationPermissionErrorMessage(error.code)
            : error?.message || 'Gagal mencocokkan lokasi perangkat Anda.',
      });
    } finally {
      setIsDetectingCurrentLocation(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      return;
    }

    const invalidResumeFileName = profile.resumeFiles.find(
      (fileName) => !isPdfResumeFileName(fileName)
    );

    if (invalidResumeFileName) {
      setFeedback({
        type: 'error',
        message: `CV wajib format PDF. File "${invalidResumeFileName}" tidak bisa disimpan.`,
      });
      return;
    }

    setIsSavingProfile(true);
    const normalizedProfile = {
      ...profile,
      preferredLocations: profile.preferredLocations.map((item, index) =>
        index === 0 && !String(item || '').trim()
          ? String(profile.currentAddress || '').trim()
          : item
      ),
      skills: profile.skills.map((item, index) =>
        index === 0 && !String(item || '').trim()
          ? String(profile.targetIndustry || '').trim()
          : item
      ),
    };
    const savedProfile = saveCandidateProfile(user, normalizedProfile);
    setProfile(savedProfile);

    try {
      const response = await updateProfile({
        name: savedProfile.fullName.trim(),
        phone: savedProfile.phone.trim(),
        candidate_profile: savedProfile,
      });
      const syncedProfile = readCandidateProfile(response?.user || user, {
        preferStoredDraft: false,
      });
      const syncedCompletion = getCandidateProfileCompletion(syncedProfile);
      setProfile(syncedProfile);
      setVisibleExperienceCount(getVisibleExperienceCount(syncedProfile));

      setFeedback({
        type: 'success',
        message: syncedCompletion.isReady
          ? 'Profil kandidat berhasil disimpan dan sudah siap dipakai untuk melamar.'
          : 'Profil kandidat berhasil disimpan. Lengkapi checklist minimum agar siap melamar.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error?.message ||
          'Profil lokal tersimpan, tetapi sinkronisasi nama atau telepon ke akun belum berhasil.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleWithdrawApplication = async (application) => {
    setApplicationActionInFlightId(application.id);

    try {
      await withdrawApplication(application.id);
      await getMyApplications(1, 30);
      setFeedback({
        type: 'success',
        message: `Lamaran untuk ${application.job?.title || 'lowongan ini'} berhasil dibatalkan.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Lamaran belum berhasil dibatalkan.',
      });
    } finally {
      setApplicationActionInFlightId(null);
    }
  };

  const handleOpenConversation = async (contact) => {
    if (!contact?.id) {
      return;
    }

    setSelectedChatContact(contact);
    setChatDraftMessage('');

    try {
      await loadConversation(contact.id);
      handleSectionChange('messages');
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Percakapan belum berhasil dibuka.',
      });
    }
  };

  const handleSendChatMessage = async () => {
    if (!selectedChatContact?.id || !chatDraftMessage.trim()) {
      return;
    }

    try {
      await sendMessage({
        recipient_id: selectedChatContact.id,
        body: chatDraftMessage.trim(),
      });
      setChatDraftMessage('');
      await loadThreads();
      await loadConversation(selectedChatContact.id);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Pesan belum berhasil dikirim.',
      });
    }
  };

  const profileSummaryCards = [
    {
      label: 'Status profil',
      value: getCandidateProfileStatusLabel(completion),
      detail: `${completion.completedRequiredItems}/${completion.totalRequiredItems} syarat inti terpenuhi`,
    },
    {
      label: 'Progress profil',
      value: `${completion.completionPercent}%`,
      detail: `${completion.completedItems}/${completion.totalItems} komponen terisi`,
    },
    {
      label: 'Lamaran aktif',
      value: `${activeApplications.length}`,
      detail: activeApplications.length > 0 ? 'Sedang dipantau recruiter' : 'Belum ada proses aktif',
    },
    {
      label: 'Lowongan cocok',
      value: `${recommendedJobsCount}`,
      detail:
        recommendedJobsCount > 0
          ? 'Disusun dari minat role, lokasi, dan skill Anda'
          : 'Lengkapi minat kerja untuk rekomendasi yang lebih akurat',
    },
  ];

  return (
    <div className="workspace-page workspace-page-candidate">
      <header
        className={`workspace-topbar workspace-topbar-candidate${
          isMobileNavOpen ? ' workspace-topbar-nav-open' : ''
        }`}
      >
        <div className="workspace-shell workspace-topbar-shell">
          <Link
            to={APP_ROUTES.landing}
            className="workspace-brand"
            aria-label="Website awal KerjaNusa"
          >
            <img src="/kerjanusa-logo-cutout.png" alt="KerjaNusa Recruitment Platform" />
          </Link>

          <nav
            id="candidate-mobile-nav"
            className={`workspace-nav${isMobileNavOpen ? ' is-open' : ''}`}
            aria-label="Navigasi pelamar"
          >
            {CANDIDATE_SECTION_OPTIONS.map((section) => (
              <button
                key={section.value}
                type="button"
                className={`workspace-nav-button${
                  activeSection === section.value ? ' active' : ''
                }`}
                onClick={() => handleSectionChange(section.value)}
              >
                {section.label}
              </button>
            ))}

            <div className="workspace-mobile-menu-footer">
              <div className="workspace-user-chip workspace-mobile-menu-user">
                <strong>{profile.fullName || user?.name}</strong>
                <span>Pelamar</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary workspace-logout workspace-mobile-menu-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </nav>

          <div className="workspace-actions">
            <button
              type="button"
              className="workspace-mobile-nav-toggle"
              aria-expanded={isMobileNavOpen}
              aria-controls="candidate-mobile-nav"
              aria-label={isMobileNavOpen ? 'Tutup menu pelamar' : 'Buka menu pelamar'}
              onClick={() => setIsMobileNavOpen((currentValue) => !currentValue)}
            >
              <span className="workspace-mobile-nav-toggle-line" />
              <span className="workspace-mobile-nav-toggle-line" />
              <span className="workspace-mobile-nav-toggle-line" />
            </button>
            <div className="workspace-user-chip">
              <strong>{profile.fullName || user?.name}</strong>
              <span>Pelamar</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary workspace-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="workspace-shell workspace-main">
        {feedback && (
          <div
            className={`${feedback.type === 'error' ? 'error' : 'success'} workspace-feedback`}
          >
            {feedback.message}
          </div>
        )}

        {activeSection === 'overview' && (
          <section className="workspace-section-stack workspace-candidate-dashboard-overview">
            <div className="candidate-dashboard-hero-layout">
              <article className="candidate-dashboard-hero-card" data-reveal>
                <span className="candidate-dashboard-eyebrow">Candidate Flow</span>
                <h1>{overviewHero.title}</h1>
                <p>{overviewHero.description}</p>

                <div className="candidate-dashboard-hero-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSectionChange('jobs')}
                  >
                    Cari Lowongan
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleSectionChange(overviewHero.secondarySection)}
                  >
                    {overviewHero.secondaryLabel}
                  </button>
                </div>

                <div className="candidate-dashboard-hero-metadata">
                  <article className="candidate-dashboard-snapshot-card">
                    <div className="candidate-dashboard-snapshot-head">
                      <strong>Posisi utama</strong>
                      <span>{formatCandidateCareerStage(persistedProfile)}</span>
                    </div>
                    <p>
                      Fokus pencarian Anda saat ini dibaca dari minat role dan pengalaman yang
                      tersimpan.
                    </p>
                    <small>{primaryPreferredRole}</small>
                  </article>

                  <article className="candidate-dashboard-snapshot-card">
                    <div className="candidate-dashboard-snapshot-head">
                      <strong>Lokasi prioritas</strong>
                      <span>{primaryPreferredLocation}</span>
                    </div>
                    <p>
                      Lengkapi domisili dan lokasi minat agar rekomendasi lowongan makin relevan.
                    </p>
                    <small>
                      {persistedProfile.currentAddress?.trim() || 'Domisili belum diisi'}
                    </small>
                  </article>
                </div>
              </article>

              <div className="candidate-dashboard-summary-rail">
                <article
                  className="candidate-dashboard-mobile-progress-card"
                  data-reveal
                  data-reveal-delay="40ms"
                >
                  <div className="candidate-dashboard-progress-ring">
                    <svg
                      className="candidate-dashboard-progress-svg"
                      viewBox="0 0 132 132"
                      aria-hidden="true"
                    >
                      <circle
                        className="candidate-dashboard-progress-track"
                        cx="66"
                        cy="66"
                        r={completionRingRadius}
                      />
                      <circle
                        className="candidate-dashboard-progress-value"
                        cx="66"
                        cy="66"
                        r={completionRingRadius}
                        strokeDasharray={completionRingCircumference}
                        strokeDashoffset={completionRingOffset}
                      />
                    </svg>
                    <div className="candidate-dashboard-progress-copy">
                      <strong>{completion.completionPercent}%</strong>
                      <span>Selesai</span>
                    </div>
                  </div>

                  <strong className="candidate-dashboard-mobile-progress-title">
                    {getCandidateProfileStatusLabel(completion)}
                  </strong>
                  <p className="candidate-dashboard-mobile-progress-caption">
                    {completion.completedRequiredItems}/{completion.totalRequiredItems} syarat
                    terpenuhi
                  </p>

                  <div className="candidate-dashboard-mobile-progress-stats">
                    <article>
                      <strong>{activeApplications.length}</strong>
                      <span>Lamaran aktif</span>
                    </article>
                    <article>
                      <strong>{recommendedJobsCount}</strong>
                      <span>Lowongan cocok</span>
                    </article>
                  </div>
                </article>

                <div className="candidate-dashboard-summary-grid" data-reveal data-reveal-delay="40ms">
                  {profileSummaryCards.map((card) => (
                    <article key={card.label} className="candidate-dashboard-summary-card">
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                      <small>{card.detail}</small>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="candidate-dashboard-main-grid">
              <article className="candidate-dashboard-panel" data-reveal data-reveal-delay="80ms">
                <div className="candidate-dashboard-panel-head">
                  <div>
                    <span className="candidate-dashboard-eyebrow">Checklist Siap Lamar</span>
                    <h2>Minimum yang harus beres</h2>
                  </div>
                  <p>
                    Semua status di bawah dibangun dari profil kandidat yang tersimpan di akun Anda
                    saat ini, bukan data contoh.
                  </p>
                </div>

                <div className="candidate-dashboard-checklist-groups">
                  {checklistSections.map((section) => (
                    <section key={section.id} className="candidate-dashboard-checklist-group">
                      <div className="candidate-dashboard-checklist-head">
                        <div>
                          <h3>{section.title}</h3>
                          <p>{section.description}</p>
                        </div>
                        <strong>
                          {section.completedItems}/{section.totalItems}
                        </strong>
                      </div>

                      <div className="candidate-dashboard-status-list">
                        {section.items.map((item) => (
                          <article
                            key={`${section.id}-${item.label}`}
                            className={`candidate-dashboard-status-row${
                              item.isComplete ? ' is-complete' : ' is-missing'
                            }`}
                          >
                            <div>
                              <strong>{item.label}</strong>
                              <span>
                                {item.isComplete
                                  ? 'Komponen ini sudah aktif dan siap dipakai saat melamar.'
                                  : 'Lengkapi komponen ini agar recruiter mendapat profil yang utuh.'}
                              </span>
                            </div>
                            <small>{item.actionLabel}</small>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>

              <div className="candidate-dashboard-side-column">
                <article
                  className="candidate-dashboard-panel"
                  data-reveal
                  data-reveal-delay="120ms"
                >
                  <div className="candidate-dashboard-panel-head">
                    <div>
                      <span className="candidate-dashboard-eyebrow">Lamaran Aktif</span>
                      <h2>Yang sedang bergerak sekarang</h2>
                    </div>
                    <p>
                      Area ini menampilkan proses yang masih berjalan agar tindak lanjut recruiter
                      tidak terlewat.
                    </p>
                  </div>

                  <div className="candidate-dashboard-inline-list">
                    {activeApplicationsPreview.length === 0 ? (
                      <article className="candidate-dashboard-inline-card is-empty">
                        <div className="candidate-dashboard-inline-head">
                          <strong>Belum ada lamaran aktif</strong>
                          <span>Mulai dari lowongan teratas</span>
                        </div>
                        <p>
                          Profil siap lamar akan lebih berguna jika langsung dipakai untuk kirim
                          lamaran pertama.
                        </p>
                      </article>
                    ) : (
                      activeApplicationsPreview.map((application) => {
                        const statusMeta = getCandidateApplicationMeta(
                          application.status,
                          application
                        );

                        return (
                          <article
                            key={application.id}
                            className="candidate-dashboard-inline-card"
                          >
                            <div className="candidate-dashboard-inline-head">
                              <strong>{application.job?.title || 'Lowongan'}</strong>
                              <span>
                                {formatCandidateApplicationStatus(
                                  application.status,
                                  application
                                )}
                              </span>
                            </div>
                            <p>{statusMeta.nextAction}</p>
                            <small>
                              {application.job?.recruiter?.name || 'Recruiter'} •{' '}
                              {formatDateTime(application.applied_at)}
                            </small>
                          </article>
                        );
                      })
                    )}
                  </div>
                </article>

                <article
                  className="candidate-dashboard-panel"
                  data-reveal
                  data-reveal-delay="160ms"
                >
                  <div className="candidate-dashboard-panel-head">
                    <div>
                      <span className="candidate-dashboard-eyebrow">Lowongan Cocok</span>
                      <h2>Peluang terdekat untuk Anda</h2>
                    </div>
                    <p>
                      Rekomendasi ini dihitung dari role, lokasi, skill, dan histori lamaran yang
                      tersimpan sekarang.
                    </p>
                  </div>

                  <div className="candidate-dashboard-inline-list">
                    {recommendedJobsPreview.length === 0 ? (
                      <article className="candidate-dashboard-inline-card is-empty">
                        <div className="candidate-dashboard-inline-head">
                          <strong>Belum ada rekomendasi kuat</strong>
                          <span>Lengkapi minat kerja</span>
                        </div>
                        <p>
                          Tambahkan posisi yang dicari, lokasi prioritas, dan skill utama agar
                          mesin rekomendasi bisa menyaring lowongan yang lebih relevan.
                        </p>
                      </article>
                    ) : (
                      recommendedJobsPreview.map((job) => (
                        <article key={job.id} className="candidate-dashboard-inline-card">
                          <div className="candidate-dashboard-inline-head">
                            <strong>{job.title}</strong>
                            <span>{job.candidate_match.score} poin</span>
                          </div>
                          <p>
                            {job.recruiter?.name || 'Perusahaan'} • {job.location || '-'} •{' '}
                            {formatWorkMode(job.work_mode)}
                          </p>
                          <small>
                            {job.candidate_match.reasons[0] ||
                              'Rekomendasi ini diambil dari kecocokan profil Anda.'}
                          </small>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="candidate-dashboard-panel-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleSectionChange('jobs')}
                    >
                      Buka Semua Lowongan
                    </button>
                  </div>
                </article>

                <aside
                  className="candidate-dashboard-help-card"
                  data-reveal
                  data-reveal-delay="200ms"
                >
                  <span className="candidate-dashboard-help-kicker">Butuh bantuan?</span>
                  <h2>Butuh Bantuan?</h2>
                  <p>
                    Tim kami siap membantu menyempurnakan profil Anda untuk menarik perhatian
                    korporasi besar di Indonesia.
                  </p>
                  <a
                    className="candidate-dashboard-help-button"
                    href={CONTACT_WHATSAPP_LINK}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hubungi Konsultan
                  </a>
                </aside>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'profile' && (
          <section className="workspace-section-stack candidate-profile-layout">
            <div className="candidate-profile-shell">
              <header className="candidate-profile-hero" data-reveal>
                <span className="candidate-profile-kicker">Pengaturan Kandidat</span>
                <h1>Lengkapi Profil Profesional Anda</h1>
                <span className="candidate-profile-divider" />
              </header>

              <article className="candidate-profile-card" data-reveal data-reveal-delay="40ms">
                <div className="candidate-profile-card-head">
                  <div className="candidate-profile-card-title">
                    <span className="candidate-profile-card-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM6.5 18.4a5.5 5.5 0 0 1 11 0"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <h2>Data Inti</h2>
                  </div>
                </div>

                <div className="candidate-profile-form-stack">
                  <div className="candidate-profile-photo-panel">
                    <div className="candidate-profile-photo-preview">
                      {hasProfilePhoto ? (
                        <img src={profile.photoDataUrl} alt={profilePhotoAlt} />
                      ) : (
                        <span>{buildInitials(profile.fullName || user?.name || 'KN')}</span>
                      )}
                    </div>

                    <div className="candidate-profile-photo-copy">
                      <strong>Foto Profil</strong>
                      <p>
                        Upload foto kandidat agar profil terlihat lebih profesional saat dilihat
                        recruiter.
                      </p>
                      <div className="candidate-profile-photo-actions">
                        <label
                          className="candidate-profile-photo-trigger"
                          htmlFor="candidate-profile-photo-upload"
                        >
                          {hasProfilePhoto ? 'Ganti Foto' : 'Upload Foto'}
                        </label>
                        {hasProfilePhoto && (
                          <button
                            type="button"
                            className="candidate-profile-photo-remove"
                            onClick={handleRemoveProfilePhoto}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <small>
                        {profile.photoFileName
                          ? profile.photoFileName
                          : 'JPG, PNG, atau WEBP. Maks 5MB.'}
                      </small>
                      <input
                        id="candidate-profile-photo-upload"
                        className="candidate-profile-upload-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => handleProfilePhotoChange(event.target)}
                      />
                    </div>
                  </div>

                  <label className="candidate-profile-field">
                    <span>Nama Lengkap</span>
                    <input
                      type="text"
                      placeholder="Masukkan nama sesuai KTP"
                      value={profile.fullName}
                      onChange={(event) => handleProfileFieldChange('fullName', event.target.value)}
                    />
                  </label>

                  <label className="candidate-profile-field">
                    <span>Email Aktif</span>
                    <input type="email" value={profile.email} readOnly />
                  </label>

                  <label className="candidate-profile-field">
                    <span>Nomor Telepon / WhatsApp</span>
                    <input
                      type="tel"
                      placeholder="+62 812 3456 7890"
                      value={profile.phone}
                      onChange={(event) => handleProfileFieldChange('phone', event.target.value)}
                    />
                  </label>

                  <div className="candidate-profile-inline-grid">
                    <label className="candidate-profile-field">
                      <span>Jenis Kelamin</span>
                      <select
                        value={profile.gender || ''}
                        onChange={(event) =>
                          handleProfileFieldChange('gender', event.target.value)
                        }
                      >
                        <option value="">Pilih jenis kelamin</option>
                        {CANDIDATE_GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="candidate-profile-field">
                      <span>Usia</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Contoh: 25"
                        value={profile.age || ''}
                        onChange={(event) =>
                          handleProfileFieldChange('age', normalizeAgeInput(event.target.value))
                        }
                      />
                    </label>
                  </div>

                  <label className="candidate-profile-field candidate-profile-field-with-icon">
                    <span>Lokasi Saat Ini</span>
                    <div className="candidate-profile-input-shell">
                      <input
                        type="text"
                        placeholder="Kota atau Kabupaten"
                        value={profile.currentAddress}
                        onChange={(event) =>
                          handleProfileFieldChange('currentAddress', event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className={`candidate-profile-trailing-icon candidate-profile-location-trigger${
                          isDetectingCurrentLocation ? ' is-detecting' : ''
                        }`}
                        onClick={handleUseCurrentLocation}
                        disabled={isDetectingCurrentLocation}
                        aria-label={
                          isDetectingCurrentLocation
                            ? 'Sedang mencocokkan lokasi perangkat'
                            : 'Gunakan GPS untuk mengisi lokasi saat ini'
                        }
                        title={
                          isDetectingCurrentLocation
                            ? 'Sedang mencocokkan lokasi perangkat'
                            : 'Gunakan GPS untuk mengisi lokasi saat ini'
                        }
                      >
                        {isDetectingCurrentLocation ? (
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" opacity="0.26" />
                            <path
                              d="M12 4.5A7.5 7.5 0 0 1 19.5 12"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 21s6-5.3 6-10.2A6 6 0 1 0 6 10.8C6 15.7 12 21 12 21Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="10.5" r="2.1" stroke="currentColor" strokeWidth="1.7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                </div>
              </article>

              <article className="candidate-profile-card" data-reveal data-reveal-delay="80ms">
                <div className="candidate-profile-card-head">
                  <div className="candidate-profile-card-title">
                    <span className="candidate-profile-card-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4.5 8.5h15M7.5 5.5h9M6 18.5h12M8.5 12.5h7"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <h2>Target Pekerjaan</h2>
                  </div>
                </div>

                <div className="candidate-profile-form-stack">
                  <label className="candidate-profile-field">
                    <span>Posisi yang Diminati</span>
                    <input
                      type="text"
                      placeholder="Contoh: Senior Business Analyst, Supervisor Operasional"
                      value={profile.preferredRoles[0]}
                      onChange={(event) =>
                        handleListFieldChange('preferredRoles', 0, event.target.value)
                      }
                    />
                  </label>

                  <label className="candidate-profile-field">
                    <span>Tipe Pekerjaan</span>
                    <select
                      value={profile.employmentType || ''}
                      onChange={(event) =>
                        handleProfileFieldChange('employmentType', event.target.value)
                      }
                    >
                      <option value="">Pilih tipe pekerjaan</option>
                      {CANDIDATE_EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="candidate-profile-field">
                    <span>Industri Target</span>
                    <input
                      type="text"
                      placeholder="Contoh: FinTech, E-commerce"
                      value={profile.targetIndustry || ''}
                      onChange={(event) =>
                        handleProfileFieldChange('targetIndustry', event.target.value)
                      }
                    />
                  </label>
                </div>
              </article>

              <article className="candidate-profile-card" data-reveal data-reveal-delay="120ms">
                <div className="candidate-profile-card-head">
                  <div className="candidate-profile-card-title">
                    <span className="candidate-profile-card-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4.5 8.5 12 5l7.5 3.5L12 12 4.5 8.5ZM6.5 11.5V16L12 19l5.5-3v-4.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <h2>Pendidikan & Pengalaman</h2>
                  </div>
                </div>

                <div className="candidate-profile-stack">
                  <section className="candidate-profile-detail-block">
                    <div className="candidate-profile-detail-head">
                      <span className="candidate-profile-detail-icon">PK</span>
                      <div className="candidate-profile-detail-copy">
                        <div>
                          <h3>Pengalaman Terakhir</h3>
                          <p>Tuliskan posisi dan perusahaan terakhir Anda.</p>
                        </div>
                        <button
                          type="button"
                          className="candidate-profile-detail-action"
                          onClick={handleAddExperienceEntry}
                          disabled={visibleExperienceCount >= MAX_VISIBLE_EXPERIENCE_ENTRIES}
                        >
                          {visibleExperienceCount >= MAX_VISIBLE_EXPERIENCE_ENTRIES
                            ? 'Maksimal'
                            : 'Tambah'}
                        </button>
                      </div>
                    </div>

                    <div className="candidate-profile-form-stack">
                      {profile.experiences
                        .slice(0, visibleExperienceCount)
                        .map((experienceItem, experienceIndex) => (
                          <div
                            key={`candidate-experience-${experienceIndex}`}
                            className="candidate-profile-experience-entry"
                          >
                            {visibleExperienceCount > 1 && (
                              <div className="candidate-profile-experience-entry-head">
                                <strong>
                                  {experienceIndex === 0
                                    ? 'Pengalaman Utama'
                                    : `Pengalaman ${experienceIndex + 1}`}
                                </strong>
                                {experienceIndex > 0 && (
                                  <button
                                    type="button"
                                    className="candidate-profile-experience-remove"
                                    onClick={() => handleRemoveExperienceEntry(experienceIndex)}
                                    aria-label={`Hapus pengalaman ${experienceIndex + 1}`}
                                    title={`Hapus pengalaman ${experienceIndex + 1}`}
                                  >
                                    -
                                  </button>
                                )}
                              </div>
                            )}

                            <label className="candidate-profile-field">
                              <span>
                                {experienceIndex === 0
                                  ? 'Jabatan Terakhir'
                                  : `Jabatan Sebelumnya ${experienceIndex}`}
                              </span>
                              <input
                                type="text"
                                placeholder="Jabatan terakhir"
                                value={experienceItem.position}
                                onChange={(event) =>
                                  handleExperienceChange(
                                    experienceIndex,
                                    'position',
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="candidate-profile-field">
                              <span>
                                {experienceIndex === 0
                                  ? 'Nama Instansi'
                                  : `Nama Instansi ${experienceIndex + 1}`}
                              </span>
                              <input
                                type="text"
                                placeholder="Nama instansi"
                                value={experienceItem.company}
                                onChange={(event) =>
                                  handleExperienceChange(
                                    experienceIndex,
                                    'company',
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <div className="candidate-profile-inline-grid">
                              <label className="candidate-profile-field">
                                <span>Tahun Mulai</span>
                                <select
                                  value={experienceItem.startYear || ''}
                                  onChange={(event) =>
                                    handleExperienceChange(
                                      experienceIndex,
                                      'startYear',
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="">Pilih tahun mulai</option>
                                  {EXPERIENCE_YEAR_OPTIONS.map((yearOption) => (
                                    <option key={`experience-start-${yearOption}`} value={yearOption}>
                                      {yearOption}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="candidate-profile-field">
                                <span>Tahun Selesai</span>
                                <select
                                  value={experienceItem.endYear || ''}
                                  onChange={(event) =>
                                    handleExperienceChange(
                                      experienceIndex,
                                      'endYear',
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="">Pilih tahun selesai</option>
                                  <option value="current">Masih bekerja</option>
                                  {EXPERIENCE_YEAR_OPTIONS.filter(
                                    (yearOption) =>
                                      !experienceItem.startYear ||
                                      Number(yearOption) >= Number(experienceItem.startYear)
                                  ).map((yearOption) => (
                                    <option key={`experience-end-${yearOption}`} value={yearOption}>
                                      {yearOption}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <label className="candidate-profile-field">
                              <span>Deskripsi Pekerjaan</span>
                              <textarea
                                rows="4"
                                placeholder="Jelaskan tanggung jawab utama, jenis pekerjaan, atau pencapaian singkat Anda."
                                value={experienceItem.responsibilities || ''}
                                onChange={(event) =>
                                  handleExperienceChange(
                                    experienceIndex,
                                    'responsibilities',
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            {(experienceItem.startYear || experienceItem.endYear) && (
                              <p className="candidate-profile-experience-period-note">
                                Rentang: {buildYearRangeLabel(
                                  experienceItem.startYear,
                                  experienceItem.endYear
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </section>

                  <section className="candidate-profile-detail-block">
                    <div className="candidate-profile-detail-head">
                      <span className="candidate-profile-detail-icon">ED</span>
                      <div className="candidate-profile-detail-copy">
                        <div>
                          <h3>Pendidikan Terakhir</h3>
                          <p>Latar belakang akademis tertinggi Anda.</p>
                        </div>
                      </div>
                    </div>

                    <div className="candidate-profile-form-stack">
                      <label className="candidate-profile-field">
                        <span>Pendidikan Terakhir</span>
                        <select
                          value={profile.education.degree || ''}
                          onChange={(event) =>
                            handleEducationChange('degree', event.target.value)
                          }
                        >
                          <option value="">Pilih jenjang pendidikan</option>
                          {CANDIDATE_EDUCATION_LEVEL_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="candidate-profile-field">
                        <span>Universitas / Sekolah</span>
                        <input
                          type="text"
                          placeholder="Universitas / Sekolah"
                          value={profile.education.institution}
                          onChange={(event) =>
                            handleEducationChange('institution', event.target.value)
                          }
                        />
                      </label>
                      <div className="candidate-profile-inline-grid">
                        <label className="candidate-profile-field">
                          <span>Tahun Mulai Pendidikan</span>
                          <select
                            value={profile.education.startYear || ''}
                            onChange={(event) =>
                              handleEducationChange('startYear', event.target.value)
                            }
                          >
                            <option value="">Pilih tahun mulai</option>
                            {EXPERIENCE_YEAR_OPTIONS.map((yearOption) => (
                              <option key={`education-start-${yearOption}`} value={yearOption}>
                                {yearOption}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="candidate-profile-field">
                          <span>Tahun Selesai Pendidikan</span>
                          <select
                            value={profile.education.endYear || ''}
                            onChange={(event) =>
                              handleEducationChange('endYear', event.target.value)
                            }
                          >
                            <option value="">Pilih tahun selesai</option>
                            {EDUCATION_END_STATUS_OPTIONS.map((option) => (
                              <option key={`education-end-status-${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                            {EXPERIENCE_YEAR_OPTIONS.filter(
                              (yearOption) =>
                                !profile.education.startYear ||
                                Number(yearOption) >= Number(profile.education.startYear)
                            ).map((yearOption) => (
                              <option key={`education-end-${yearOption}`} value={yearOption}>
                                {yearOption}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>
                </div>
              </article>

              <article className="candidate-profile-card" data-reveal data-reveal-delay="160ms">
                <div className="candidate-profile-card-head">
                  <div className="candidate-profile-card-title">
                    <span className="candidate-profile-card-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M7 5.5h10M6.5 9.5h11M8.5 13.5h7M9.5 18.5h5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <h2>Organisasi / Relawan</h2>
                  </div>
                </div>

                <div className="candidate-profile-form-stack">
                  <label className="candidate-profile-field">
                    <span>Nama Organisasi / Komunitas</span>
                    <input
                      type="text"
                      placeholder="Contoh: BEM Fakultas, Komunitas Relawan"
                      value={profile.organizationActivity.organizationName || ''}
                      onChange={(event) =>
                        handleOrganizationActivityChange(
                          'organizationName',
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="candidate-profile-field">
                    <span>Peran / Posisi</span>
                    <input
                      type="text"
                      placeholder="Contoh: Koordinator Acara, Volunteer Pendidikan"
                      value={profile.organizationActivity.role || ''}
                      onChange={(event) =>
                        handleOrganizationActivityChange('role', event.target.value)
                      }
                    />
                  </label>

                  <div className="candidate-profile-inline-grid">
                    <label className="candidate-profile-field">
                      <span>Tahun Mulai</span>
                      <select
                        value={profile.organizationActivity.startYear || ''}
                        onChange={(event) =>
                          handleOrganizationActivityChange('startYear', event.target.value)
                        }
                      >
                        <option value="">Pilih tahun mulai</option>
                        {EXPERIENCE_YEAR_OPTIONS.map((yearOption) => (
                          <option key={`organization-start-${yearOption}`} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="candidate-profile-field">
                      <span>Tahun Selesai</span>
                      <select
                        value={profile.organizationActivity.endYear || ''}
                        onChange={(event) =>
                          handleOrganizationActivityChange('endYear', event.target.value)
                        }
                      >
                        <option value="">Pilih tahun selesai</option>
                        <option value="current">{ORGANIZATION_ACTIVITY_CURRENT_LABEL}</option>
                        {EXPERIENCE_YEAR_OPTIONS.filter(
                          (yearOption) =>
                            !profile.organizationActivity.startYear ||
                            Number(yearOption) >= Number(profile.organizationActivity.startYear)
                        ).map((yearOption) => (
                          <option key={`organization-end-${yearOption}`} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="candidate-profile-field">
                    <span>Deskripsi Kegiatan</span>
                    <textarea
                      rows="4"
                      placeholder="Jelaskan kontribusi, kegiatan utama, atau pencapaian Anda saat aktif di organisasi / relawan."
                      value={profile.organizationActivity.description || ''}
                      onChange={(event) =>
                        handleOrganizationActivityChange('description', event.target.value)
                      }
                    />
                  </label>

                  {(profile.organizationActivity.startYear ||
                    profile.organizationActivity.endYear) && (
                    <p className="candidate-profile-experience-period-note">
                      Rentang:{' '}
                      {buildYearRangeLabel(
                        profile.organizationActivity.startYear,
                        profile.organizationActivity.endYear,
                        ORGANIZATION_ACTIVITY_CURRENT_LABEL
                      )}
                    </p>
                  )}
                </div>
              </article>

              <article className="candidate-profile-card" data-reveal data-reveal-delay="200ms">
                <div className="candidate-profile-card-head">
                  <div className="candidate-profile-card-title">
                    <span className="candidate-profile-card-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="M14 4.5V9h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <h2>Dokumen & Ekspektasi</h2>
                  </div>
                </div>

                <div className="candidate-profile-form-stack">
                  <label className="candidate-profile-field">
                    <span>Ekspektasi Gaji (Bulanan)</span>
                    <div className="candidate-profile-salary-shell">
                      <span className="candidate-profile-salary-prefix">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="candidate-profile-salary-input"
                        placeholder="15.000.000"
                        value={formattedSalaryExpectation}
                        onChange={(event) => handleSalaryExpectationChange(event.target.value)}
                      />
                    </div>
                  </label>

                  <div className="candidate-profile-field">
                    <span>Unggah CV / Resume (PDF)</span>
                    <label
                      className="candidate-profile-upload-zone"
                      htmlFor="candidate-resume-upload"
                    >
                      <span className="candidate-profile-upload-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 16V6m0 0-3.5 3.5M12 6l3.5 3.5M5 17.5v1A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-1"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <strong>Pilih File CV</strong>
                      <small>Maks 5MB</small>
                    </label>
                    <input
                      id="candidate-resume-upload"
                      className="candidate-profile-upload-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      onChange={(event) => handleFileChange('resumeFiles', event.target, 3)}
                    />
                  </div>

                  <div className="candidate-profile-resume-preview">
                    <span className="candidate-profile-preview-label">{resumePreviewLabel}</span>
                    {hasResumePreview ? (
                      <div className="candidate-profile-preview-document">
                        <iframe
                          title={`Preview ${resumePreviewName}`}
                          src={resumePreview.url}
                        />
                      </div>
                    ) : (
                      <div className="candidate-profile-preview-sheet" aria-hidden="true">
                        <div className="candidate-profile-preview-sheet-header" />
                        <div className="candidate-profile-preview-sheet-line is-wide" />
                        <div className="candidate-profile-preview-sheet-line" />
                        <div className="candidate-profile-preview-sheet-line" />
                        <div className="candidate-profile-preview-sheet-line is-wide" />
                        <div className="candidate-profile-preview-sheet-grid">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    )}
                    <small>{resumePreviewName}</small>
                    <p className="candidate-profile-preview-hint">{resumePreviewHint}</p>
                  </div>
                </div>
              </article>

              <div className="candidate-profile-actions">
                <button
                  type="button"
                  className="candidate-profile-primary-button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
                <button
                  type="button"
                  className="candidate-profile-secondary-button"
                  onClick={() => handleSectionChange('jobs')}
                >
                  Lanjut Cari Lowongan
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'jobs' && (
          <section className="workspace-section-stack candidate-jobs-layout">
            <div className="candidate-jobs-shell">
              <header className="candidate-jobs-hero" data-reveal>
                <span className="candidate-jobs-kicker">Lowongan Rekomendasi</span>
                <h1>Prioritas lowongan untuk Anda</h1>
                <p>
                  Rekomendasi disusun dari posisi incaran, lokasi minat, dan skill utama yang
                  sudah Anda simpan di profil.
                </p>
              </header>

              {jobsError && <div className="error">{jobsError}</div>}

              <div className="candidate-jobs-card-list">
                {isLoadingJobs ? (
                  <div className="loading">Memuat rekomendasi lowongan...</div>
                ) : recommendedJobs.length === 0 ? (
                  <article className="candidate-jobs-card candidate-jobs-card-empty">
                    <div className="candidate-jobs-empty-head">
                      <strong>Belum ada rekomendasi kuat</strong>
                      <span>Lengkapi minat kerja</span>
                    </div>
                    <p>
                      Tambahkan posisi yang diminati, lokasi prioritas, dan industri target agar
                      sistem bisa menyusun lowongan yang lebih relevan untuk Anda.
                    </p>
                    <button
                      type="button"
                      className="candidate-jobs-primary-button"
                      onClick={() => handleSectionChange('profile')}
                    >
                      Lengkapi Profil
                    </button>
                  </article>
                ) : (
                  recommendedJobs.map((job, index) => {
                    const recruiterName =
                      job.recruiter?.company_name || job.recruiter?.name || 'Recruiter Demo';
                    const matchPercent = formatCandidateJobScorePercent(job);

                    return (
                      <article
                        key={job.id}
                        className="candidate-jobs-card"
                        data-reveal
                        data-reveal-delay={`${Math.min(index, 5) * 40}ms`}
                      >
                        <div className="candidate-jobs-card-head">
                          <div className="candidate-jobs-card-identity">
                            <span className="candidate-jobs-avatar" aria-hidden="true">
                              {buildInitials(recruiterName)}
                            </span>
                            <div className="candidate-jobs-title-wrap">
                              <h2>{job.title}</h2>
                              <span>{recruiterName}</span>
                            </div>
                          </div>
                          <div className="candidate-jobs-match-badge">
                            <strong>{matchPercent}%</strong>
                            <span>COCOK</span>
                          </div>
                        </div>

                        <div className="candidate-jobs-meta-row">
                          <span>{job.location || '-'}</span>
                          <span>{formatCompactExperienceLevel(job.experience_level)}</span>
                          <span>{formatWorkMode(job.work_mode)}</span>
                        </div>

                        <p className="candidate-jobs-description">
                          {truncateJobDescription(job.description)}
                        </p>

                        <div className="candidate-jobs-footer">
                          <div className="candidate-jobs-salary">
                            <small>Estimasi Gaji</small>
                            <strong>
                              {formatCompactSalaryRange(job.salary_min, job.salary_max)}
                            </strong>
                          </div>
                          <button
                            type="button"
                            className="candidate-jobs-primary-button"
                            onClick={() => handleOpenRecommendedJob(job)}
                          >
                            Buka &amp; Lamar
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {activeSection === 'applications' && (
          <section className="workspace-section-stack">
            <article className="workspace-panel" data-reveal>
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Lamaran Saya</span>
                  <h2>Pusat aktivitas setelah apply</h2>
                </div>
                <p>
                  Di sini kandidat melihat proses yang masih aktif, hasil yang sudah selesai, dan
                  tindakan berikutnya untuk setiap lamaran.
                </p>
              </div>

              {applicationsError && <div className="error">{applicationsError}</div>}

              <div className="workspace-application-filter-row">
                <button
                  type="button"
                  className={`workspace-filter-chip${
                    applicationBucket === 'active' ? ' is-active' : ''
                  }`}
                  onClick={() => setApplicationBucket('active')}
                >
                  Aktif ({activeApplications.length})
                </button>
                <button
                  type="button"
                  className={`workspace-filter-chip${
                    applicationBucket === 'completed' ? ' is-active' : ''
                  }`}
                  onClick={() => setApplicationBucket('completed')}
                >
                  Selesai ({completedApplications.length})
                </button>
              </div>

              {isLoadingApplications ? (
                <div className="loading">Memuat lamaran...</div>
              ) : applicationList.length === 0 ? (
                <div className="workspace-card-list">
                  <article className="workspace-subcard">
                    <div className="workspace-subcard-heading">
                      <strong>Belum ada lamaran di kategori ini</strong>
                      <span>Fokus ke langkah berikutnya</span>
                    </div>
                    <p>
                      {applicationBucket === 'active'
                        ? 'Kirim lamaran ke lowongan yang paling cocok agar proses kandidat mulai bergerak.'
                        : 'Semua proses yang sudah selesai akan tampil di sini untuk jadi histori pribadi Anda.'}
                    </p>
                  </article>
                </div>
              ) : (
                <div className="workspace-card-list">
                  {applicationList.map((application) => {
                    const statusMeta = getCandidateApplicationMeta(application.status, application);
                    const timeline = getCandidateApplicationTimeline(application.status, application);

                    return (
                      <article key={application.id} className="workspace-subcard workspace-application-card">
                        <div className="workspace-subcard-heading">
                          <div>
                            <strong>{application.job?.title || 'Lowongan'}</strong>
                            <span>
                              {application.job?.recruiter?.name || 'Recruiter'} •{' '}
                              {application.job?.location || '-'}
                            </span>
                          </div>
                          <span
                            className={`workspace-status-pill workspace-status-pill-${statusMeta.tone}`}
                          >
                            {formatCandidateApplicationStatus(application.status, application)}
                          </span>
                        </div>

                        <p>{statusMeta.summary}</p>

                        <div className="workspace-application-timeline">
                          {timeline.map((step) => (
                            <div
                              key={step.key}
                              className={`workspace-timeline-step${
                                step.done ? ' is-done' : ''
                              }${step.current ? ' is-current' : ''}`}
                            >
                              <span className="workspace-timeline-dot" />
                              <small>{step.label}</small>
                            </div>
                          ))}
                        </div>

                        <div className="workspace-inline-metadata">
                          <span>Dikirim {formatDateTime(application.applied_at)}</span>
                          <span>
                            {formatCurrency(application.job?.salary_min)} -{' '}
                            {formatCurrency(application.job?.salary_max)}
                          </span>
                        </div>

                        {application.cover_letter && (
                          <div className="workspace-application-note">
                            <strong>Catatan lamaran</strong>
                            <p>{application.cover_letter}</p>
                          </div>
                        )}

                        {application.screening_summary?.total_questions > 0 && (
                          <div className="workspace-application-note">
                            <strong>Screening yang Anda kirim</strong>
                            <p>
                              {application.screening_summary.answered_questions}/
                              {application.screening_summary.total_questions} pertanyaan terjawab •{' '}
                              {application.screening_summary.completion_rate}% lengkap
                            </p>
                          </div>
                        )}

                        {Array.isArray(application.screening_answers) &&
                          application.screening_answers.length > 0 && (
                            <div className="workspace-application-note">
                              <strong>Jawaban screening</strong>
                              <div className="workspace-inline-metadata">
                                {application.screening_answers.map((answer) => (
                                  <span key={`${application.id}-${answer.question_id || answer.question}`}>
                                    {answer.question}: {answer.answer}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        {application.video_intro_url && (
                          <div className="workspace-application-note">
                            <strong>Video screening</strong>
                            <p>
                              <a href={application.video_intro_url} target="_blank" rel="noreferrer">
                                Buka link video yang Anda kirim
                              </a>
                            </p>
                          </div>
                        )}

                        <div className="workspace-action-row">
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleSectionChange('jobs')}
                          >
                            Cari Lowongan Serupa
                          </button>
                          {application.job?.recruiter && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleOpenConversation(application.job.recruiter)}
                            >
                              Chat Recruiter
                            </button>
                          )}
                          {isCandidateApplicationActive(application.status, application) && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleWithdrawApplication(application)}
                              disabled={applicationActionInFlightId === application.id}
                            >
                              {applicationActionInFlightId === application.id
                                ? 'Membatalkan...'
                                : 'Batalkan Lamaran'}
                            </button>
                          )}
                          <span className="workspace-muted-text">{statusMeta.nextAction}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'messages' && (
          <InboxWorkspace
            title="Chat pelamar dengan recruiter dan superadmin"
            description="Gunakan chat ini untuk konfirmasi registrasi, pertanyaan screening, atau menindaklanjuti lamaran yang sedang berjalan."
            threads={threads}
            contacts={contacts}
            selectedContact={selectedChatContact}
            selectedContactId={selectedChatContact?.id}
            messages={messages}
            draftMessage={chatDraftMessage}
            onDraftMessageChange={setChatDraftMessage}
            contactSearchQuery={chatSearchQuery}
            onContactSearchQueryChange={setChatSearchQuery}
            onSelectContact={handleOpenConversation}
            onSendMessage={handleSendChatMessage}
            isLoadingThreads={isLoadingThreads}
            isLoadingContacts={isLoadingContacts}
            isLoadingMessages={isLoadingMessages}
            isSendingMessage={isSendingMessage}
            emptyMessage="Pilih recruiter atau superadmin yang ingin Anda hubungi."
          />
        )}
      </main>

      <nav className="candidate-dashboard-mobile-bottom-nav" aria-label="Navigasi cepat pelamar">
        {mobileBottomSections.map((section) => (
          <button
            key={section.value}
            type="button"
            className={`candidate-dashboard-mobile-bottom-link${
              activeSection === section.value ? ' is-active' : ''
            }`}
            onClick={() => handleSectionChange(section.value)}
          >
            <span>{section.mobileLabel || section.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default CandidateDashboardPage;
