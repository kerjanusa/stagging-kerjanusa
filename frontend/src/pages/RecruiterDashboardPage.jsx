import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import InboxWorkspace from '../components/InboxWorkspace.jsx';
import RecruiterTopbar from '../components/RecruiterTopbar.jsx';
import TalentSearchPanel from '../components/TalentSearchPanel.jsx';
import useApplications from '../hooks/useApplications.js';
import useAuth from '../hooks/useAuth.js';
import useChat from '../hooks/useChat.js';
import useJobs from '../hooks/useJobs.js';
import RecruiterWorkspaceService from '../services/recruiterWorkspaceService.js';
import { readCandidateProfile } from '../utils/candidateFlow.js';
import { CONTACT_WHATSAPP_LINK } from '../utils/contactLinks.js';
import {
  APPLICATION_STAGE_OPTIONS,
  RECRUITER_COMPANY_EMPLOYEE_RANGE_OPTIONS,
  RECRUITER_PRIMARY_SECTION_OPTIONS,
  RECRUITER_JOB_WORKFLOW_OPTIONS,
  RECRUITER_SECTION_OPTIONS,
  RECRUITER_COMPANY_VERIFICATION_STATUS_LABELS,
  getApplicationStage,
    getApplicationStageLabel,
    getJobWorkflowLabel,
    getJobWorkflowStatus,
    getJobWorkflowTone,
    getRecruiterCompanyDescriptionLength,
    getRecruiterApplicationStageMeta,
    getRecruiterCompanyCompletion,
  getRecruiterOverviewNextAction,
  hasRecruiterCompanyLegalDocument,
  hasRecruiterCompanyLogo,
  isRecruiterApplicationStageActive,
  mapApplicationStageToBackendStatus,
  mapJobWorkflowToBackendStatus,
  readRecruiterCompanyProfile,
  saveApplicationStage,
  saveJobWorkflowStatus,
  saveRecruiterCompanyProfile,
  } from '../utils/recruiterFlow.js';
  import { formatRecruiterPlanDocuments } from '../utils/recruiterPlans.js';
  import { formatExperienceLevel, formatWorkMode } from '../utils/jobFormatters.js';
  import { APP_ROUTES, getJobApplyRoute } from '../utils/routeHelpers.js';
import '../styles/workspace.css';
import '../styles/recruiterDashboard.css';
const RECRUITER_SUPPORT_WHATSAPP_LINK = CONTACT_WHATSAPP_LINK;
const RECRUITER_COMPANY_LOGO_MAX_FILE_SIZE_IN_BYTES = 2 * 1024 * 1024;
const RECRUITER_COMPANY_LEGAL_DOCUMENT_MAX_FILE_SIZE_IN_BYTES = 2 * 1024 * 1024;
const RECRUITER_COMPANY_LOGO_MAX_DIMENSION_IN_PIXELS = 360;
const RECRUITER_COMPANY_LOGO_OUTPUT_QUALITY = 0.84;
const RECRUITER_COMPANY_LOGO_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
]);
const RECRUITER_COMPANY_LEGAL_DOCUMENT_ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
]);

const RECRUITER_MOBILE_BOTTOM_SECTIONS = [
  { value: 'company', label: 'Profil', icon: 'user' },
  { value: 'jobs', label: 'Lowongan', icon: 'briefcase' },
  { value: 'candidates', label: 'Pelamar', icon: 'clipboard' },
  { value: 'messages', label: 'Chat', icon: 'message' },
];

const RECRUITER_FAVORITE_APPLICATIONS_STORAGE_PREFIX = 'recruiter_favorite_applications';
const RECRUITER_FAVORITE_TALENTS_STORAGE_PREFIX = 'recruiter_favorite_talents';
const RECRUITER_HIDDEN_APPLICATIONS_STORAGE_PREFIX = 'recruiter_hidden_applications';

const RECRUITER_CANDIDATE_GENDER_FILTER_OPTIONS = [
  { value: 'all', label: 'Semua gender' },
  { value: 'male', label: 'Pria' },
  { value: 'female', label: 'Wanita' },
];

const RECRUITER_CANDIDATE_EXPERIENCE_FILTER_OPTIONS = [
  { value: 'all', label: 'Semua pengalaman' },
  { value: 'fresh-graduate', label: 'Freshgraduate' },
  { value: 'experienced', label: 'Berpengalaman' },
];

const RECRUITER_CANDIDATE_SALARY_FILTER_OPTIONS = [
  { value: 'all', label: 'Semua ekspektasi gaji' },
  { value: 'under-3000000', label: '< Rp 3 jt' },
  { value: '3000000-5000000', label: 'Rp 3 jt - 5 jt' },
  { value: '5000000-8000000', label: 'Rp 5 jt - 8 jt' },
  { value: 'above-8000000', label: '> Rp 8 jt' },
];

const RECRUITER_CANDIDATE_SORT_OPTIONS = [
  { value: 'recommended', label: 'Rekomendasi' },
  { value: 'latest', label: 'Pelamar Terbaru' },
  { value: 'experience', label: 'Paling Berpengalaman' },
];

const createTalentSearchFilters = () => ({
  job_id: '',
  experience_level: '',
  location: '',
  age_min: '',
  age_max: '',
  gender: '',
});

const normalizeTalentGenderValue = (value = '') => {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (['male', 'pria', 'laki-laki', 'laki laki'].includes(normalizedValue)) {
    return 'male';
  }

  if (['female', 'wanita', 'perempuan'].includes(normalizedValue)) {
    return 'female';
  }

  return '';
};

const resolveTalentExperienceLevelFromJob = (job) => {
  const normalizedCandidateExperience = String(job?.candidate_experience || '')
    .trim()
    .toLowerCase();

  if (['entry', 'junior', 'mid', 'senior'].includes(normalizedCandidateExperience)) {
    return normalizedCandidateExperience;
  }

  const normalizedExperienceLevel = String(job?.experience_level || '').trim().toLowerCase();
  return ['entry', 'junior', 'mid', 'senior'].includes(normalizedExperienceLevel)
    ? normalizedExperienceLevel
    : '';
};

const buildTalentFiltersFromJob = (job) => {
  if (!job) {
    return createTalentSearchFilters();
  }

  return {
    job_id: String(job.id || ''),
    experience_level: resolveTalentExperienceLevelFromJob(job),
    location: String(job.candidate_domicile || job.location || '').trim(),
    age_min: job.candidate_no_age_limit ? '' : String(job.candidate_age_min || '').trim(),
    age_max: job.candidate_no_age_limit ? '' : String(job.candidate_age_max || '').trim(),
    gender: normalizeTalentGenderValue(job.candidate_gender),
  };
};

/**
 * Menyusun inisial singkat untuk fallback logo recruiter.
 */
const buildRecruiterInitials = (value) => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return 'R';
  }

  const segments = normalizedValue.split(/\s+/).filter(Boolean).slice(0, 2);
  return segments.map((segment) => segment.charAt(0).toUpperCase()).join('') || 'R';
};

/**
 * Memastikan file logo recruiter menggunakan mime type gambar yang diizinkan.
 */
const isSupportedRecruiterLogoFile = (file) =>
  Boolean(file && RECRUITER_COMPANY_LOGO_ALLOWED_TYPES.has(String(file.type || '').toLowerCase()));

/**
 * Memastikan dokumen legal perusahaan memakai format file yang diizinkan.
 */
const isSupportedRecruiterLegalDocumentFile = (file) =>
  Boolean(
    file &&
      RECRUITER_COMPANY_LEGAL_DOCUMENT_ALLOWED_TYPES.has(String(file.type || '').toLowerCase())
  );

/**
 * Validasi URL ringan untuk field website / sosial media perusahaan.
 */
const isValidCompanyLink = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validasi format email ringan untuk mencegah submit yang jelas salah dari UI.
 */
const isValidCompanyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

/**
 * Format ukuran file supaya nama dokumen dan batas upload lebih mudah dipahami recruiter.
 */
const formatFileSize = (value) => {
  const numericValue = Math.max(0, Number(value || 0));

  if (numericValue >= 1024 * 1024) {
    return `${(numericValue / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (numericValue >= 1024) {
    return `${Math.round(numericValue / 1024)} KB`;
  }

  return `${numericValue} B`;
};

/**
 * Mengompres logo perusahaan menjadi data URL yang aman untuk preview dan simpan profil recruiter.
 */
const convertRecruiterLogoToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Browser tidak mendukung upload logo perusahaan.'));
      return;
    }

    const imageUrl = window.URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      const scaleRatio = Math.min(
        1,
        RECRUITER_COMPANY_LOGO_MAX_DIMENSION_IN_PIXELS / Math.max(image.width, image.height)
      );
      const targetWidth = Math.max(1, Math.round(image.width * scaleRatio));
      const targetHeight = Math.max(1, Math.round(image.height * scaleRatio));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      window.URL.revokeObjectURL(imageUrl);

      if (!context) {
        reject(new Error('Preview logo belum bisa diproses di browser ini.'));
        return;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      resolve(canvas.toDataURL('image/jpeg', RECRUITER_COMPANY_LOGO_OUTPUT_QUALITY));
    };

    image.onerror = () => {
      window.URL.revokeObjectURL(imageUrl);
      reject(new Error('File logo belum bisa dibaca. Coba gunakan gambar lain.'));
    };

    image.src = imageUrl;
  });

/**
 * Mengubah hash URL recruiter menjadi nama section yang valid untuk dashboard.
 */
const resolveRecruiterSectionFromHash = (hash) => {
  const normalizedHash = hash.replace(/^#/, '');

  if (!normalizedHash) {
    return 'jobs';
  }

  if (RECRUITER_SECTION_OPTIONS.some((section) => section.value === normalizedHash)) {
    return normalizedHash;
  }

  return 'jobs';
};

/**
 * Menyusun URL section recruiter dari satu helper agar navigasi hash konsisten.
 */
const getRecruiterSectionRoute = (section) =>
  section === 'jobs'
    ? APP_ROUTES.recruiterDashboard
    : `${APP_ROUTES.recruiterDashboard}#${section}`;

/**
 * Memformat nilai uang recruiter ke bentuk rupiah sederhana.
 */
const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return `Rp ${numericValue.toLocaleString('id-ID')}`;
};

/**
 * Memformat tanggal dan waktu untuk daftar lowongan, kandidat, dan aktivitas recruiter.
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
 * Membentuk label jumlah tunggal atau jamak untuk ringkasan recruiter.
 */
const formatPlural = (count, singularLabel, pluralLabel = singularLabel) =>
  `${count} ${count === 1 ? singularLabel : pluralLabel}`;

/**
 * Merapikan tanggal singkat untuk badge dan metadata recruiter.
 */
const formatDateLabel = (value) => {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

/**
 * Menentukan label pendidikan kandidat dari profil dashboard.
 */
const getCandidateEducationLabel = (profile) =>
  String(profile?.education?.degree || profile?.education?.major || '').trim() || 'Belum diisi';

/**
 * Menyusun label pengalaman kandidat dari isi profil yang tersedia.
 */
const getCandidateExperienceType = (profile) => {
  const experienceEntries = Array.isArray(profile?.experiences)
    ? profile.experiences.filter((item) => item?.company?.trim() || item?.position?.trim())
    : [];

  return experienceEntries.length > 0 ? 'experienced' : 'fresh-graduate';
};

/**
 * Menghitung usia kandidat dari field usia langsung atau tanggal lahir bila tersedia.
 */
const getCandidateAge = (profile) => {
  const explicitAge = Number(profile?.age || 0);

  if (explicitAge > 0) {
    return explicitAge;
  }

  if (!profile?.dateOfBirth) {
    return null;
  }

  const birthDate = new Date(profile.dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age > 0 ? age : null;
};

/**
 * Memeriksa apakah ekspektasi gaji kandidat masuk ke bucket filter recruiter.
 */
const matchesCandidateSalaryFilter = (salaryValue, filterValue) => {
  if (filterValue === 'all') {
    return true;
  }

  if (!salaryValue) {
    return false;
  }

  switch (filterValue) {
    case 'under-3000000':
      return salaryValue < 3000000;
    case '3000000-5000000':
      return salaryValue >= 3000000 && salaryValue <= 5000000;
    case '5000000-8000000':
      return salaryValue > 5000000 && salaryValue <= 8000000;
    case 'above-8000000':
      return salaryValue > 8000000;
    default:
      return true;
  }
};

/**
 * Mengunduh ringkasan kandidat sederhana agar recruiter bisa membawa data keluar dashboard.
 */
const downloadTextFile = (filename, content) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new window.Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
};

/**
 * Membuat nama file aman untuk unduhan ringkasan CV kandidat dari fitur kolam pelamar.
 */
const slugifyDownloadValue = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kandidat';

/**
 * Menentukan nama kontak yang ditampilkan pada inbox recruiter.
 */
const resolveContactLabel = (contact) => {
  if (!contact) {
    return 'Kontak';
  }

  if (contact.role === 'recruiter') {
    return contact.company_name || contact.name || 'Recruiter';
  }

  if (contact.role === 'superadmin') {
    return 'Superadmin KerjaNusa';
  }

  return contact.name || 'Kandidat';
};

/**
 * Memberi arahan singkat untuk item checklist profil company yang belum lengkap.
 */
const getRecruiterChecklistGuidance = (item) => {
  if (item.isComplete) {
    return 'Komponen company ini sudah bisa dipakai untuk meyakinkan kandidat.';
  }

  switch (item.key) {
    case 'companyLogo':
      return 'Unggah logo perusahaan agar identitas recruiter terlihat profesional di menu dan dashboard.';
    case 'companyName':
      return 'Nama brand perusahaan membantu kandidat mengenali siapa yang membuka lowongan.';
    case 'legalCompanyName':
      return 'Nama legal dibutuhkan untuk dasar verifikasi perusahaan oleh superadmin.';
    case 'industry':
      return 'Industri perusahaan memberi konteks bisnis yang jelas untuk kandidat dan admin.';
    case 'employeeRange':
      return 'Jumlah tenaga kerja membantu menjelaskan skala operasional perusahaan.';
    case 'website':
      return 'Link website atau sosial media aktif membantu proses verifikasi identitas perusahaan.';
    case 'companyDescription':
      return 'Deskripsi minimal 80 karakter dibutuhkan agar profil perusahaan layak ditinjau.';
    case 'companyLegalDocument':
      return 'Lampirkan NIB atau dokumen legal perusahaan agar admin bisa memverifikasi bisnis Anda.';
    case 'recruiterName':
      return 'Nama PIC diperlukan agar admin tahu siapa penanggung jawab profil perusahaan ini.';
    case 'companyEmail':
      return 'Email perusahaan atau PIC wajib valid agar proses verifikasi bisa dihubungi kembali.';
    case 'phone':
      return 'Nomor kontak aktif dibutuhkan untuk tindak lanjut verifikasi recruiter.';
    case 'companyAddress':
      return 'Alamat perusahaan yang jelas membantu proses validasi identitas bisnis.';
    default:
      return 'Lengkapi komponen ini agar lowongan aktif terlihat lebih kredibel dan siap dipublikasikan.';
  }
};

/**
 * Validasi inti profil perusahaan sebelum recruiter menyimpan dan mengajukan verifikasi.
 */
const getRecruiterCompanyValidationMessage = (profile) => {
  if (!hasRecruiterCompanyLogo(profile)) {
    return 'Unggah logo perusahaan terlebih dahulu.';
  }

  if (!String(profile.companyName || '').trim()) {
    return 'Nama brand perusahaan wajib diisi.';
  }

  if (!String(profile.legalCompanyName || '').trim()) {
    return 'Nama legal perusahaan wajib diisi.';
  }

  if (!String(profile.industry || '').trim()) {
    return 'Industri perusahaan wajib diisi.';
  }

  if (!String(profile.employeeRange || '').trim()) {
    return 'Pilih jumlah tenaga kerja perusahaan terlebih dahulu.';
  }

  if (!String(profile.website || '').trim()) {
    return 'Link website atau sosial media perusahaan wajib diisi.';
  }

  if (!isValidCompanyLink(profile.website)) {
    return 'Link website atau sosial media perusahaan wajib berupa URL yang valid.';
  }

  if (getRecruiterCompanyDescriptionLength(profile) < 80) {
    return 'Deskripsi perusahaan minimal 80 karakter.';
  }

  if (!hasRecruiterCompanyLegalDocument(profile)) {
    return 'Lampirkan dokumen legal perusahaan atau NIB terlebih dahulu.';
  }

  if (!String(profile.recruiterName || '').trim()) {
    return 'Nama PIC perusahaan wajib diisi.';
  }

  if (!String(profile.companyEmail || '').trim()) {
    return 'Email perusahaan / PIC wajib diisi.';
  }

  if (!isValidCompanyEmail(profile.companyEmail)) {
    return 'Email perusahaan / PIC wajib menggunakan format email yang valid.';
  }

  if (!String(profile.phone || '').trim()) {
    return 'Nomor kontak perusahaan wajib diisi.';
  }

  if (!String(profile.companyAddress || '').trim()) {
    return 'Alamat perusahaan wajib diisi.';
  }

  return null;
};

/**
 * Menjadi workspace utama recruiter untuk lowongan, kandidat, paket, company profile, dan chat.
 */
const RecruiterDashboardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, updateProfile, getCurrentUser } = useAuth();
  const {
    jobs,
    isLoading: isLoadingJobs,
    error: jobsError,
    getMyJobs,
    createJob,
    updateJob,
    deleteJob,
  } = useJobs();
  const {
    applications,
    isLoading: isLoadingApplications,
    error: applicationsError,
    getJobApplications,
    updateApplicationStatus,
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
  const [activeSection, setActiveSection] = useState(resolveRecruiterSectionFromHash(location.hash));
  const [companyProfile, setCompanyProfile] = useState(() => readRecruiterCompanyProfile(user));
  const [feedback, setFeedback] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateStageFilter, setCandidateStageFilter] = useState('all');
  const [candidateFavoriteFilter, setCandidateFavoriteFilter] = useState('all');
  const [candidateGenderFilter, setCandidateGenderFilter] = useState('all');
  const [candidateEducationFilter, setCandidateEducationFilter] = useState('all');
  const [candidateExperienceFilter, setCandidateExperienceFilter] = useState('all');
  const [candidateSalaryFilter, setCandidateSalaryFilter] = useState('all');
  const [candidateSortOrder, setCandidateSortOrder] = useState('recommended');
  const [jobWorkflowFilter, setJobWorkflowFilter] = useState('all');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [companyLegalDocumentFile, setCompanyLegalDocumentFile] = useState(null);
  const [jobActionInFlightId, setJobActionInFlightId] = useState(null);
  const [applicationActionInFlightId, setApplicationActionInFlightId] = useState(null);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [favoriteApplicationIds, setFavoriteApplicationIds] = useState([]);
  const [favoriteTalentIds, setFavoriteTalentIds] = useState([]);
  const [hiddenApplicationIds, setHiddenApplicationIds] = useState([]);
  const [packageOverview, setPackageOverview] = useState({
    current: companyProfile.plan || null,
    catalog: [],
  });
  const [isLoadingPackage, setIsLoadingPackage] = useState(false);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [talentFilters, setTalentFilters] = useState(createTalentSearchFilters);
  const [talentCandidates, setTalentCandidates] = useState([]);
  const [talentPagination, setTalentPagination] = useState(null);
  const [isLoadingTalent, setIsLoadingTalent] = useState(false);
  const [hasLoadedTalent, setHasLoadedTalent] = useState(false);
  const [selectedChatContact, setSelectedChatContact] = useState(null);
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  useEffect(() => {
    setActiveSection(resolveRecruiterSectionFromHash(location.hash));
  }, [location.hash]);

  useEffect(() => {
    setCompanyProfile(readRecruiterCompanyProfile(user));
    setCompanyLegalDocumentFile(null);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const favoriteStorageKey = `${RECRUITER_FAVORITE_APPLICATIONS_STORAGE_PREFIX}:${user?.id || 'guest'}`;
      const favoriteTalentStorageKey = `${RECRUITER_FAVORITE_TALENTS_STORAGE_PREFIX}:${user?.id || 'guest'}`;
      const hiddenStorageKey = `${RECRUITER_HIDDEN_APPLICATIONS_STORAGE_PREFIX}:${user?.id || 'guest'}`;
      const storedFavorites = JSON.parse(window.localStorage.getItem(favoriteStorageKey) || '[]');
      const storedFavoriteTalents = JSON.parse(
        window.localStorage.getItem(favoriteTalentStorageKey) || '[]'
      );
      const storedHidden = JSON.parse(window.localStorage.getItem(hiddenStorageKey) || '[]');
      setFavoriteApplicationIds(Array.isArray(storedFavorites) ? storedFavorites : []);
      setFavoriteTalentIds(Array.isArray(storedFavoriteTalents) ? storedFavoriteTalents : []);
      setHiddenApplicationIds(Array.isArray(storedHidden) ? storedHidden : []);
    } catch {
      setFavoriteApplicationIds([]);
      setFavoriteTalentIds([]);
      setHiddenApplicationIds([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const favoriteStorageKey = `${RECRUITER_FAVORITE_APPLICATIONS_STORAGE_PREFIX}:${user?.id || 'guest'}`;
    window.localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteApplicationIds));
  }, [favoriteApplicationIds, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const favoriteTalentStorageKey = `${RECRUITER_FAVORITE_TALENTS_STORAGE_PREFIX}:${user?.id || 'guest'}`;
    window.localStorage.setItem(favoriteTalentStorageKey, JSON.stringify(favoriteTalentIds));
  }, [favoriteTalentIds, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hiddenStorageKey = `${RECRUITER_HIDDEN_APPLICATIONS_STORAGE_PREFIX}:${user?.id || 'guest'}`;
    window.localStorage.setItem(hiddenStorageKey, JSON.stringify(hiddenApplicationIds));
  }, [hiddenApplicationIds, user?.id]);

  useEffect(() => {
    setPackageOverview((currentOverview) => ({
      current: companyProfile.plan || currentOverview.current,
      catalog: currentOverview.catalog,
    }));
  }, [companyProfile]);

  useEffect(() => {
    if (user?.role === 'recruiter') {
      getMyJobs(1, 100);
    }
  }, [getMyJobs, user?.id, user?.role]);

  useEffect(() => {
    if (!location.state?.recruiterNotice) {
      return;
    }

    setFeedback({
      type: 'success',
      message: location.state.recruiterNotice,
    });
    navigate(`${APP_ROUTES.recruiterDashboard}${location.hash}`, { replace: true });
  }, [location.hash, location.state, navigate]);

  const companyCompletion = useMemo(
    () => getRecruiterCompanyCompletion(companyProfile),
    [companyProfile]
  );
  const companyDescriptionLength = useMemo(
    () => getRecruiterCompanyDescriptionLength(companyProfile),
    [companyProfile]
  );
  const companyVerificationStatus = useMemo(() => {
    const statusKey =
      companyProfile.verificationStatus === 'verified' || companyProfile.verificationStatus === 'pending'
        ? companyProfile.verificationStatus
        : 'draft';

    if (statusKey === 'verified') {
      return {
        key: 'verified',
        label: RECRUITER_COMPANY_VERIFICATION_STATUS_LABELS.verified,
        tone: 'verified',
        summary: companyProfile.verifiedAt
          ? `Profil perusahaan telah diverifikasi pada ${formatDateTime(companyProfile.verifiedAt)}.`
          : 'Profil perusahaan telah diverifikasi oleh superadmin KerjaNusa.',
      };
    }

    if (statusKey === 'pending') {
      return {
        key: 'pending',
        label: RECRUITER_COMPANY_VERIFICATION_STATUS_LABELS.pending,
        tone: 'review',
        summary: companyProfile.verificationSubmittedAt
          ? `Data dikirim untuk verifikasi pada ${formatDateTime(companyProfile.verificationSubmittedAt)}.`
          : 'Data perusahaan Anda sedang menunggu verifikasi superadmin KerjaNusa.',
      };
    }

    return {
      key: 'draft',
      label: RECRUITER_COMPANY_VERIFICATION_STATUS_LABELS.draft,
      tone: 'muted',
      summary: companyCompletion.isReady
        ? 'Profil sudah lengkap dan akan diajukan ke verifikasi saat disimpan.'
        : 'Lengkapi seluruh kolom wajib sebelum profil perusahaan bisa diajukan ke verifikasi.',
    };
  }, [companyCompletion.isReady, companyProfile.verifiedAt, companyProfile.verificationStatus, companyProfile.verificationSubmittedAt]);
  const recruiterIdentityLabel =
    companyProfile.companyName || companyProfile.recruiterName || user?.company_name || user?.name;
  const recruiterCompanyLogoUrl = companyProfile.companyLogoDataUrl || user?.profile_picture || '';
  const recruiterCompanyLogoInitials = buildRecruiterInitials(recruiterIdentityLabel);

  const recruiterJobs = useMemo(
    () =>
      jobs.map((job) => {
        const workflowStatus = getJobWorkflowStatus(job);
        const applicationsCount = Number(job.applications_count) || 0;
        const viewsCount = Math.max(Number(job.views_count) || 0, applicationsCount * 9);
        const boostCount = Number(job.boost_count) || 0;

        return {
          ...job,
          workflowStatus,
          workflowLabel: getJobWorkflowLabel(workflowStatus),
          workflowTone: getJobWorkflowTone(workflowStatus),
          applicationsCount,
          viewsCount,
          boostCount,
          publishedAt: job.published_at || (workflowStatus === 'active' ? job.updated_at || job.created_at : ''),
          reviewRequestedAt:
            job.review_requested_at ||
            (workflowStatus === 'review' ? job.updated_at || job.created_at : ''),
          rejectionNote:
            job.workflow_note ||
            (workflowStatus === 'rejected'
              ? 'Lowongan ditolak. Periksa kembali detail lowongan sebelum diajukan ulang.'
              : ''),
        };
      }),
    [jobs]
  );

  useEffect(() => {
    if (!recruiterJobs.length) {
      setSelectedJobId(null);
      return;
    }

    if (recruiterJobs.some((job) => Number(job.id) === Number(selectedJobId))) {
      return;
    }

    const defaultJob =
      recruiterJobs.find((job) => job.workflowStatus === 'active') || recruiterJobs[0];
    setSelectedJobId(defaultJob.id);
  }, [recruiterJobs, selectedJobId]);

  useEffect(() => {
    if (!recruiterJobs.length) {
      setTalentFilters(createTalentSearchFilters());
      return;
    }

    setTalentFilters((currentFilters) => {
      if (
        currentFilters.job_id &&
        recruiterJobs.some((job) => Number(job.id) === Number(currentFilters.job_id))
      ) {
        return currentFilters;
      }

      const defaultTalentJob =
        recruiterJobs.find((job) => Number(job.id) === Number(selectedJobId)) ||
        recruiterJobs.find((job) => job.workflowStatus === 'active') ||
        recruiterJobs[0];

      return buildTalentFiltersFromJob(defaultTalentJob);
    });
  }, [recruiterJobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    getJobApplications(selectedJobId, 1, 100);
  }, [getJobApplications, selectedJobId]);

  useEffect(() => {
    let isMounted = true;

    const loadPackage = async () => {
      if (user?.role !== 'recruiter') {
        return;
      }

      setIsLoadingPackage(true);

      try {
        const packageData = await RecruiterWorkspaceService.getPackageOverview();

        if (!isMounted) {
          return;
        }

        setPackageOverview(packageData);
      } catch {
        if (isMounted) {
          setPackageOverview((currentOverview) => ({
            current: companyProfile.plan || currentOverview.current,
            catalog: currentOverview.catalog,
          }));
        }
      } finally {
        if (isMounted) {
          setIsLoadingPackage(false);
        }
      }
    };

    loadPackage();

    return () => {
      isMounted = false;
    };
  }, [companyProfile.plan, user?.id, user?.role]);

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

  useEffect(() => {
    if (activeSection !== 'talent' || hasLoadedTalent) {
      return;
    }

    const loadTalent = async () => {
      setIsLoadingTalent(true);

      try {
        const result = await RecruiterWorkspaceService.searchTalent(talentFilters, 1, 12);
        setTalentCandidates(result.data || []);
        setTalentPagination(result.pagination || null);
      } catch {
        // Surface error through manual search action to avoid noisy first load feedback.
      } finally {
        setIsLoadingTalent(false);
        setHasLoadedTalent(true);
      }
    };

    loadTalent();
  }, [activeSection, hasLoadedTalent, talentFilters]);

  const selectedJob = useMemo(
    () => recruiterJobs.find((job) => Number(job.id) === Number(selectedJobId)) || null,
    [recruiterJobs, selectedJobId]
  );
  const selectedTalentJob = useMemo(
    () => recruiterJobs.find((job) => Number(job.id) === Number(talentFilters.job_id)) || null,
    [recruiterJobs, talentFilters.job_id]
  );

  const recruiterApplications = useMemo(
    () =>
      applications.map((application) => {
        const candidateProfile = readCandidateProfile(application.candidate);
        const stage = getApplicationStage(application);
        const stageMeta = getRecruiterApplicationStageMeta(stage);
        const experienceEntries = Array.isArray(candidateProfile.experiences)
          ? candidateProfile.experiences.filter(
              (item) => item?.company?.trim() || item?.position?.trim()
            ).length
          : 0;
        const educationLabel = getCandidateEducationLabel(candidateProfile);
        const experienceType = getCandidateExperienceType(candidateProfile);
        const age = getCandidateAge(candidateProfile);
        const expectedSalary = Number(
          candidateProfile.salaryMax || candidateProfile.salaryMin || 0
        );
        const recommendationScore =
          (stage !== 'rejected' ? 24 : 0) +
          Math.min(24, experienceEntries * 8) +
          Math.min(16, (candidateProfile.skills || []).filter((item) => item.trim()).length * 4) +
          Math.min(18, application.screening_summary?.completion_rate || 0) +
          (application.video_intro_url ? 8 : 0) +
          (candidateProfile.profileSummary ? 10 : 0);

        return {
          ...application,
          stage,
          stageLabel: getApplicationStageLabel(stage),
          stageMeta,
          candidateProfile,
          candidateEducationLabel: educationLabel,
          candidateExperienceType: experienceType,
          candidateExperienceEntries: experienceEntries,
          candidateGender: String(candidateProfile.gender || '').trim().toLowerCase() || 'unknown',
          candidateAge: age,
          candidateExpectedSalary: expectedSalary,
          recommendationScore,
          isFavorited: favoriteApplicationIds.includes(application.id),
        };
      }),
    [applications, favoriteApplicationIds]
  );

  const visibleRecruiterApplications = useMemo(
    () =>
      recruiterApplications.filter(
        (application) => !hiddenApplicationIds.includes(Number(application.id))
      ),
    [hiddenApplicationIds, recruiterApplications]
  );

  const candidateStageCounts = useMemo(() => {
    const counts = { all: visibleRecruiterApplications.length };

    APPLICATION_STAGE_OPTIONS.forEach((option) => {
      counts[option.value] = visibleRecruiterApplications.filter(
        (application) => application.stage === option.value
      ).length;
    });

    return counts;
  }, [visibleRecruiterApplications]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = jobSearchQuery.trim().toLowerCase();

    return recruiterJobs.filter((job) => {
      const matchesWorkflow =
        jobWorkflowFilter === 'all' ? true : job.workflowStatus === jobWorkflowFilter;
      const matchesSearch =
        !normalizedQuery ||
        [job.title, job.location, job.category, job.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesWorkflow && matchesSearch;
    });
  }, [jobSearchQuery, jobWorkflowFilter, recruiterJobs]);

  const candidateEducationOptions = useMemo(() => {
    const options = visibleRecruiterApplications
      .map((application) => application.candidateEducationLabel)
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((firstValue, secondValue) => firstValue.localeCompare(secondValue));

    return [{ value: 'all', label: 'Semua pendidikan' }, ...options.map((value) => ({ value, label: value }))];
  }, [visibleRecruiterApplications]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = candidateSearchQuery.trim().toLowerCase();

    return visibleRecruiterApplications
      .filter((application) => {
        const matchesStage =
          candidateStageFilter === 'all' ? true : application.stage === candidateStageFilter;
        const matchesFavorite =
          candidateFavoriteFilter === 'all'
            ? true
            : candidateFavoriteFilter === 'favorite'
              ? application.isFavorited
              : !application.isFavorited;
        const matchesGender =
          candidateGenderFilter === 'all'
            ? true
            : application.candidateGender === candidateGenderFilter;
        const matchesEducation =
          candidateEducationFilter === 'all'
            ? true
            : application.candidateEducationLabel === candidateEducationFilter;
        const matchesExperience =
          candidateExperienceFilter === 'all'
            ? true
            : application.candidateExperienceType === candidateExperienceFilter;
        const matchesSalary = matchesCandidateSalaryFilter(
          application.candidateExpectedSalary,
          candidateSalaryFilter
        );
        const matchesSearch =
          !normalizedQuery ||
          [
            application.candidate?.name,
            application.candidate?.email,
            application.candidate?.phone,
            application.job?.title,
            application.candidateProfile?.currentAddress,
            application.candidateProfile?.profileSummary,
            application.candidateEducationLabel,
            ...(application.candidateProfile?.skills || []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);

        return (
          matchesStage &&
          matchesFavorite &&
          matchesGender &&
          matchesEducation &&
          matchesExperience &&
          matchesSalary &&
          matchesSearch
        );
      })
      .sort((firstApplication, secondApplication) => {
        if (candidateSortOrder === 'latest') {
          return (
            new Date(secondApplication.applied_at || secondApplication.created_at || 0).getTime() -
            new Date(firstApplication.applied_at || firstApplication.created_at || 0).getTime()
          );
        }

        if (candidateSortOrder === 'experience') {
          return secondApplication.candidateExperienceEntries - firstApplication.candidateExperienceEntries;
        }

        return secondApplication.recommendationScore - firstApplication.recommendationScore;
      });
  }, [
    candidateEducationFilter,
    candidateExperienceFilter,
    candidateFavoriteFilter,
    candidateGenderFilter,
    candidateSalaryFilter,
    candidateSearchQuery,
    candidateSortOrder,
    candidateStageFilter,
    visibleRecruiterApplications,
  ]);

  const activeApplicationsCount = useMemo(
    () =>
      recruiterApplications.filter((application) =>
        isRecruiterApplicationStageActive(application.stage)
      ).length,
    [recruiterApplications]
  );
  const recruiterApplicationVolume = useMemo(
    () =>
      recruiterJobs.reduce(
        (totalApplications, job) => totalApplications + (Number(job.applications_count) || 0),
        0
      ),
    [recruiterJobs]
  );

  const dashboardMetrics = useMemo(() => {
    const activeJobs = recruiterJobs.filter((job) => job.workflowStatus === 'active').length;
    const draftJobs = recruiterJobs.filter((job) => job.workflowStatus === 'draft').length;
    const closedJobs = recruiterJobs.filter((job) =>
      ['closed', 'filled', 'paused'].includes(job.workflowStatus)
    ).length;
    const hiredCandidates = recruiterApplications.filter(
      (application) => application.stage === 'hired'
    ).length;

    return {
      activeJobs,
      draftJobs,
      closedJobs,
      hiredCandidates,
      activeApplications: activeApplicationsCount,
      totalApplications: recruiterApplicationVolume,
    };
  }, [activeApplicationsCount, recruiterApplicationVolume, recruiterApplications, recruiterJobs]);

  const nextAction = useMemo(
    () =>
      getRecruiterOverviewNextAction({
        companyCompletion,
        jobs: recruiterJobs,
        activeApplicationsCount,
      }),
    [activeApplicationsCount, companyCompletion, recruiterJobs]
  );
  const recruiterOverviewFocusedApplications = useMemo(
    () =>
      recruiterApplications
        .filter((application) => isRecruiterApplicationStageActive(application.stage))
        .slice(0, 1),
    [recruiterApplications]
  );

  const jobWorkflowCounts = useMemo(() => {
    const counts = { all: recruiterJobs.length };

    RECRUITER_JOB_WORKFLOW_OPTIONS.forEach((option) => {
      counts[option.value] = recruiterJobs.filter((job) => job.workflowStatus === option.value).length;
    });

    return counts;
  }, [recruiterJobs]);

  const selectedFilteredApplicationIds = filteredApplications
    .map((application) => Number(application.id))
    .filter((applicationId) => selectedApplicationIds.includes(applicationId));
  const allFilteredApplicationsSelected =
    filteredApplications.length > 0 &&
    filteredApplications.every((application) =>
      selectedApplicationIds.includes(Number(application.id))
    );

  useEffect(() => {
    const visibleApplicationIds = visibleRecruiterApplications.map((application) => Number(application.id));
    setSelectedApplicationIds((currentIds) =>
      currentIds.filter((applicationId) => visibleApplicationIds.includes(applicationId))
    );
  }, [visibleRecruiterApplications]);

  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(getRecruiterSectionRoute(section));
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate(APP_ROUTES.landing, { replace: true });
  };

  const handleCompanyFieldChange = (field, value) => {
    setCompanyProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
    setFeedback(null);
  };

  const handleCompanyLogoUpload = async (event) => {
    const logoFile = event.target.files?.[0];
    event.target.value = '';

    if (!logoFile) {
      return;
    }

    if (!isSupportedRecruiterLogoFile(logoFile)) {
      setFeedback({
        type: 'error',
        message: `Logo perusahaan wajib berupa JPG atau PNG. File "${logoFile.name}" tidak bisa dipakai.`,
      });
      return;
    }

    if (logoFile.size > RECRUITER_COMPANY_LOGO_MAX_FILE_SIZE_IN_BYTES) {
      setFeedback({
        type: 'error',
        message: `Ukuran logo perusahaan maksimal 2 MB. File "${logoFile.name}" terlalu besar.`,
      });
      return;
    }

    try {
      const companyLogoDataUrl = await convertRecruiterLogoToDataUrl(logoFile);

      setCompanyProfile((currentProfile) => ({
        ...currentProfile,
        companyLogoFileName: logoFile.name,
        companyLogoDataUrl,
      }));
      setFeedback(null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Logo perusahaan belum bisa diproses.',
      });
    }
  };

  const handleRemoveCompanyLogo = () => {
    setCompanyProfile((currentProfile) => ({
      ...currentProfile,
      companyLogoFileName: '',
      companyLogoDataUrl: '',
    }));
    setFeedback(null);
  };

  const handleCompanyLegalDocumentUpload = (event) => {
    const legalDocumentFile = event.target.files?.[0];
    event.target.value = '';

    if (!legalDocumentFile) {
      return;
    }

    if (!isSupportedRecruiterLegalDocumentFile(legalDocumentFile)) {
      setFeedback({
        type: 'error',
        message: `Dokumen legal wajib berupa PDF, PNG, JPG, atau JPEG. File "${legalDocumentFile.name}" tidak bisa dipakai.`,
      });
      return;
    }

    if (legalDocumentFile.size > RECRUITER_COMPANY_LEGAL_DOCUMENT_MAX_FILE_SIZE_IN_BYTES) {
      setFeedback({
        type: 'error',
        message: `Ukuran dokumen legal maksimal 2 MB. File "${legalDocumentFile.name}" terlalu besar.`,
      });
      return;
    }

    setCompanyLegalDocumentFile(legalDocumentFile);
    setCompanyProfile((currentProfile) => ({
      ...currentProfile,
      companyLegalDocumentName: legalDocumentFile.name,
      companyLegalDocumentMimeType: legalDocumentFile.type,
      companyLegalDocumentSize: legalDocumentFile.size,
      companyLegalDocumentUploadedAt: new Date().toISOString(),
      companyLegalDocumentPath: currentProfile.companyLegalDocumentPath || '',
    }));
    setFeedback(null);
  };

  const handleRemoveCompanyLegalDocument = () => {
    setCompanyLegalDocumentFile(null);
    setCompanyProfile((currentProfile) => ({
      ...currentProfile,
      companyLegalDocumentName: '',
      companyLegalDocumentPath: '',
      companyLegalDocumentMimeType: '',
      companyLegalDocumentSize: 0,
      companyLegalDocumentUploadedAt: '',
    }));
    setFeedback(null);
  };

  const handleSaveCompanyProfile = async () => {
    if (!user) {
      return;
    }

    const validationMessage = getRecruiterCompanyValidationMessage(companyProfile);

    if (validationMessage) {
      setFeedback({
        type: 'error',
        message: validationMessage,
      });
      return;
    }

    setIsSavingCompanyProfile(true);
    const savedProfile = saveRecruiterCompanyProfile(user, companyProfile);
    setCompanyProfile(savedProfile);

    try {
      const response = await updateProfile({
        name: savedProfile.recruiterName.trim(),
        phone: savedProfile.phone.trim(),
        company_name: savedProfile.companyName.trim(),
        recruiter_profile: savedProfile,
        company_legal_document: companyLegalDocumentFile,
      });
      const syncedProfile = saveRecruiterCompanyProfile(
        response?.user || user,
        response?.user?.recruiter_profile || savedProfile
      );
      setCompanyProfile(syncedProfile);
      setCompanyLegalDocumentFile(null);

      setFeedback({
        type: 'success',
        message:
          syncedProfile.verificationStatus === 'verified'
            ? 'Profil perusahaan berhasil disimpan dan tetap berstatus terverifikasi.'
            : 'Profil perusahaan berhasil disimpan dan masuk ke proses verifikasi admin.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error?.message || 'Profil perusahaan lokal tersimpan, tetapi sinkronisasi ke server belum berhasil.',
      });
    } finally {
      setIsSavingCompanyProfile(false);
    }
  };

  const handleResetCompanyProfile = async () => {
    if (!user) {
      return;
    }

    const shouldReset = window.confirm(
      'Reset akan menghapus seluruh draft profil perusahaan, dokumen legal, dan status verifikasi yang belum tersimpan. Lanjutkan?'
    );

    if (!shouldReset) {
      return;
    }

    setIsSavingCompanyProfile(true);
    const resetProfile = saveRecruiterCompanyProfile(user, {
      recruiterName: user?.name || '',
      companyName: '',
      legalCompanyName: '',
      companyEmail: user?.email || '',
      phone: user?.phone || '',
      companyAddress: '',
      companyLocation: '',
      industry: '',
      employeeRange: '',
      companyDescription: '',
      companyLogoFileName: '',
      companyLogoDataUrl: '',
      website: '',
      companyLegalDocumentName: '',
      companyLegalDocumentPath: '',
      companyLegalDocumentMimeType: '',
      companyLegalDocumentSize: 0,
      companyLegalDocumentUploadedAt: '',
      verificationStatus: 'draft',
      verificationNotes: '',
      verificationSubmittedAt: '',
      verifiedAt: '',
      contactRole: '',
      hiringFocus: '',
      plan_code: companyProfile.plan_code,
      kn_credit: companyProfile.kn_credit,
    });

    setCompanyProfile(resetProfile);
    setCompanyLegalDocumentFile(null);

    try {
      const response = await updateProfile({
        name: user?.name || '',
        phone: user?.phone || '',
        company_name: '',
        recruiter_profile: resetProfile,
      });
      setCompanyProfile(
        saveRecruiterCompanyProfile(
          response?.user || user,
          response?.user?.recruiter_profile || resetProfile
        )
      );
      setFeedback({
        type: 'success',
        message: 'Profil perusahaan berhasil direset.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Reset profil perusahaan belum berhasil disinkronkan ke server.',
      });
    } finally {
      setIsSavingCompanyProfile(false);
    }
  };

  const handleJobWorkflowChange = async (job, workflowStatus) => {
    if (workflowStatus === 'active' && !companyCompletion.isReady) {
      setFeedback({
        type: 'error',
        message:
          'Lengkapi profil company minimum terlebih dahulu sebelum mengaktifkan lowongan.',
      });
      handleSectionChange('company');
      return;
    }

    setJobActionInFlightId(job.id);

    try {
      await updateJob(job.id, {
        workflow_status: workflowStatus,
        status: mapJobWorkflowToBackendStatus(workflowStatus),
      });
      saveJobWorkflowStatus(job.id, workflowStatus);
      await getMyJobs(1, 100);
      setFeedback({
        type: 'success',
        message: `${job.title} sekarang berada pada status ${getJobWorkflowLabel(workflowStatus)}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Status lowongan belum berhasil diperbarui.',
      });
    } finally {
      setJobActionInFlightId(null);
    }
  };

  const handleDeleteJob = async (job) => {
    setJobActionInFlightId(job.id);

    try {
      await deleteJob(job.id);
      await getMyJobs(1, 100);
      setFeedback({
        type: 'success',
        message: `Lowongan ${job.title} berhasil dihapus.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Lowongan belum berhasil dihapus.',
      });
    } finally {
      setJobActionInFlightId(null);
    }
  };

  const handleResetJobFilters = () => {
    setJobSearchQuery('');
    setJobWorkflowFilter('all');
  };

  const handlePreviewJob = (job) => {
    if (typeof window !== 'undefined') {
      window.open(getJobApplyRoute(job.id), '_blank', 'noopener,noreferrer');
    }

    setFeedback({
      type: 'success',
      message: `Preview kandidat untuk ${job.title} dibuka di tab baru.`,
    });
  };

  const handleDuplicateJob = async (job) => {
    setJobActionInFlightId(job.id);

    try {
      const response = await createJob({
        title: `${job.title} (Copy)`,
        experience_level: job.experience_level,
        category: job.category,
        description: job.description,
        salary_min: Number(job.salary_min) || 0,
        salary_max: Number(job.salary_max) || 0,
        location: job.location,
        job_type: job.job_type,
        work_mode: job.work_mode,
        openings_count: Number(job.openings_count) || 0,
        interview_type: job.interview_type,
        interview_note: job.interview_note || '',
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
        candidate_skills: job.candidate_skills || [],
        candidate_custom_skill: job.candidate_custom_skill || '',
        internal_recruiter_link: job.internal_recruiter_link || '',
        video_screening_requirement: job.video_screening_requirement || 'optional',
        quiz_screening_questions: job.quiz_screening_questions || [],
        workflow_status: 'draft',
        status: 'inactive',
        duplicate_source_job_id: job.id,
      });

      if (response?.data?.id) {
        saveJobWorkflowStatus(response.data.id, 'draft');
      }

      await getMyJobs(1, 100);
      setFeedback({
        type: 'success',
        message: `Lowongan ${job.title} berhasil diduplikasi sebagai draft.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Lowongan belum berhasil diduplikasi.',
      });
    } finally {
      setJobActionInFlightId(null);
    }
  };

  const handleBoostJob = async (job) => {
    setJobActionInFlightId(job.id);

    try {
      await updateJob(job.id, {
        boost_count: (Number(job.boostCount) || 0) + 1,
        workflow_note: 'Permintaan boost recruiter dikirim untuk prioritas review.',
      });
      await getMyJobs(1, 100);
      setFeedback({
        type: 'success',
        message: `Permintaan tingkatkan lowongan untuk ${job.title} sudah dicatat.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Permintaan tingkatkan lowongan belum berhasil dicatat.',
      });
    } finally {
      setJobActionInFlightId(null);
    }
  };

  const handleApplicationStageChange = async (application, stage) => {
    setApplicationActionInFlightId(application.id);

    try {
      await updateApplicationStatus(
        application.id,
        mapApplicationStageToBackendStatus(stage),
        stage
      );
      saveApplicationStage(application.id, stage);
      await getJobApplications(selectedJobId, 1, 100);
      setFeedback({
        type: 'success',
        message: `${application.candidate?.name || 'Kandidat'} dipindahkan ke tahap ${getApplicationStageLabel(stage)}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Tahap kandidat belum berhasil diperbarui.',
      });
    } finally {
      setApplicationActionInFlightId(null);
    }
  };

  const handleResetCandidateFilters = () => {
    setCandidateSearchQuery('');
    setCandidateStageFilter('all');
    setCandidateFavoriteFilter('all');
    setCandidateGenderFilter('all');
    setCandidateEducationFilter('all');
    setCandidateExperienceFilter('all');
    setCandidateSalaryFilter('all');
    setCandidateSortOrder('recommended');
  };

  const handleToggleApplicationFavorite = (applicationId) => {
    setFavoriteApplicationIds((currentIds) =>
      currentIds.includes(applicationId)
        ? currentIds.filter((currentId) => currentId !== applicationId)
        : [...currentIds, applicationId]
    );
  };

  const handleToggleApplicationSelection = (applicationId) => {
    setSelectedApplicationIds((currentIds) =>
      currentIds.includes(applicationId)
        ? currentIds.filter((currentId) => currentId !== applicationId)
        : [...currentIds, applicationId]
    );
  };

  const handleToggleSelectAllApplications = () => {
    const filteredIds = filteredApplications.map((application) => Number(application.id));

    if (allFilteredApplicationsSelected) {
      setSelectedApplicationIds((currentIds) =>
        currentIds.filter((applicationId) => !filteredIds.includes(applicationId))
      );
      return;
    }

    setSelectedApplicationIds((currentIds) => [
      ...new Set([...currentIds, ...filteredIds]),
    ]);
  };

  const handleHideSelectedApplications = (applicationIds) => {
    if (applicationIds.length === 0) {
      return;
    }

    setHiddenApplicationIds((currentIds) => [
      ...new Set([...currentIds, ...applicationIds.map(Number)]),
    ]);
    setSelectedApplicationIds((currentIds) =>
      currentIds.filter((applicationId) => !applicationIds.includes(applicationId))
    );
    setFeedback({
      type: 'success',
      message: `${formatPlural(applicationIds.length, 'pelamar')} disembunyikan dari halaman recruiter ini.`,
    });
  };

  const handleDownloadApplications = (applicationList) => {
    if (!selectedJob || applicationList.length === 0) {
      return;
    }

    const lines = applicationList.flatMap((application, index) => [
      `${index + 1}. ${application.candidate?.name || 'Kandidat'}`,
      `Email: ${application.candidate?.email || '-'}`,
      `Telepon: ${application.candidate?.phone || '-'}`,
      `Tahap: ${application.stageLabel}`,
      `Pendidikan: ${application.candidateEducationLabel}`,
      `Pengalaman: ${
        application.candidateExperienceType === 'experienced' ? 'Berpengalaman' : 'Freshgraduate'
      }`,
      `Skill utama: ${(application.candidateProfile.skills || []).filter(Boolean).slice(0, 5).join(', ') || '-'}`,
      `Ringkasan: ${application.candidateProfile.profileSummary || '-'}`,
      `Gaji harapan: ${application.candidateExpectedSalary ? formatCurrency(application.candidateExpectedSalary) : '-'}`,
      '',
    ]);

    downloadTextFile(
      `pelamar-${selectedJob.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.txt`,
      [`Daftar pelamar untuk ${selectedJob.title}`, '', ...lines].join('\n')
    );
  };

  const handleBulkRejectApplications = async () => {
    if (!selectedFilteredApplicationIds.length) {
      setFeedback({
        type: 'error',
        message: 'Pilih minimal satu pelamar sebelum melakukan aksi bulk.',
      });
      return;
    }

    setApplicationActionInFlightId(`bulk-${selectedJobId}`);

    try {
      await Promise.all(
        filteredApplications
          .filter((application) => selectedFilteredApplicationIds.includes(Number(application.id)))
          .map((application) =>
            updateApplicationStatus(
              application.id,
              mapApplicationStageToBackendStatus('rejected'),
              'rejected'
            )
          )
      );

      await getJobApplications(selectedJobId, 1, 100);
      setSelectedApplicationIds([]);
      setFeedback({
        type: 'success',
        message: `${formatPlural(selectedFilteredApplicationIds.length, 'pelamar')} dipindahkan ke tahap Ditolak.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Bulk reject belum berhasil dijalankan.',
      });
    } finally {
      setApplicationActionInFlightId(null);
    }
  };

  const runTalentSearch = async (page = 1) => {
    setIsLoadingTalent(true);
    setHasLoadedTalent(true);

    try {
      const result = await RecruiterWorkspaceService.searchTalent(talentFilters, page, 12);
      setTalentCandidates(result.data || []);
      setTalentPagination(result.pagination || null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Talent search belum berhasil dijalankan.',
      });
    } finally {
      setIsLoadingTalent(false);
    }
  };

  const handleTalentFilterChange = (field, value) => {
    if (field === 'job_id') {
      const selectedFilterJob =
        recruiterJobs.find((job) => Number(job.id) === Number(value)) || null;

      setTalentFilters(selectedFilterJob ? buildTalentFiltersFromJob(selectedFilterJob) : createTalentSearchFilters());
      return;
    }

    const normalizedValue =
      field === 'age_min' || field === 'age_max'
        ? String(value || '')
            .replace(/[^\d]/g, '')
            .slice(0, 3)
        : value;

    setTalentFilters((currentFilters) => ({
      ...currentFilters,
      [field]: normalizedValue,
    }));
  };

  const handleResetTalentFilters = () => {
    setTalentFilters(createTalentSearchFilters());
  };

  const handleToggleFavoriteTalent = (candidate) => {
    if (!candidate?.id) {
      return;
    }

    setFavoriteTalentIds((currentIds) =>
      currentIds.includes(candidate.id)
        ? currentIds.filter((candidateId) => candidateId !== candidate.id)
        : [...currentIds, candidate.id]
    );
  };

  const handleDownloadTalentResume = (candidate) => {
    if (!candidate?.id || !candidate.resume_files?.length) {
      return;
    }

    const fileSlug = slugifyDownloadValue(candidate.name);
    const experienceLabel =
      candidate.latest_experience?.position || candidate.experience_level
        ? `${candidate.latest_experience?.position || formatExperienceLevel(candidate.experience_level)}${
            candidate.latest_experience?.company ? ` di ${candidate.latest_experience.company}` : ''
          }`
        : candidate.experience_type === 'fresh-graduate'
          ? 'Freshgraduate'
          : '-';
    const resumeContent = [
      `Ringkasan CV Kandidat: ${candidate.name}`,
      `Email: ${candidate.email || '-'}`,
      `Telepon: ${candidate.phone || '-'}`,
      `Domisili: ${candidate.current_address || candidate.preferred_locations?.[0] || '-'}`,
      `Usia: ${candidate.age ? `${candidate.age} tahun` : '-'}`,
      `Jenis kelamin: ${
        candidate.gender === 'male' ? 'Pria' : candidate.gender === 'female' ? 'Wanita' : '-'
      }`,
      `Pendidikan: ${candidate.education_label || '-'}`,
      `Pengalaman: ${experienceLabel}`,
      `Skill: ${(candidate.skills || []).filter(Boolean).join(', ') || '-'}`,
      '',
      'Ringkasan profil:',
      candidate.profile_summary || 'Belum ada ringkasan profil kandidat.',
      '',
      `Referensi dokumen CV terlihat: ${(candidate.resume_files || []).join(', ')}`,
    ].join('\n');

    downloadTextFile(`cv-${fileSlug}.txt`, resumeContent);
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
        job_id:
          selectedChatContact.role === 'candidate' && selectedJobId
            ? Number(selectedJobId)
            : undefined,
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

  const handlePackageChange = async (planCode) => {
    setIsSavingPackage(true);

    try {
      const response = await RecruiterWorkspaceService.updatePackage(planCode);
      const refreshedUser = await getCurrentUser();
      setCompanyProfile(
        saveRecruiterCompanyProfile(
          response.user || refreshedUser || user,
          response?.user?.recruiter_profile || refreshedUser?.recruiter_profile || companyProfile
        )
      );
      setPackageOverview({
        current: response.current,
        catalog: response.catalog || packageOverview.catalog,
      });
      setFeedback({
        type: 'success',
        message: `Paket recruiter sekarang ${response.current?.label || 'Starter'}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Paket recruiter belum berhasil diperbarui.',
      });
    } finally {
      setIsSavingPackage(false);
    }
  };

  const overviewCards = [
    {
      label: 'Profil company',
      value: companyCompletion.isReady ? 'Siap publish' : 'Belum siap',
      detail: `${companyCompletion.completedRequiredItems}/${companyCompletion.totalRequiredItems} syarat inti lengkap`,
    },
    {
      label: 'Lowongan aktif',
      value: `${dashboardMetrics.activeJobs}`,
      detail: `${dashboardMetrics.draftJobs} draft • ${dashboardMetrics.closedJobs} nonaktif`,
    },
    {
      label: 'Total pelamar',
      value: `${dashboardMetrics.totalApplications}`,
      detail: `${dashboardMetrics.hiredCandidates} kandidat sudah hired`,
    },
    {
      label: 'Paket recruiter',
      value: packageOverview.current?.label || companyProfile.plan?.label || 'Starter',
      detail: formatRecruiterPlanDocuments(
        packageOverview.current?.code || companyProfile.plan_code
      ),
    },
  ];

  return (
    <div className="workspace-page recruiter-flow-page">
      <RecruiterTopbar
        sections={RECRUITER_PRIMARY_SECTION_OPTIONS}
        activeSection={activeSection}
        onSectionSelect={handleSectionChange}
        onBrandClick={() => handleSectionChange('jobs')}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        user={user}
        companyProfile={companyProfile}
        onPremiumClick={() => handleSectionChange('package')}
      />

      <main className="workspace-shell workspace-main recruiter-flow-shell">
        {feedback && (
          <div
            className={`${feedback.type === 'error' ? 'error' : 'success'} workspace-feedback`}
          >
            {feedback.message}
          </div>
        )}

        {activeSection === 'overview' && (
          <section className="workspace-section-stack recruiter-mobile-overview-section">
            <div className="recruiter-mobile-overview-shell">
              <article className="recruiter-mobile-overview-hero" data-reveal>
                <span className="recruiter-mobile-overview-kicker">Recruiter Flow</span>
                <h1>{nextAction.title}</h1>
                <p>{nextAction.description}</p>

                <div className="recruiter-mobile-overview-actions">
                  <button
                    type="button"
                    className="recruiter-mobile-overview-primary"
                    onClick={() => handleSectionChange(nextAction.section)}
                  >
                    {nextAction.cta}
                  </button>
                  <Link
                    to={APP_ROUTES.recruiterCreateJob}
                    className="recruiter-mobile-overview-secondary"
                  >
                    Buat Lowongan Baru
                  </Link>
                </div>

                <div className="recruiter-mobile-overview-mini-grid">
                  <article className="recruiter-mobile-overview-mini-card">
                    <div className="recruiter-mobile-overview-mini-head">
                      <strong>Company profile</strong>
                      <span>{companyProfile.companyName || 'Belum diisi'}</span>
                    </div>
                    <p>
                      Recruiter flow dimulai dari profil company yang valid agar proses publish dan
                      screening lowongan lebih kredibel.
                    </p>
                  </article>

                  <article className="recruiter-mobile-overview-mini-card">
                    <div className="recruiter-mobile-overview-mini-head">
                      <strong>Lowongan prioritas</strong>
                      <span>{selectedJob?.title || 'Belum ada lowongan'}</span>
                    </div>
                    <p>
                      Fokus hiring harian Anda sekarang mengarah ke lowongan yang kandidatnya paling
                      aktif bergerak.
                    </p>
                  </article>
                </div>
              </article>

              <div className="recruiter-mobile-overview-kpi-stack" data-reveal data-reveal-delay="40ms">
                {overviewCards.map((card) => (
                  <article key={card.label} className="recruiter-mobile-overview-kpi-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </article>
                ))}
              </div>

              <article
                className="recruiter-mobile-overview-panel"
                data-reveal
                data-reveal-delay="80ms"
              >
                <div className="recruiter-mobile-overview-panel-head">
                  <div>
                    <span className="recruiter-mobile-overview-eyebrow">Checklist Company</span>
                    <h2>Apa yang harus siap sebelum publish</h2>
                  </div>
                  <p>
                    Recruiter boleh menyusun strategi hiring kapan saja, tetapi lowongan baru
                    sebaiknya dipublikasikan setelah identitas company dan PIC recruiter jelas.
                  </p>
                </div>

                <div className="recruiter-mobile-overview-checklist">
                  {companyCompletion.requiredChecklist.map((item) => (
                    <article
                      key={item.key}
                      className={`recruiter-mobile-overview-check-item${
                        item.isComplete ? ' is-complete' : ' is-missing'
                      }`}
                    >
                      <div className="recruiter-mobile-overview-check-head">
                        <strong>{item.label}</strong>
                        <span>{item.isComplete ? 'Siap' : 'Belum lengkap'}</span>
                      </div>
                      <p>{getRecruiterChecklistGuidance(item)}</p>
                    </article>
                  ))}
                </div>
              </article>

              <article
                className="recruiter-mobile-overview-panel"
                data-reveal
                data-reveal-delay="120ms"
              >
                <div className="recruiter-mobile-overview-panel-head">
                  <div>
                    <span className="recruiter-mobile-overview-eyebrow">Pipeline Ringkas</span>
                    <h2>Kandidat yang perlu tindakan</h2>
                  </div>
                  <p>
                    Area ini memperlihatkan kandidat yang sudah masuk ke workflow Anda. Tujuannya
                    sederhana: jangan biarkan lamaran berhenti tanpa tindak lanjut.
                  </p>
                </div>

                <div className="recruiter-mobile-overview-pipeline">
                  {recruiterOverviewFocusedApplications.length === 0 ? (
                    <article className="recruiter-mobile-overview-pipeline-empty">
                      <span className="recruiter-mobile-overview-pipeline-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M7 7.5h10A2.5 2.5 0 0 1 19.5 10v7.5L16 15h-9A2.5 2.5 0 0 1 4.5 12.5V10A2.5 2.5 0 0 1 7 7.5Z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <strong>Belum ada kandidat masuk</strong>
                      <p>Publish atau aktifkan lowongan yang tepat agar pipeline mulai bergerak.</p>
                      <button
                        type="button"
                        className="recruiter-mobile-overview-pipeline-link"
                        onClick={() => handleSectionChange('jobs')}
                      >
                        Fokus ke lowongan aktif
                      </button>
                    </article>
                  ) : (
                    recruiterOverviewFocusedApplications.map((application) => (
                      <article
                        key={application.id}
                        className="recruiter-mobile-overview-pipeline-card"
                      >
                        <div className="recruiter-mobile-overview-pipeline-head">
                          <strong>{application.candidate?.name || 'Kandidat'}</strong>
                          <span>{application.stageLabel}</span>
                        </div>
                        <p>{application.stageMeta.summary}</p>
                        <small>
                          {application.job?.title || 'Lowongan'} •{' '}
                          {formatDateTime(application.applied_at)}
                        </small>
                        <button
                          type="button"
                          className="recruiter-mobile-overview-pipeline-link"
                          onClick={() => handleSectionChange('candidates')}
                        >
                          Buka pipeline kandidat
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </article>

              <footer className="recruiter-mobile-overview-footer" data-reveal data-reveal-delay="160ms">
                <strong>KerjaNusa</strong>
                <p>
                  Solusi rekrutmen profesional untuk membangun tim impian dengan standar kualitas
                  tertinggi di Indonesia.
                </p>

                <div className="recruiter-mobile-overview-footer-links">
                  <div>
                    <span>Navigasi</span>
                    <Link to={APP_ROUTES.platform}>Syarat &amp; Ketentuan</Link>
                    <Link to={APP_ROUTES.about}>Kebijakan Privasi</Link>
                  </div>
                  <div>
                    <span>Bantuan</span>
                    <Link to={APP_ROUTES.platform}>Pusat Bantuan</Link>
                    <a href={RECRUITER_SUPPORT_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                      Hubungi Kami
                    </a>
                  </div>
                </div>
              </footer>
            </div>
          </section>
        )}

        {activeSection === 'company' && (
          <section className="workspace-section-stack">
            <article className="workspace-panel" data-reveal>
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Profil Perusahaan</span>
                  <h2>Lengkapi identitas perusahaan untuk proses verifikasi</h2>
                </div>
                <p>
                  Setelah data perusahaan lengkap, profil ini akan diverifikasi oleh superadmin
                  KerjaNusa sebelum dipakai sebagai identitas utama recruiter.
                </p>
              </div>

              <div className="workspace-profile-status-banner">
                <div>
                  <strong>{companyVerificationStatus.label}</strong>
                  <span>
                    {companyCompletion.completedRequiredItems}/{companyCompletion.totalRequiredItems}{' '}
                    syarat verifikasi terpenuhi
                  </span>
                </div>
                <div>
                  <strong>{companyCompletion.readinessPercent}%</strong>
                  <span>Kesiapan profil perusahaan</span>
                </div>
              </div>

              <div className={`recruiter-company-status-card is-${companyVerificationStatus.tone}`}>
                <div>
                  <strong>Status verifikasi perusahaan</strong>
                  <p>{companyVerificationStatus.summary}</p>
                </div>
                <span className={`recruiter-company-status-badge is-${companyVerificationStatus.tone}`}>
                  {companyVerificationStatus.label}
                </span>
              </div>

              {companyProfile.verificationNotes && (
                <div className="recruiter-company-inline-note">
                  <strong>Catatan admin</strong>
                  <p>{companyProfile.verificationNotes}</p>
                </div>
              )}
            </article>

            <article className="workspace-panel" data-reveal data-reveal-delay="60ms">
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Data Perusahaan</span>
                  <h2>Identitas legal dan profil bisnis</h2>
                </div>
                <p>
                  Data ini dipakai untuk memverifikasi perusahaan, menampilkan identitas recruiter,
                  dan memastikan lowongan berasal dari bisnis yang jelas.
                </p>
              </div>

              <div className="recruiter-company-brand-card">
                <div className="recruiter-company-brand-preview" aria-hidden="true">
                  {recruiterCompanyLogoUrl ? (
                    <img src={recruiterCompanyLogoUrl} alt="" />
                  ) : (
                    <span>{recruiterCompanyLogoInitials}</span>
                  )}
                </div>

                <div className="recruiter-company-brand-copy">
                  <strong>Logo perusahaan</strong>
                  <p>
                    Logo akan tampil pada menu recruiter dan menjadi identitas visual perusahaan di
                    dashboard.
                  </p>
                  <small>
                    {companyProfile.companyLogoFileName
                      ? companyProfile.companyLogoFileName
                      : 'Belum ada logo perusahaan yang diunggah.'}
                  </small>
                </div>

                <div className="recruiter-company-brand-actions">
                  <label
                    className="recruiter-company-brand-trigger"
                    htmlFor="recruiter-company-logo-upload"
                  >
                    Unggah Logo
                  </label>
                  {recruiterCompanyLogoUrl && (
                    <button
                      type="button"
                      className="recruiter-company-brand-remove"
                      onClick={handleRemoveCompanyLogo}
                    >
                      Hapus Logo
                    </button>
                  )}
                  <input
                    id="recruiter-company-logo-upload"
                    type="file"
                    accept="image/png,image/jpeg"
                    className="recruiter-company-brand-input"
                    onChange={handleCompanyLogoUpload}
                  />
                </div>
              </div>

              <div className="workspace-form-grid workspace-form-grid-two">
                <label className="workspace-field">
                  <span>Nama Brand</span>
                  <input
                    type="text"
                    placeholder="Contoh: Axxx"
                    value={companyProfile.companyName}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyName', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Nama Legal Perusahaan</span>
                  <input
                    type="text"
                    placeholder="Contoh: PT Xxx Nusantara"
                    value={companyProfile.legalCompanyName}
                    onChange={(event) =>
                      handleCompanyFieldChange('legalCompanyName', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Industri Perusahaan</span>
                  <input
                    type="text"
                    placeholder="Contoh: Manufaktur"
                    value={companyProfile.industry}
                    onChange={(event) =>
                      handleCompanyFieldChange('industry', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Jumlah Tenaga Kerja</span>
                  <select
                    value={companyProfile.employeeRange}
                    onChange={(event) =>
                      handleCompanyFieldChange('employeeRange', event.target.value)
                    }
                  >
                    <option value="">Pilih skala perusahaan</option>
                    {RECRUITER_COMPANY_EMPLOYEE_RANGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="workspace-field">
                  <span>Link Website / Social Media</span>
                  <input
                    type="url"
                    placeholder="Contoh: https://perusahaananda.com"
                    value={companyProfile.website}
                    onChange={(event) => handleCompanyFieldChange('website', event.target.value)}
                  />
                </label>
                <label className="workspace-field workspace-field-span-two">
                  <span>Deskripsi Perusahaan</span>
                  <textarea
                    rows="5"
                    placeholder="Minimal 80 karakter. Jelaskan bisnis utama, skala operasional, serta nilai perusahaan Anda."
                    value={companyProfile.companyDescription}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyDescription', event.target.value)
                    }
                  />
                  <small className="recruiter-company-field-helper">
                    {companyDescriptionLength}/80 karakter minimum
                  </small>
                </label>
              </div>

              <div className="recruiter-company-document-card">
                <div className="recruiter-company-document-copy">
                  <strong>Dokumen Legal Perusahaan / NIB</strong>
                  <p>
                    Lampirkan dokumen PDF, PNG, JPG, atau JPEG dengan ukuran maksimal 2 MB untuk
                    kebutuhan verifikasi admin.
                  </p>
                  <small>
                    {companyProfile.companyLegalDocumentName
                      ? `${companyProfile.companyLegalDocumentName}${
                          companyProfile.companyLegalDocumentSize
                            ? ` • ${formatFileSize(companyProfile.companyLegalDocumentSize)}`
                            : ''
                        }`
                      : 'Belum ada dokumen legal yang dilampirkan.'}
                  </small>
                </div>

                <div className="recruiter-company-document-actions">
                  <label
                    className="recruiter-company-brand-trigger"
                    htmlFor="recruiter-company-legal-document-upload"
                  >
                    Unggah Dokumen
                  </label>
                  {hasRecruiterCompanyLegalDocument(companyProfile) && (
                    <button
                      type="button"
                      className="recruiter-company-brand-remove"
                      onClick={handleRemoveCompanyLegalDocument}
                    >
                      Hapus Dokumen
                    </button>
                  )}
                  <input
                    id="recruiter-company-legal-document-upload"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    className="recruiter-company-brand-input"
                    onChange={handleCompanyLegalDocumentUpload}
                  />
                </div>
              </div>
            </article>

            <article className="workspace-panel" data-reveal data-reveal-delay="120ms">
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Kontak Perusahaan</span>
                  <h2>PIC dan alamat yang dapat diverifikasi</h2>
                </div>
                <p>
                  Data kontak ini dipakai admin untuk memvalidasi kepemilikan profil perusahaan dan
                  menjadi jalur komunikasi resmi jika ada revisi.
                </p>
              </div>

              <div className="workspace-form-grid workspace-form-grid-two">
                <label className="workspace-field">
                  <span>Nama PIC</span>
                  <input
                    type="text"
                    value={companyProfile.recruiterName}
                    onChange={(event) =>
                      handleCompanyFieldChange('recruiterName', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Email Perusahaan / PIC</span>
                  <input
                    type="email"
                    placeholder="Contoh: hr@perusahaananda.com"
                    value={companyProfile.companyEmail}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyEmail', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Nomor Kontak</span>
                  <input
                    type="tel"
                    value={companyProfile.phone}
                    onChange={(event) => handleCompanyFieldChange('phone', event.target.value)}
                  />
                </label>
                <label className="workspace-field workspace-field-span-two">
                  <span>Alamat Perusahaan</span>
                  <textarea
                    rows="4"
                    placeholder="Tuliskan alamat lengkap perusahaan."
                    value={companyProfile.companyAddress}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyAddress', event.target.value)
                    }
                  />
                </label>
              </div>
            </article>

            <article className="workspace-panel" data-reveal data-reveal-delay="180ms">
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Aksi</span>
                  <h2>Simpan data lalu lanjut ke posting lowongan</h2>
                </div>
                <p>
                  Data akan diverifikasi terlebih dahulu oleh tim KerjaNusa sebelum menjadi profil
                  perusahaan yang final.
                </p>
              </div>

              <div className="recruiter-company-inline-note">
                <strong>Pemberitahuan</strong>
                <p>
                  Simpan akan mengajukan profil perusahaan ke status verifikasi selama seluruh
                  kolom wajib sudah lengkap. Tombol reset akan membersihkan seluruh profil
                  perusahaan yang sedang Anda susun.
                </p>
              </div>

              <div className="recruiter-company-checklist-grid">
                {companyCompletion.requiredChecklist.map((item) => (
                  <article
                    key={item.key}
                    className={`recruiter-company-checklist-item${
                      item.isComplete ? ' is-complete' : ' is-missing'
                    }`}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.isComplete ? 'Lengkap' : 'Belum lengkap'}</span>
                  </article>
                ))}
              </div>

              <div className="workspace-action-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveCompanyProfile}
                  disabled={isSavingCompanyProfile}
                >
                  {isSavingCompanyProfile ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetCompanyProfile}
                  disabled={isSavingCompanyProfile}
                >
                  Reset Profil
                </button>
                <Link to={APP_ROUTES.recruiterCreateJob} className="btn btn-outline">
                  Lanjut Buat Lowongan
                </Link>
              </div>
            </article>
          </section>
        )}

        {activeSection === 'jobs' && (
          <section className="workspace-section-stack">
            <article className="workspace-panel" data-reveal>
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Posting Lowongan</span>
                  <h2>Kelola daftar lowongan recruiter</h2>
                </div>
                <p>
                  Recruiter diarahkan langsung ke halaman ini agar alur draft, review, tayang, dan
                  penutupan lowongan tetap ada dalam satu dashboard.
                </p>
              </div>

              <div className="recruiter-flow-spotlight-grid">
                <article className="recruiter-flow-spotlight-card recruiter-flow-spotlight-card-notice">
                  <div className="recruiter-flow-spotlight-copy">
                    <span className="recruiter-flow-spotlight-eyebrow">Informasi Penting</span>
                    <strong>Data pelamar aktif recruiter hanya tersedia untuk 1 tahun terakhir.</strong>
                    <p>
                      Jika Anda membutuhkan data kandidat yang lebih lama, hubungi Customer Service
                      KerjaNusa untuk bantuan arsip dan penelusuran lanjutan.
                    </p>
                  </div>
                  <a
                    href={RECRUITER_SUPPORT_WHATSAPP_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                  >
                    Hubungi Customer Service
                  </a>
                </article>

                <article className="recruiter-flow-spotlight-card recruiter-flow-spotlight-card-promo">
                  <div className="recruiter-flow-spotlight-copy">
                    <span className="recruiter-flow-spotlight-eyebrow">Kolam Pelamar & Paket</span>
                    <strong>
                      Paket {packageOverview.current?.label || companyProfile.plan?.label || 'Starter'}
                      {' '}aktif untuk recruiter ini.
                    </strong>
                    <p>
                      {packageOverview.current?.job_limit
                        ? `Saat ini paket Anda mendukung hingga ${packageOverview.current.job_limit} lowongan aktif sekaligus.`
                        : 'Paket aktif mendukung lowongan aktif tanpa batas untuk kebutuhan hiring yang lebih besar.'}
                    </p>
                  </div>
                  <div className="recruiter-flow-spotlight-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSectionChange('talent')}
                    >
                      Buka Kolam Pelamar
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleSectionChange('package')}
                    >
                      Lihat Paket
                    </button>
                  </div>
                </article>
              </div>

              <div className="workspace-action-row recruiter-flow-toolbar recruiter-flow-toolbar-dense">
                <button
                  type="button"
                  className="btn btn-outline recruiter-flow-reset-button"
                  onClick={handleResetJobFilters}
                >
                  Reset
                </button>

                <select
                  className="recruiter-flow-select"
                  value={jobWorkflowFilter}
                  onChange={(event) => setJobWorkflowFilter(event.target.value)}
                >
                  <option value="all">Semua status lowongan</option>
                  {RECRUITER_JOB_WORKFLOW_OPTIONS.filter((option) => option.value !== 'filled').map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="search"
                  className="recruiter-flow-search"
                  placeholder="Cari judul, kategori, atau lokasi lowongan. Contoh: admin gudang"
                  value={jobSearchQuery}
                  onChange={(event) => setJobSearchQuery(event.target.value)}
                />

                <Link to={APP_ROUTES.recruiterCreateJob} className="btn btn-primary">
                  Pasang Loker
                </Link>
              </div>

              <div className="workspace-application-filter-row recruiter-flow-filter-row">
                <button
                  type="button"
                  className={`workspace-filter-chip${jobWorkflowFilter === 'all' ? ' is-active' : ''}`}
                  onClick={() => setJobWorkflowFilter('all')}
                >
                  Semua ({jobWorkflowCounts.all || 0})
                </button>
                {RECRUITER_JOB_WORKFLOW_OPTIONS.filter((option) => option.value !== 'filled').map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`workspace-filter-chip${
                      jobWorkflowFilter === option.value ? ' is-active' : ''
                    }`}
                    onClick={() => setJobWorkflowFilter(option.value)}
                  >
                    {option.label} ({jobWorkflowCounts[option.value] || 0})
                  </button>
                ))}
              </div>

              {jobsError && <div className="error">{jobsError}</div>}

              {isLoadingJobs ? (
                <div className="loading">Memuat lowongan recruiter...</div>
              ) : filteredJobs.length === 0 ? (
                <div className="workspace-card-list">
                  <article className="workspace-subcard">
                    <div className="workspace-subcard-heading">
                      <strong>Belum ada lowongan yang cocok</strong>
                      <span>Sesuaikan filter atau buat lowongan baru</span>
                    </div>
                    <p>
                      Dashboard ini akan lebih hidup begitu Anda mulai menyusun draft dan
                      mengaktifkan lowongan yang relevan.
                    </p>
                  </article>
                </div>
              ) : (
                <div className="workspace-card-list recruiter-flow-job-grid">
                  {filteredJobs.map((job) => (
                    <article
                      key={job.id}
                      className="workspace-subcard recruiter-flow-job-card recruiter-flow-job-card-detailed"
                    >
                      <div className="recruiter-flow-job-card-head">
                        <div>
                          <span className="recruiter-flow-job-eyebrow">
                            {job.category} • {job.location}
                          </span>
                          <strong>{job.title}</strong>
                          <span>{companyProfile.companyName || job.recruiter?.name || 'Profil recruiter'}</span>
                        </div>
                        <span
                          className={`workspace-status-pill workspace-status-pill-${job.workflowTone}`}
                        >
                          {job.workflowLabel}
                        </span>
                      </div>

                      <p>{job.description}</p>

                      <div className="recruiter-flow-job-stat-grid">
                        <article className="recruiter-flow-job-stat-card">
                          <span>Viewer lowongan</span>
                          <strong>{job.viewsCount}</strong>
                        </article>
                        <article className="recruiter-flow-job-stat-card">
                          <span>Pelamar masuk</span>
                          <strong>{job.applicationsCount}</strong>
                        </article>
                        <article className="recruiter-flow-job-stat-card">
                          <span>Tayang / review</span>
                          <strong>
                            {job.workflowStatus === 'review'
                              ? formatDateLabel(job.reviewRequestedAt)
                              : formatDateLabel(job.publishedAt)}
                          </strong>
                        </article>
                        <article className="recruiter-flow-job-stat-card">
                          <span>Tingkatkan</span>
                          <strong>{job.boostCount}x</strong>
                        </article>
                      </div>

                      <div className="workspace-inline-metadata">
                        <span>{formatExperienceLevel(job.experience_level)}</span>
                        <span>{formatWorkMode(job.work_mode)}</span>
                        <span>
                          {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
                        </span>
                        <span>{formatPlural(Number(job.openings_count) || 0, 'posisi')}</span>
                        <span>Diperbarui {formatDateLabel(job.updated_at)}</span>
                        <span>Deadline {formatDateLabel(job.expiry_date)}</span>
                      </div>

                      {job.workflowStatus === 'rejected' && job.rejectionNote && (
                        <div className="workspace-application-note">
                          <strong>Catatan status</strong>
                          <p>{job.rejectionNote}</p>
                        </div>
                      )}

                      <div className="workspace-action-row recruiter-flow-job-actions recruiter-flow-job-actions-wide">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handlePreviewJob(job)}
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleDuplicateJob(job)}
                          disabled={jobActionInFlightId === job.id}
                        >
                          Duplikasi
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setSelectedJobId(job.id);
                            handleSectionChange('candidates');
                          }}
                        >
                          Lihat Pelamar
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleBoostJob(job)}
                          disabled={jobActionInFlightId === job.id}
                        >
                          Tingkatkan Lowongan
                        </button>

                        <select
                          className="recruiter-flow-select"
                          value={job.workflowStatus}
                          onChange={(event) => handleJobWorkflowChange(job, event.target.value)}
                          disabled={jobActionInFlightId === job.id}
                        >
                          {RECRUITER_JOB_WORKFLOW_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDeleteJob(job)}
                          disabled={jobActionInFlightId === job.id}
                        >
                          {jobActionInFlightId === job.id ? 'Memproses...' : 'Hapus'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'candidates' && (
          <section className="workspace-section-stack">
            <article className="workspace-panel" data-reveal>
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Pelamar</span>
                  <h2>Kelola pelamar per lowongan</h2>
                </div>
                <p>
                  Halaman ini dibuat per lowongan agar filter kandidat, screening, shortlist,
                  chat, dan aksi bulk tetap fokus ke kebutuhan recruiter yang sedang berjalan.
                </p>
              </div>

              <div className="recruiter-flow-candidate-summary">
                <article className="recruiter-flow-candidate-summary-card">
                  <span>Lowongan aktif dipilih</span>
                  <strong>{selectedJob?.title || 'Belum ada lowongan dipilih'}</strong>
                  <small>{selectedJob?.location || 'Pilih lowongan untuk mulai memfilter pelamar.'}</small>
                </article>
                <article className="recruiter-flow-candidate-summary-card">
                  <span>Favorit recruiter</span>
                  <strong>{favoriteApplicationIds.length}</strong>
                  <small>Tandai pelamar prioritas agar lebih cepat diakses kembali.</small>
                </article>
              </div>

              <div className="workspace-action-row recruiter-flow-toolbar recruiter-flow-toolbar-dense">
                <select
                  className="recruiter-flow-select"
                  value={selectedJobId ?? ''}
                  onChange={(event) => setSelectedJobId(Number(event.target.value))}
                >
                  {recruiterJobs.length === 0 ? (
                    <option value="">Belum ada lowongan recruiter</option>
                  ) : (
                    recruiterJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} • {job.location}
                      </option>
                    ))
                  )}
                </select>

                <input
                  type="search"
                  className="recruiter-flow-search"
                  placeholder="Cari nama, email, skill, alamat, atau ringkasan kandidat"
                  value={candidateSearchQuery}
                  onChange={(event) => setCandidateSearchQuery(event.target.value)}
                />

                <select
                  className="recruiter-flow-select"
                  value={candidateStageFilter}
                  onChange={(event) => setCandidateStageFilter(event.target.value)}
                >
                  <option value="all">Semua tahap kandidat</option>
                  {APPLICATION_STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className="recruiter-flow-select"
                  value={candidateSortOrder}
                  onChange={(event) => setCandidateSortOrder(event.target.value)}
                >
                  {RECRUITER_CANDIDATE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      Urut: {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-outline recruiter-flow-reset-button"
                  onClick={handleResetCandidateFilters}
                >
                  Reset
                </button>
              </div>

              <div className="workspace-action-row recruiter-flow-toolbar recruiter-flow-toolbar-secondary">
                <select
                  className="recruiter-flow-select"
                  value={candidateFavoriteFilter}
                  onChange={(event) => setCandidateFavoriteFilter(event.target.value)}
                >
                  <option value="all">Semua favorit</option>
                  <option value="favorite">Hanya favorit</option>
                  <option value="non-favorite">Belum favorit</option>
                </select>

                <select
                  className="recruiter-flow-select"
                  value={candidateGenderFilter}
                  onChange={(event) => setCandidateGenderFilter(event.target.value)}
                >
                  {RECRUITER_CANDIDATE_GENDER_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className="recruiter-flow-select"
                  value={candidateEducationFilter}
                  onChange={(event) => setCandidateEducationFilter(event.target.value)}
                >
                  {candidateEducationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className="recruiter-flow-select"
                  value={candidateExperienceFilter}
                  onChange={(event) => setCandidateExperienceFilter(event.target.value)}
                >
                  {RECRUITER_CANDIDATE_EXPERIENCE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className="recruiter-flow-select"
                  value={candidateSalaryFilter}
                  onChange={(event) => setCandidateSalaryFilter(event.target.value)}
                >
                  {RECRUITER_CANDIDATE_SALARY_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="workspace-application-filter-row">
                <button
                  type="button"
                  className={`workspace-filter-chip${
                    candidateStageFilter === 'all' ? ' is-active' : ''
                  }`}
                  onClick={() => setCandidateStageFilter('all')}
                >
                  Semua ({candidateStageCounts.all || 0})
                </button>
                {APPLICATION_STAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`workspace-filter-chip${
                      candidateStageFilter === option.value ? ' is-active' : ''
                    }`}
                    onClick={() => setCandidateStageFilter(option.value)}
                  >
                    {option.label} ({candidateStageCounts[option.value] || 0})
                  </button>
                ))}
              </div>

              {selectedJob && (
                <div className="recruiter-flow-bulk-bar">
                  <label className="recruiter-flow-bulk-check">
                    <input
                      type="checkbox"
                      checked={allFilteredApplicationsSelected}
                      onChange={handleToggleSelectAllApplications}
                    />
                    <span>
                      Pilih semua ({selectedFilteredApplicationIds.length}/{filteredApplications.length})
                    </span>
                  </label>

                  <div className="recruiter-flow-bulk-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleBulkRejectApplications}
                      disabled={!selectedFilteredApplicationIds.length || Boolean(applicationActionInFlightId)}
                    >
                      Tolak Terpilih
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        handleDownloadApplications(
                          filteredApplications.filter((application) =>
                            selectedFilteredApplicationIds.includes(Number(application.id))
                          )
                        )
                      }
                      disabled={!selectedFilteredApplicationIds.length}
                    >
                      Download Terpilih
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleHideSelectedApplications(selectedFilteredApplicationIds)}
                      disabled={!selectedFilteredApplicationIds.length}
                    >
                      Arsipkan dari Tampilan
                    </button>
                  </div>
                </div>
              )}

              {applicationsError && <div className="error">{applicationsError}</div>}

              {!selectedJob ? (
                <div className="workspace-card-list">
                  <article className="workspace-subcard">
                    <div className="workspace-subcard-heading">
                      <strong>Belum ada lowongan terpilih</strong>
                      <span>Pilih lowongan terlebih dahulu</span>
                    </div>
                    <p>
                      Pilih salah satu lowongan recruiter untuk melihat kandidat yang masuk ke
                      pipeline.
                    </p>
                  </article>
                </div>
              ) : isLoadingApplications ? (
                <div className="loading">Memuat kandidat untuk {selectedJob.title}...</div>
              ) : filteredApplications.length === 0 ? (
                <div className="workspace-card-list">
                  <article className="workspace-subcard">
                    <div className="workspace-subcard-heading">
                      <strong>Belum ada kandidat di filter ini</strong>
                      <span>{selectedJob.title}</span>
                    </div>
                    <p>
                      Coba ubah tahap filter atau aktifkan lowongan lain untuk melihat pipeline
                      kandidat yang lebih ramai.
                    </p>
                  </article>
                </div>
              ) : (
                <div className="workspace-card-list">
                  {filteredApplications.map((application) => {
                    const topSkills = application.candidateProfile.skills
                      .filter((item) => item.trim())
                      .slice(0, 4);
                    const preferredRole =
                      application.candidateProfile.preferredRoles.find((item) => item.trim()) || '-';
                    const preferredLocation =
                      application.candidateProfile.preferredLocations.find((item) => item.trim()) || '-';
                    const candidateLabel = application.candidate?.name || 'Kandidat';
                    const candidateGenderLabel =
                      application.candidateGender === 'male'
                        ? 'Pria'
                        : application.candidateGender === 'female'
                          ? 'Wanita'
                          : 'Belum diisi';
                    const candidateInitials = buildRecruiterInitials(candidateLabel);

                    return (
                      <article
                        key={application.id}
                        className="workspace-subcard recruiter-flow-candidate-card recruiter-flow-candidate-card-detailed"
                      >
                        <div className="recruiter-flow-candidate-head">
                          <div className="recruiter-flow-candidate-primary">
                            <label className="recruiter-flow-candidate-check">
                              <input
                                type="checkbox"
                                checked={selectedApplicationIds.includes(Number(application.id))}
                                onChange={() => handleToggleApplicationSelection(Number(application.id))}
                              />
                            </label>

                            <div className="recruiter-flow-candidate-avatar">
                              {application.candidateProfile.photoDataUrl ? (
                                <img
                                  src={application.candidateProfile.photoDataUrl}
                                  alt={candidateLabel}
                                />
                              ) : (
                                <span>{candidateInitials}</span>
                              )}
                            </div>

                            <div className="recruiter-flow-candidate-copy">
                              <strong>{candidateLabel}</strong>
                              <span>
                                {application.candidate?.email || '-'} • {application.candidate?.phone || '-'}
                              </span>
                              <small>
                                {candidateGenderLabel} • Usia {application.candidateAge || '-'} •{' '}
                                {application.candidateEducationLabel}
                              </small>
                            </div>
                          </div>

                          <div className="recruiter-flow-candidate-side">
                            <button
                              type="button"
                              className={`recruiter-flow-favorite-button${
                                application.isFavorited ? ' is-active' : ''
                              }`}
                              onClick={() => handleToggleApplicationFavorite(Number(application.id))}
                            >
                              {application.isFavorited ? '★ Favorit' : '☆ Favorit'}
                            </button>
                            <span
                              className={`workspace-status-pill workspace-status-pill-${
                                application.stageMeta.tone === 'danger'
                                  ? 'danger'
                                  : application.stageMeta.tone === 'success'
                                    ? 'success'
                                    : application.stageMeta.tone === 'warning'
                                      ? 'warning'
                                      : 'muted'
                              }`}
                            >
                              {application.stageLabel}
                            </span>
                            <small>Skor rekomendasi {application.recommendationScore}/100</small>
                          </div>
                        </div>

                        <p>{application.stageMeta.summary}</p>

                        <div className="recruiter-flow-candidate-stat-grid">
                          <article className="recruiter-flow-candidate-stat-card">
                            <span>Role incaran</span>
                            <strong>{preferredRole}</strong>
                          </article>
                          <article className="recruiter-flow-candidate-stat-card">
                            <span>Lokasi minat</span>
                            <strong>{preferredLocation}</strong>
                          </article>
                          <article className="recruiter-flow-candidate-stat-card">
                            <span>Gaji harapan</span>
                            <strong>
                              {application.candidateExpectedSalary
                                ? formatCurrency(application.candidateExpectedSalary)
                                : '-'}
                            </strong>
                          </article>
                          <article className="recruiter-flow-candidate-stat-card">
                            <span>Pengalaman</span>
                            <strong>
                              {application.candidateExperienceType === 'experienced'
                                ? `${application.candidateExperienceEntries} riwayat`
                                : 'Freshgraduate'}
                            </strong>
                          </article>
                        </div>

                        <div className="workspace-inline-metadata">
                          <span>Dikirim: {formatDateTime(application.applied_at)}</span>
                          <span>Lowongan: {selectedJob.title}</span>
                          <span>
                            Screening: {application.screening_summary?.completion_rate || 0}% lengkap
                          </span>
                          <span>CV tersimpan: {application.candidateProfile.resumeFiles.length}</span>
                          <span>
                            Dokumen pendukung: {application.candidateProfile.certificateFiles.length}
                          </span>
                        </div>

                        {application.candidateProfile.profileSummary && (
                          <div className="workspace-application-note">
                            <strong>Ringkasan kandidat</strong>
                            <p>{application.candidateProfile.profileSummary}</p>
                          </div>
                        )}

                        {application.cover_letter && (
                          <div className="workspace-application-note">
                            <strong>Catatan lamaran</strong>
                            <p>{application.cover_letter}</p>
                          </div>
                        )}

                        {application.screening_summary?.total_questions > 0 && (
                          <div className="workspace-application-note">
                            <strong>Ringkasan screening</strong>
                            <p>
                              {application.screening_summary.answered_questions}/
                              {application.screening_summary.total_questions} terjawab •{' '}
                              {application.screening_summary.positive_answers} jawaban "Ya" •{' '}
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

                        <div className="workspace-tag-list">
                          {topSkills.length > 0 ? (
                            topSkills.map((skill) => (
                              <span key={skill} className="workspace-chip">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="workspace-chip">Belum ada skill yang diisi</span>
                          )}
                        </div>

                        {application.candidate?.document_access?.notice && (
                          <div className="workspace-application-note">
                            <strong>Akses berkas sesuai paket</strong>
                            <p>{application.candidate.document_access.notice}</p>
                          </div>
                        )}

                        {application.video_intro_url && (
                          <div className="workspace-application-note">
                            <strong>Video screening kandidat</strong>
                            <p>
                              <a
                                href={application.video_intro_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Buka video screening
                              </a>
                            </p>
                          </div>
                        )}

                        <div className="workspace-action-row recruiter-flow-job-actions recruiter-flow-candidate-actions">
                          <select
                            className="recruiter-flow-select"
                            value={application.stage}
                            onChange={(event) =>
                              handleApplicationStageChange(application, event.target.value)
                            }
                            disabled={applicationActionInFlightId === application.id}
                          >
                            {APPLICATION_STAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <a
                            href={`mailto:${application.candidate?.email || ''}`}
                            className="btn btn-outline"
                          >
                            Email
                          </a>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleDownloadApplications([application])}
                          >
                            Download CV
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleHideSelectedApplications([Number(application.id)])}
                          >
                            Arsipkan
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleOpenConversation(application.candidate)}
                          >
                            Chat di Platform
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'talent' && (
          <TalentSearchPanel
            plan={packageOverview.current || companyProfile.plan}
            jobs={recruiterJobs}
            activeJob={selectedTalentJob}
            filters={talentFilters}
            onFilterChange={handleTalentFilterChange}
            onReset={handleResetTalentFilters}
            onSearch={() => runTalentSearch(1)}
            onPageChange={runTalentSearch}
            results={talentCandidates}
            pagination={talentPagination}
            isLoading={isLoadingTalent}
            favoriteCandidateIds={favoriteTalentIds}
            onToggleFavorite={handleToggleFavoriteTalent}
            onDownloadResume={handleDownloadTalentResume}
            onMessageCandidate={(candidate) =>
              handleOpenConversation({
                id: candidate.id,
                name: candidate.name,
                role: 'candidate',
                email: candidate.email,
              })
            }
          />
        )}

        {activeSection === 'messages' && (
          <InboxWorkspace
            title="Chat recruiter dengan kandidat dan superadmin"
            description="Gunakan percakapan ini untuk follow up registrasi perusahaan, koordinasi screening, dan tindak lanjut hiring tanpa keluar dari platform."
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
            emptyMessage="Pilih kandidat atau superadmin yang ingin Anda hubungi."
          />
        )}

        {activeSection === 'package' && (
          <section className="workspace-section-stack">
            <article className="workspace-panel" data-reveal>
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Paket Recruiter</span>
                  <h2>Atur batas fitur sesuai kebutuhan hiring</h2>
                </div>
                <p>
                  Paket memengaruhi jumlah lowongan aktif, hasil talent search yang terbuka, dan
                  jumlah berkas kandidat yang bisa dilihat recruiter.
                </p>
              </div>

              <div className="workspace-candidate-highlight-grid">
                <article className="workspace-subcard">
                  <div className="workspace-subcard-heading">
                    <strong>Paket aktif</strong>
                    <span>{packageOverview.current?.label || companyProfile.plan?.label || 'Starter'}</span>
                  </div>
                  <p>
                    {packageOverview.current?.description ||
                      companyProfile.plan?.description ||
                      'Paket recruiter aktif mengatur akses talent search dan berkas kandidat.'}
                  </p>
                </article>

                <article className="workspace-subcard">
                  <div className="workspace-subcard-heading">
                    <strong>KN Credit</strong>
                    <span>{companyProfile.kn_credit || 0}</span>
                  </div>
                  <p>
                    Credit ditampilkan sebagai penanda akun. Saat ini credit ikut terbaca di paket
                    recruiter aktif.
                  </p>
                </article>
              </div>
            </article>

            <div className="workspace-card-list">
              {(packageOverview.catalog || []).map((plan) => {
                const isActivePlan =
                  (packageOverview.current?.code || companyProfile.plan_code) === plan.code;

                return (
                  <article key={plan.code} className="workspace-panel" data-reveal>
                    <div className="workspace-subcard-heading">
                      <div>
                        <strong>{plan.label}</strong>
                        <span>{isActivePlan ? 'Paket aktif' : 'Siap dipilih'}</span>
                      </div>
                      <button
                        type="button"
                        className={isActivePlan ? 'btn btn-outline' : 'btn btn-primary'}
                        onClick={() => handlePackageChange(plan.code)}
                        disabled={isSavingPackage || isActivePlan}
                      >
                        {isSavingPackage && isActivePlan
                          ? 'Menyimpan...'
                          : isActivePlan
                            ? 'Sedang Dipakai'
                            : 'Gunakan Paket'}
                      </button>
                    </div>

                    <p>{plan.description}</p>

                    <div className="workspace-inline-metadata">
                      <span>
                        Lowongan aktif:{' '}
                        {plan.job_limit === null ? 'Tanpa batas' : `${plan.job_limit} lowongan`}
                      </span>
                      <span>Talent search: {plan.talent_result_limit} kandidat</span>
                      <span>
                        Berkas kandidat: {formatRecruiterPlanDocuments(plan.code)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {isLoadingPackage && <div className="loading">Memuat paket recruiter...</div>}
          </section>
        )}
      </main>

      <nav className="recruiter-mobile-bottom-nav" aria-label="Navigasi cepat recruiter">
        {RECRUITER_MOBILE_BOTTOM_SECTIONS.map((section) => (
          <button
            key={section.value}
            type="button"
            className={`recruiter-mobile-bottom-link${
              activeSection === section.value ? ' is-active' : ''
            }`}
            onClick={() => handleSectionChange(section.value)}
          >
            <span className="recruiter-mobile-bottom-icon" aria-hidden="true">
              {section.icon === 'home' && (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4.5 10.5 12 4l7.5 6.5V19A1.5 1.5 0 0 1 18 20.5h-3.5v-5h-5v5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {section.icon === 'briefcase' && (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 6.5V5A1.5 1.5 0 0 1 9.5 3.5h5A1.5 1.5 0 0 1 16 5v1.5m-11 2h14A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18v-8A1.5 1.5 0 0 1 5 8.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {section.icon === 'clipboard' && (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 4.5h6m-5 0A1.5 1.5 0 0 0 8.5 6v.5m7-2A1.5 1.5 0 0 1 17 6v.5m-8.5 0h7A1.5 1.5 0 0 1 17 8v10A1.5 1.5 0 0 1 15.5 19.5h-7A1.5 1.5 0 0 1 7 18V8A1.5 1.5 0 0 1 8.5 6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M9.5 11h5m-5 3h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
              {section.icon === 'user' && (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {section.icon === 'message' && (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 7.5h10A2.5 2.5 0 0 1 19.5 10v7.5L16 15h-9A2.5 2.5 0 0 1 4.5 12.5V10A2.5 2.5 0 0 1 7 7.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span>{section.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default RecruiterDashboardPage;
