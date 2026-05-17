import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RecruiterTopbar from '../components/RecruiterTopbar.jsx';
import useAuth from '../hooks/useAuth';
import useJobs from '../hooks/useJobs';
import JobService from '../services/jobService';
import {
  RECRUITER_SECTION_OPTIONS,
  getRecruiterCompanyCompletion,
  readRecruiterCompanyProfile,
  saveJobWorkflowStatus,
} from '../utils/recruiterFlow.js';
import {
  formatExperienceLevel,
  formatInterviewType,
  formatVideoScreeningRequirement,
  formatWorkMode,
} from '../utils/jobFormatters.js';
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/recruiterDashboard.css';
import '../styles/recruiterJobCreate.css';

const RECRUITER_DASHBOARD_STORAGE_KEY = 'recruiter_dashboard_ui_state';

const FORM_STEP_OPTIONS = [
  { number: 1, label: 'Informasi Dasar' },
  { number: 2, label: 'Kualifikasi' },
  { number: 3, label: 'Kuis' },
  { number: 4, label: 'Preview dan Pengaturan' },
];

const GENDER_OPTIONS = [
  { value: 'all', label: 'Pria/Wanita' },
  { value: 'male', label: 'Pria' },
  { value: 'female', label: 'Wanita' },
];

const CANDIDATE_EXPERIENCE_OPTIONS = [
  { value: 'fresh-graduate', label: 'Tanpa Pengalaman Bekerja' },
  { value: 'experienced', label: 'Berpengalaman' },
];

const EDUCATION_OPTIONS = [
  'Tidak ada minimal pendidikan',
  'SMP / sederajat',
  'SMA / SMK',
  'Diploma (D1-D3)',
  'Sarjana (S1)',
  'Magister (S2)',
];

const PHOTO_REQUIREMENT_OPTIONS = [
  { value: 'optional', label: 'Terima kandidat tanpa foto diri' },
  { value: 'required', label: 'Kandidat wajib upload foto' },
];

const SKILL_OPTIONS = [
  'Komunikatif',
  'Kerjasama Tim',
  'Melayani Pelanggan',
  'Siap Kerja Weekend',
  'Target Oriented',
  'Siap Shift Malam',
  'Bekerja Dibawah Tekanan',
  'Detail dalam Bekerja',
  'Komunikasi Interpersonal',
  'Individual',
  'Keahlian Lainnya',
];

const QUIZ_SCREENING_QUESTIONS = [
  {
    id: 'ready-to-work',
    label: 'Segera bekerja',
    title: 'Segera bekerja',
    description: 'Tambahkan pertanyaan segera bekerja yang relevan untuk pekerjaan ini.',
    question: 'Apakah Anda bersedia segera bekerja, jika terpilih?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'driver-license',
    label: 'SIM',
    title: 'SIM Aktif',
    description: 'Gunakan pertanyaan ini bila posisi membutuhkan mobilitas kerja.',
    question: 'Apakah Anda memiliki SIM aktif yang masih berlaku?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'police-record',
    label: 'SKCK',
    title: 'SKCK',
    description: 'Pastikan kandidat siap melengkapi SKCK saat proses seleksi berjalan.',
    question: 'Apakah Anda memiliki atau siap mengurus SKCK aktif?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'reference-letter',
    label: 'Referensi Kerja',
    title: 'Referensi Kerja',
    description: 'Cocok untuk posisi yang membutuhkan verifikasi pengalaman sebelumnya.',
    question: 'Apakah Anda dapat menyertakan referensi kerja dari tempat sebelumnya?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'motorcycle',
    label: 'Motor pribadi',
    title: 'Motor Pribadi',
    description: 'Pakai pertanyaan ini bila kandidat perlu mendukung mobilitas lapangan.',
    question: 'Apakah Anda memiliki motor pribadi untuk menunjang pekerjaan ini?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'phone',
    label: 'Handphone',
    title: 'Handphone Aktif',
    description: 'Membantu memastikan kandidat memiliki perangkat komunikasi yang memadai.',
    question: 'Apakah Anda memiliki handphone aktif yang dapat digunakan untuk bekerja?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'height',
    label: 'Tinggi badan',
    title: 'Tinggi Badan',
    description: 'Digunakan bila posisi memiliki kebutuhan fisik tertentu.',
    question: 'Apakah tinggi badan Anda memenuhi persyaratan posisi ini?',
    answers: ['Ya', 'Tidak'],
  },
  {
    id: 'english',
    label: 'Bahasa inggris',
    title: 'Bahasa Inggris',
    description: 'Tanyakan ini bila pekerjaan membutuhkan komunikasi dasar dalam bahasa Inggris.',
    question: 'Apakah Anda mampu berkomunikasi dasar dalam bahasa Inggris?',
    answers: ['Ya', 'Tidak'],
  },
];

const CATEGORY_OPTIONS = [
  'Customer Service',
  'Operations',
  'Sales',
  'Marketing',
  'Technology',
  'Warehouse',
  'Human Resources',
  'Finance',
  'Administration',
];

const JOB_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
];

const WORK_MODE_OPTIONS = [
  { value: 'wfo', label: 'WFO' },
  { value: 'hybrid', label: 'Hybrid (Campuran)' },
  { value: 'wfh', label: 'WFH' },
];

const INTERVIEW_TYPE_OPTIONS = [
  { value: 'onsite', label: 'Tatap muka di lokasi' },
  { value: 'online', label: 'Online / Video Call' },
  { value: 'phone', label: 'Telepon' },
  { value: 'hybrid', label: 'Hybrid (Campuran)' },
];

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'entry', label: 'Entry Level (Freshgraduate)' },
  { value: 'junior', label: 'Junior Level (1 - 3 tahun)' },
  { value: 'mid', label: 'Mid Level (3 - 5 tahun)' },
  { value: 'senior', label: 'Senior Level (5 + tahun)' },
];

const VIDEO_SCREENING_OPTIONS = [
  {
    value: 'required',
    label: 'Wajib',
    description: 'Kandidat wajib menyiapkan video yang menceritakan identitas mereka.',
  },
  {
    value: 'optional',
    label: 'Tidak wajib',
    description: 'Fleksibel dan tidak mengharuskan kandidat menceritakan identitas mereka.',
  },
];

const CATEGORY_CUSTOM_SKILL_REFERENCES = {
  'Customer Service': [
    'Penanganan Komplain',
    'CRM / Ticketing',
    'Typing Cepat',
    'Upselling',
  ],
  Operations: ['Microsoft Excel', 'Administrasi Operasional', 'Problem Solving', 'SOP Kerja'],
  Sales: ['Negosiasi', 'Canvassing', 'Closing', 'Presentasi Produk'],
  Marketing: ['Copywriting', 'Meta Ads', 'Analisis Campaign', 'Google Sheets'],
  Technology: ['React', 'Laravel', 'REST API', 'SQL'],
  Warehouse: ['Stock Opname', 'Barcode Scanner', 'SOP Gudang', 'Forklift'],
  'Human Resources': ['Interview Kandidat', 'HRIS', 'Payroll', 'Psikotes Dasar'],
  Finance: ['Microsoft Excel', 'Rekonsiliasi', 'Jurnal Umum', 'Accurate'],
  Administration: ['Data Entry', 'Administrasi Dokumen', 'Microsoft Excel', 'Arsip Digital'],
};

const DEFAULT_CUSTOM_SKILL_REFERENCES = [
  'Komunikasi Lintas Tim',
  'Leadership',
  'Microsoft Excel',
  'Analisis Data',
  'Public Speaking',
  'Problem Solving',
];

const DEFAULT_LOCATION_OPTIONS = [
  'Jakarta Pusat',
  'Jakarta Selatan',
  'Jakarta Barat',
  'Jakarta Timur',
  'Bogor Kota',
  'Kabupaten Bogor',
  'Bandung',
  'Surabaya',
  'Depok',
];

const ADDRESS_REGION_OPTIONS = {
  'DKI Jakarta': {
    'Jakarta Pusat': {
      Kemayoran: ['Gunung Sahari Selatan', 'Sumur Batu'],
      'Tanah Abang': ['Bendungan Hilir', 'Gelora'],
    },
    'Jakarta Selatan': {
      Tebet: ['Tebet Barat', 'Manggarai Selatan'],
      'Kebayoran Baru': ['Kramat Pela', 'Melawai'],
    },
  },
  'Sumatera Utara': {
    'Kota Medan': {
      'Medan Kota': ['Sei Rengas I', 'Sei Rengas II'],
      'Medan Amplas': ['Harjosari I', 'Harjosari II'],
    },
    'Kabupaten Deli Serdang': {
      Lubukpakam: ['Petapahan', 'Pagar Merbau III'],
    },
  },
  'Jawa Timur': {
    'Kab. Sidoarjo': {
      Buduran: ['Bucuran', 'Sidokepung'],
      Candi: ['Gelam', 'Balonggabus'],
    },
    Surabaya: {
      Wonokromo: ['Darmo', 'Ngagel'],
    },
  },
  'Jawa Barat': {
    Bandung: {
      Coblong: ['Dago', 'Lebak Gede'],
    },
    Bogor: {
      'Bogor Tengah': ['Paledang', 'Gudang'],
    },
  },
};

const DEFAULT_ADDRESS_BOOK = [
  {
    id: 'address-cbezt-medan',
    type: 'pusat',
    label: 'Cbezt Medan',
    province: 'Sumatera Utara',
    city: 'Kota Medan',
    district: 'Medan Kota',
    subdistrict: 'Sei Rengas I',
    postalCode: '20214',
    detail:
      'Interview akan dilakukan secara online, Sei Rengas I, Medan Kota, Kota Medan, Sumatera Utara.',
  },
  {
    id: 'address-store-medan',
    type: 'cabang',
    label: 'Store Medan',
    province: 'Sumatera Utara',
    city: 'Kota Medan',
    district: 'Medan Amplas',
    subdistrict: 'Harjosari I',
    postalCode: '20147',
    detail:
      'Interview akan dilakukan secara online, Harjosari I, Medan Amplas, Kota Medan, Sumatera Utara.',
  },
  {
    id: 'address-cbezt-sidoarjo',
    type: 'cabang',
    label: 'Cbezt Sidoarjo',
    province: 'Jawa Timur',
    city: 'Kab. Sidoarjo',
    district: 'Buduran',
    subdistrict: 'Bucuran',
    postalCode: '61252',
    detail:
      'Interview akan dilakukan secara online, Banyukemanten, Bucuran, Kab. Sidoarjo, Jawa Timur.',
  },
];

/**
 * Menyiapkan state kosong untuk form alamat recruiter.
 */
const getInitialAddressForm = () => ({
  type: 'pusat',
  label: '',
  province: '',
  city: '',
  district: '',
  subdistrict: '',
  postalCode: '',
  detail: '',
});

/**
 * Mengubah teks bebas menjadi slug sederhana untuk id lokal dan key UI.
 */
const slugifyValue = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * Menggabungkan detail alamat menjadi satu string ringkas untuk preview penempatan.
 */
const buildAddressSummary = (address) =>
  [address.detail, address.subdistrict, address.district, address.city, address.province]
    .filter(Boolean)
    .join(', ');

/**
 * Menormalkan satu item alamat agar selalu punya shape yang siap dipakai form dan dropdown.
 */
const createAddressEntry = (address) => ({
  id: address.id || `address-${slugifyValue(address.label || 'baru')}`,
  type: address.type || 'cabang',
  label: address.label || 'Alamat Baru',
  province: address.province || '',
  city: address.city || '',
  district: address.district || '',
  subdistrict: address.subdistrict || '',
  postalCode: address.postalCode || '',
  detail: address.detail || '',
  summary: address.summary || buildAddressSummary(address),
});

/**
 * Menggabungkan buku alamat tersimpan dengan lokasi lowongan agar tidak ada penempatan yang terlewat.
 */
const mergeAddressBook = (addresses, locations) => {
  const existingMap = new Map(
    addresses.map((address) => [address.label.trim().toLowerCase(), createAddressEntry(address)])
  );

  locations.filter(Boolean).forEach((location) => {
    const lookupKey = location.trim().toLowerCase();

    if (existingMap.has(lookupKey)) {
      return;
    }

    existingMap.set(
      lookupKey,
      createAddressEntry({
        id: `address-${slugifyValue(location)}`,
        type: 'cabang',
        label: location,
        detail: `Lokasi penempatan ${location}.`,
      })
    );
  });

  return Array.from(existingMap.values());
};

const INITIAL_FORM = {
  title: '',
  experience_level: '',
  category: '',
  description: '',
  job_type: '',
  work_mode: '',
  shift_night: 'no',
  openings_count: '',
  location: '',
  salary_min: '',
  salary_max: '',
  interview_type: '',
  interview_note: '',
  expiry_date: '',
  candidate_gender: '',
  candidate_experience: '',
  candidate_education: '',
  candidate_age_min: '17',
  candidate_age_max: '60',
  candidate_no_age_limit: false,
  candidate_photo_requirement: '',
  candidate_domicile: '',
  candidate_skills: [],
  candidate_custom_skill: '',
  video_screening_requirement: 'optional',
  quiz_screening_questions: ['ready-to-work'],
  quiz_question_1: '',
  quiz_question_2: '',
  quiz_question_3: '',
};

const FORM_STEP_LABELS = FORM_STEP_OPTIONS.reduce((labels, step) => {
  labels[step.number] = step.label;
  return labels;
}, {});

const FIELD_NAVIGATION_ORDER = [
  'title',
  'experience_level',
  'category',
  'description',
  'job_type',
  'work_mode',
  'openings_count',
  'location',
  'salary_min',
  'salary_max',
  'interview_type',
  'expiry_date',
  'experience_level',
  'candidate_gender',
  'candidate_experience',
  'candidate_education',
  'candidate_age_min',
  'candidate_age_max',
  'candidate_photo_requirement',
  'candidate_domicile',
  'candidate_skills',
  'candidate_custom_skill',
  'video_screening_requirement',
  'quiz_screening_questions',
];

const FIELD_METADATA = {
  title: {
    label: 'Judul Pekerjaan',
    step: 1,
    section: 'Loker yang ingin Anda pasang',
  },
  experience_level: {
    label: 'Level Kandidat',
    step: 1,
    section: 'Loker yang ingin Anda pasang',
  },
  category: {
    label: 'Kategori Pekerjaan',
    step: 1,
    section: 'Loker yang ingin Anda pasang',
  },
  description: {
    label: 'Deskripsi Pekerjaan',
    step: 1,
    section: 'Loker yang ingin Anda pasang',
  },
  job_type: {
    label: 'Jenis Pekerjaan',
    step: 1,
    section: 'Detil Pekerjaan',
  },
  work_mode: {
    label: 'Jenis Tempat Bekerja',
    step: 1,
    section: 'Detil Pekerjaan',
  },
  openings_count: {
    label: 'Jumlah Kandidat yang Dibutuhkan',
    step: 1,
    section: 'Detil Pekerjaan',
  },
  location: {
    label: 'Alamat Penempatan',
    step: 1,
    section: 'Detil Pekerjaan',
  },
  salary_min: {
    label: 'Gaji Bulanan Minimum',
    step: 1,
    section: 'Detil Pekerjaan',
  },
  salary_max: {
    label: 'Gaji Bulanan Maksimum',
    step: 1,
    section: 'Detil Pekerjaan',
  },
  interview_type: {
    label: 'Tipe Wawancara',
    step: 1,
    section: 'Informasi wawancara',
  },
  expiry_date: {
    label: 'Tayang Hingga',
    step: 1,
    section: 'Jangka waktu penayangan loker',
  },
  candidate_gender: {
    label: 'Jenis Kelamin',
    step: 2,
    section: 'Kriteria Kandidat',
  },
  candidate_experience: {
    label: 'Pengalaman Bekerja',
    step: 2,
    section: 'Kriteria Kandidat',
  },
  candidate_education: {
    label: 'Tingkat Pendidikan Minimal',
    step: 2,
    section: 'Kriteria Kandidat',
  },
  candidate_age_min: {
    label: 'Usia Minimum Kandidat',
    step: 2,
    section: 'Kriteria Kandidat',
  },
  candidate_age_max: {
    label: 'Usia Maksimum Kandidat',
    step: 2,
    section: 'Kriteria Kandidat',
  },
  candidate_photo_requirement: {
    label: 'Upload Foto',
    step: 2,
    section: 'Kriteria Kandidat',
  },
  candidate_domicile: {
    label: 'Domisili Kandidat',
    step: 2,
    section: 'Lokasi Kandidat',
  },
  candidate_skills: {
    label: 'Jenis Keahlian',
    step: 2,
    section: 'Keahlian yang dibutuhkan',
  },
  candidate_custom_skill: {
    label: 'Referensi Keahlian Lainnya',
    step: 2,
    section: 'Keahlian yang dibutuhkan',
  },
  video_screening_requirement: {
    label: 'Video Skrining',
    step: 2,
    section: 'Pemberitahuan ke pelamar',
  },
  quiz_screening_questions: {
    label: 'Pertanyaan Skrining',
    step: 3,
    section: 'Kuis',
  },
};

const FOCUSABLE_FIELD_SELECTOR =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

/**
 * Menyusun detail error validasi berdasarkan urutan field dan step form agar lebih mudah diarahkan.
 */
const buildValidationIssueDetails = (errors) => {
  const orderedFields = [
    ...FIELD_NAVIGATION_ORDER.filter((fieldName) => errors[fieldName]),
    ...Object.keys(errors).filter((fieldName) => !FIELD_NAVIGATION_ORDER.includes(fieldName)),
  ];

  return orderedFields.map((fieldName) => {
    const metadata = FIELD_METADATA[fieldName] || {};

    return {
      fieldName,
      label: metadata.label || fieldName,
      step: metadata.step || 1,
      stepLabel: FORM_STEP_LABELS[metadata.step] || 'Form',
      section: metadata.section || 'Bagian Form',
      message: errors[fieldName],
    };
  });
};

const DIGIT_ONLY_FIELDS = new Set(['salary_min', 'salary_max', 'openings_count']);

/**
 * Membatasi input angka hanya ke digit yang valid untuk field numerik.
 */
const normalizeDigitInput = (value = '') => {
  const digitOnlyValue = String(value).replace(/\D/g, '');

  if (!digitOnlyValue) {
    return '';
  }

  return digitOnlyValue.replace(/^0+(?=\d)/, '') || '0';
};

/**
 * Menambahkan pemisah ribuan untuk field angka yang sedang ditampilkan di form.
 */
const formatNumericFieldValue = (value = '') => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const numericValue = Number(String(value).replace(/\D/g, ''));

  if (Number.isNaN(numericValue)) {
    return '';
  }

  return new Intl.NumberFormat('id-ID').format(numericValue);
};

/**
 * Menampilkan angka salary dalam format rupiah untuk preview lowongan.
 */
const formatCurrency = (value) => {
  if (value === '' || value === null || value === undefined) {
    return '-';
  }

  const numericValue = Number(String(value).replace(/\D/g, ''));

  if (Number.isNaN(numericValue)) {
    return '-';
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(numericValue);
};

/**
 * Memecah daftar referensi skill tambahan dari input teks recruiter.
 */
const splitCustomSkillReferences = (value = '') =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Menyamakan bentuk key referensi agar pencocokan custom skill lebih stabil.
 */
const normalizeReferenceKey = (value = '') => String(value).trim().toLowerCase();

/**
 * Menyimpan sebagian state dashboard recruiter agar pengalaman kembali ke halaman tetap halus.
 */
const persistRecruiterDashboardState = (partialState) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const storedState = window.localStorage.getItem(RECRUITER_DASHBOARD_STORAGE_KEY);
    const parsedState = storedState ? JSON.parse(storedState) : {};
    window.localStorage.setItem(
      RECRUITER_DASHBOARD_STORAGE_KEY,
      JSON.stringify({
        ...parsedState,
        ...partialState,
      })
    );
  } catch (error) {
    // Ignore localStorage errors and keep navigation working.
  }
};

/**
 * Mengambil pesan error paling relevan dari response pembuatan lowongan.
 */
const getCreateJobErrorMessage = (error) => {
  if (error?.errors && typeof error.errors === 'object') {
    const firstFieldError = Object.values(error.errors).flat().find(Boolean);
    if (firstFieldError) {
      return firstFieldError;
    }
  }

  if (typeof error === 'string') {
    return error;
  }

  return error?.message || 'Gagal membuat lowongan. Periksa kembali isi form Anda.';
};

/**
 * Menggabungkan pertanyaan screening bawaan dan custom menjadi payload backend yang seragam.
 */
const buildScreeningQuestionPayload = (selectedQuestions, customQuestions) => [
  ...selectedQuestions.map((question) => ({
    id: question.id,
    type: 'single-choice',
    title: question.title,
    question: question.question,
    answers: question.answers,
    required: true,
  })),
  ...customQuestions.map((question, index) => ({
    id: `custom-question-${index + 1}`,
    type: 'text',
    title: `Pertanyaan Tambahan ${index + 1}`,
    question: question.trim(),
    answers: [],
    required: true,
  })),
];

/**
 * Menjadi wizard pembuatan lowongan recruiter dari detail job sampai preview publikasi.
 */
const RecruiterJobCreatePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { createJob, isLoading } = useJobs();
  const [companyProfile, setCompanyProfile] = useState(() => readRecruiterCompanyProfile(user));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [activeQuizQuestionId, setActiveQuizQuestionId] = useState(QUIZ_SCREENING_QUESTIONS[0].id);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitErrorDetails, setSubmitErrorDetails] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState(() =>
    DEFAULT_ADDRESS_BOOK.map((address) => createAddressEntry(address))
  );
  const [isAddressMenuOpen, setIsAddressMenuOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressFormData, setAddressFormData] = useState(getInitialAddressForm);
  const [addressFormErrors, setAddressFormErrors] = useState({});
  const addressSelectorRef = useRef(null);
  const fieldRefs = useRef({});
  const [pendingFieldNavigation, setPendingFieldNavigation] = useState('');

  useEffect(() => {
    persistRecruiterDashboardState({ activeSection: 'jobs' });
  }, []);

  useEffect(() => {
    setCompanyProfile(readRecruiterCompanyProfile(user));
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    JobService.getAvailableLocations()
      .then((locations) => {
        if (!isMounted || !Array.isArray(locations) || locations.length === 0) {
          return;
        }

        setSavedAddresses((current) => mergeAddressBook(current, [...locations, ...DEFAULT_LOCATION_OPTIONS]));
      })
      .catch(() => {
        setSavedAddresses((current) => mergeAddressBook(current, DEFAULT_LOCATION_OPTIONS));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !isAddressMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!addressSelectorRef.current?.contains(event.target)) {
        setIsAddressMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddressMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddressMenuOpen]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isAddressModalOpen) {
      return undefined;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddressModalOpen(false);
        setEditingAddressId(null);
        setAddressFormErrors({});
        setAddressFormData(getInitialAddressForm());
      }
    };

    body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddressModalOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pendingFieldNavigation) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const fieldNode = fieldRefs.current[pendingFieldNavigation];

      if (!fieldNode) {
        setPendingFieldNavigation('');
        return;
      }

      fieldNode.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      const control =
        typeof fieldNode.matches === 'function' && fieldNode.matches(FOCUSABLE_FIELD_SELECTOR)
          ? fieldNode
          : fieldNode.querySelector(FOCUSABLE_FIELD_SELECTOR);

      if (control && typeof control.focus === 'function') {
        window.setTimeout(() => {
          control.focus({ preventScroll: true });
        }, 180);
      }

      setPendingFieldNavigation('');
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [currentStep, pendingFieldNavigation]);

  const descriptionLength = formData.description.trim().length;
  const addressDetailLength = addressFormData.detail.trim().length;
  const minimumExpiryDate = new Date().toISOString().split('T')[0];
  const selectedAddress =
    savedAddresses.find((address) => address.label === formData.location) || null;
  const placementProvince = selectedAddress?.province || formData.location || 'Area Penempatan';
  const placementCity = selectedAddress?.city || formData.location || 'Area Penempatan';
  const candidateDomicileOptions = [
    {
      value: 'same-province',
      label: `Provinsi sesuai penempatan kerja (${placementProvince})`,
    },
    {
      value: 'same-city',
      label: `Kota/kabupaten sesuai penempatan kerja (${placementCity})`,
    },
    {
      value: 'same-area',
      label: 'Domisili sekitar area penempatan',
    },
    {
      value: 'open',
      label: 'Tidak ada batasan domisili',
    },
  ];
  const currentStepNote =
    {
      1: 'Info yang Anda masukkan akan ditampilkan secara publik. Pastikan data diisi dengan lengkap dan benar.',
      2: 'Kriteria profil kandidat yang Anda tentukan akan tampil sebagai persyaratan minimum pada lowongan. Semakin longgar kriterianya, semakin banyak pilihan kandidat Anda.',
      3: 'Buat pertanyaan yang sesuai dengan kebutuhan Anda. Seleksi kandidat lebih ketat sesuai kualifikasi.',
      4: 'Periksa kembali ringkasan lowongan sebelum dipublikasikan ke kandidat.',
    }[currentStep] ||
    'Info lowongan sedang disiapkan. Pastikan seluruh data sudah sesuai.';
  const selectedGenderLabel =
    GENDER_OPTIONS.find((option) => option.value === formData.candidate_gender)?.label || '-';
  const selectedExperienceLabel =
    CANDIDATE_EXPERIENCE_OPTIONS.find((option) => option.value === formData.candidate_experience)
      ?.label || '-';
  const selectedExperienceLevelLabel = formatExperienceLevel(formData.experience_level);
  const selectedPhotoRequirementLabel =
    PHOTO_REQUIREMENT_OPTIONS.find(
      (option) => option.value === formData.candidate_photo_requirement
    )?.label || '-';
  const selectedDomicileLabel =
    candidateDomicileOptions.find((option) => option.value === formData.candidate_domicile)?.label ||
    '-';
  const selectedWorkModeLabel = formatWorkMode(formData.work_mode);
  const selectedInterviewTypeLabel = formatInterviewType(formData.interview_type);
  const selectedScreeningQuestionIds = Array.isArray(formData.quiz_screening_questions)
    ? formData.quiz_screening_questions
    : [];
  const customQuizQuestions = [
    formData.quiz_question_1,
    formData.quiz_question_2,
    formData.quiz_question_3,
  ].filter((question) => question.trim());
  const resolvedActiveQuizQuestionId = selectedScreeningQuestionIds.includes(activeQuizQuestionId)
    ? activeQuizQuestionId
    : selectedScreeningQuestionIds[0] || QUIZ_SCREENING_QUESTIONS[0].id;
  const activeQuizQuestion =
    QUIZ_SCREENING_QUESTIONS.find((question) => question.id === resolvedActiveQuizQuestionId) ||
    QUIZ_SCREENING_QUESTIONS[0];
  const selectedScreeningQuestionLabels = QUIZ_SCREENING_QUESTIONS.filter((question) =>
    selectedScreeningQuestionIds.includes(question.id)
  ).map((question) => question.label);
  const selectedScreeningQuestions = QUIZ_SCREENING_QUESTIONS.filter((question) =>
    selectedScreeningQuestionIds.includes(question.id)
  );
  const customSkillReferences = splitCustomSkillReferences(formData.candidate_custom_skill);
  const companyCompletion = getRecruiterCompanyCompletion(companyProfile);
  const occupiedCustomSkillReferenceKeys = new Set([
    ...formData.candidate_skills.map((skill) => normalizeReferenceKey(skill)),
    ...customSkillReferences.map((reference) => normalizeReferenceKey(reference)),
  ]);
  const suggestedCustomSkillReferences = [
    ...(CATEGORY_CUSTOM_SKILL_REFERENCES[formData.category] || []),
    ...DEFAULT_CUSTOM_SKILL_REFERENCES,
  ]
    .filter((reference, index, referenceList) => {
      const normalizedReference = normalizeReferenceKey(reference);

      return (
        normalizedReference &&
        referenceList.findIndex(
          (currentReference) =>
            normalizeReferenceKey(currentReference) === normalizedReference
        ) === index &&
        !occupiedCustomSkillReferenceKeys.has(normalizedReference)
      );
    })
    .slice(0, 6);
  const selectedSkillLabels =
    formData.candidate_custom_skill.trim() && formData.candidate_skills.includes('Keahlian Lainnya')
      ? formData.candidate_skills.map((skill) =>
          skill === 'Keahlian Lainnya' ? `Keahlian Lainnya: ${formData.candidate_custom_skill.trim()}` : skill
        )
      : formData.candidate_skills;
  const provinceOptions = Object.keys(ADDRESS_REGION_OPTIONS);
  const cityOptions = addressFormData.province
    ? Object.keys(ADDRESS_REGION_OPTIONS[addressFormData.province] || {})
    : [];
  const districtOptions =
    addressFormData.province && addressFormData.city
      ? Object.keys(ADDRESS_REGION_OPTIONS[addressFormData.province]?.[addressFormData.city] || {})
      : [];
  const subdistrictOptions =
    addressFormData.province && addressFormData.city && addressFormData.district
      ? ADDRESS_REGION_OPTIONS[addressFormData.province]?.[addressFormData.city]?.[
          addressFormData.district
        ] || []
      : [];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate(APP_ROUTES.landing, { replace: true });
  };

  const handleTopbarSectionNavigate = (section) => {
    navigate(section === 'overview' ? '/recruiter' : `/recruiter#${section}`);
  };

  const clearSubmitFeedback = () => {
    setSubmitError('');
    setSubmitErrorDetails([]);
  };

  const registerFieldRef =
    (...fieldNames) =>
    (node) => {
      fieldNames.forEach((fieldName) => {
        if (node) {
          fieldRefs.current[fieldName] = node;
          return;
        }

        delete fieldRefs.current[fieldName];
      });
    };

  const focusFieldByName = (fieldName) => {
    const targetStep = FIELD_METADATA[fieldName]?.step || currentStep;

    if (targetStep !== currentStep) {
      setCurrentStep(targetStep);
    }

    setPendingFieldNavigation(fieldName);
  };

  const showValidationFeedback = (errors, options = {}) => {
    const details = buildValidationIssueDetails(errors);
    const firstInvalidStep = details[0]?.step;

    setFormErrors(errors);
    setSubmitError(
      details.length === 1
        ? 'Masih ada 1 isian yang belum lengkap. Klik lokasi di bawah untuk langsung menuju field yang bermasalah.'
        : `Masih ada ${details.length} isian yang belum lengkap. Klik lokasi di bawah untuk langsung menuju field yang bermasalah.`
    );
    setSubmitErrorDetails(details);

    if (options.goToFirstInvalidStep && firstInvalidStep && firstInvalidStep !== currentStep) {
      setCurrentStep(firstInvalidStep);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFormError = (fieldName) => {
    setFormErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const handleInputChange = (event) => {
    const { name, type, value, checked } = event.target;
    let nextValue = type === 'checkbox' ? checked : value;

    if (DIGIT_ONLY_FIELDS.has(name)) {
      nextValue = normalizeDigitInput(value);
    }

    setFormData((current) => ({
      ...current,
      [name]: nextValue,
    }));

    clearFormError(name);

    if (name === 'candidate_no_age_limit') {
      clearFormError('candidate_age_min');
      clearFormError('candidate_age_max');
    }

    clearSubmitFeedback();
  };

  const handleMultiSelectToggle = (fieldName, value, limit = 6) => {
    let reachedLimit = false;

    setFormData((current) => {
      const currentValues = Array.isArray(current[fieldName]) ? current[fieldName] : [];

      if (currentValues.includes(value)) {
        const nextValues = currentValues.filter((item) => item !== value);

        return {
          ...current,
          [fieldName]: nextValues,
          ...(fieldName === 'candidate_skills' && value === 'Keahlian Lainnya'
            ? { candidate_custom_skill: '' }
            : {}),
        };
      }

      if (currentValues.length >= limit) {
        reachedLimit = true;
        return current;
      }

      return {
        ...current,
        [fieldName]: [...currentValues, value],
      };
    });

    if (reachedLimit) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [fieldName]: `Maksimal ${limit} pilihan.`,
      }));
      clearSubmitFeedback();
      return;
    }

    clearFormError(fieldName);
    clearSubmitFeedback();
  };

  const handleQuizQuestionToggle = (questionId, limit = 5) => {
    let reachedLimit = false;
    let nextActiveQuestionId = questionId;

    setFormData((current) => {
      const currentValues = Array.isArray(current.quiz_screening_questions)
        ? current.quiz_screening_questions
        : [];

      if (currentValues.includes(questionId)) {
        const nextValues = currentValues.filter((item) => item !== questionId);
        nextActiveQuestionId = nextValues[0] || questionId;

        return {
          ...current,
          quiz_screening_questions: nextValues,
        };
      }

      if (currentValues.length >= limit) {
        reachedLimit = true;
        return current;
      }

      return {
        ...current,
        quiz_screening_questions: [...currentValues, questionId],
      };
    });

    if (reachedLimit) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        quiz_screening_questions: `Maksimal ${limit} pertanyaan screening.`,
      }));
      clearSubmitFeedback();
      return;
    }

    setActiveQuizQuestionId(nextActiveQuestionId);
    clearFormError('quiz_screening_questions');
    clearSubmitFeedback();
  };

  const handleCustomSkillReferencePick = (reference) => {
    setFormData((current) => {
      const currentReferences = splitCustomSkillReferences(current.candidate_custom_skill);

      if (
        currentReferences.some(
          (currentReference) =>
            normalizeReferenceKey(currentReference) === normalizeReferenceKey(reference)
        )
      ) {
        return current;
      }

      return {
        ...current,
        candidate_custom_skill: [...currentReferences, reference].join(', '),
      };
    });

    clearFormError('candidate_custom_skill');
    clearSubmitFeedback();
  };

  const handleAddressSelect = (address) => {
    setFormData((current) => ({
      ...current,
      location: address.label,
    }));
    clearFormError('location');
    clearSubmitFeedback();
    setIsAddressMenuOpen(false);
  };

  const handleAddressModalOpen = () => {
    setEditingAddressId(null);
    setAddressFormData(getInitialAddressForm());
    setAddressFormErrors({});
    setIsAddressMenuOpen(false);
    setIsAddressModalOpen(true);
  };

  const handleAddressModalClose = () => {
    setIsAddressModalOpen(false);
    setEditingAddressId(null);
    setAddressFormData(getInitialAddressForm());
    setAddressFormErrors({});
  };

  const handleAddressEdit = (address) => {
    setEditingAddressId(address.id);
    setAddressFormData({
      type: address.type || 'cabang',
      label: address.label || '',
      province: address.province || '',
      city: address.city || '',
      district: address.district || '',
      subdistrict: address.subdistrict || '',
      postalCode: address.postalCode || '',
      detail: address.detail || '',
    });
    setAddressFormErrors({});
    setIsAddressMenuOpen(false);
    setIsAddressModalOpen(true);
  };

  const handleAddressFormChange = (event) => {
    const { name, value } = event.target;

    setAddressFormData((current) => {
      const nextFormData = {
        ...current,
        [name]: value,
      };

      if (name === 'province') {
        nextFormData.city = '';
        nextFormData.district = '';
        nextFormData.subdistrict = '';
      }

      if (name === 'city') {
        nextFormData.district = '';
        nextFormData.subdistrict = '';
      }

      if (name === 'district') {
        nextFormData.subdistrict = '';
      }

      return nextFormData;
    });

    setAddressFormErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const validateAddressForm = () => {
    const nextErrors = {};

    if (!addressFormData.label.trim()) {
      nextErrors.label = 'Label alamat wajib diisi.';
    }

    if (!addressFormData.province) {
      nextErrors.province = 'Provinsi wajib dipilih.';
    }

    if (!addressFormData.city) {
      nextErrors.city = 'Kota / kabupaten wajib dipilih.';
    }

    if (!addressFormData.district) {
      nextErrors.district = 'Kecamatan wajib dipilih.';
    }

    if (!addressFormData.subdistrict) {
      nextErrors.subdistrict = 'Kelurahan wajib dipilih.';
    }

    if (!addressFormData.detail.trim()) {
      nextErrors.detail = 'Alamat lengkap wajib diisi.';
    }

    return nextErrors;
  };

  const handleAddressSave = (event) => {
    event.preventDefault();

    const nextErrors = validateAddressForm();

    if (Object.keys(nextErrors).length > 0) {
      setAddressFormErrors(nextErrors);
      return;
    }

    const existingAddress = savedAddresses.find((address) => address.id === editingAddressId) || null;
    const nextAddress = createAddressEntry({
      ...addressFormData,
      id: editingAddressId || undefined,
    });

    setSavedAddresses((current) => {
      if (!editingAddressId) {
        return [nextAddress, ...current];
      }

      return current.map((address) => (address.id === editingAddressId ? nextAddress : address));
    });

    setFormData((current) => ({
      ...current,
      location:
        existingAddress && current.location === existingAddress.label
          ? nextAddress.label
          : current.location || nextAddress.label,
    }));
    clearFormError('location');
    clearSubmitFeedback();
    handleAddressModalClose();
  };

  const validateBasicInfoStep = () => {
    const nextErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = 'Judul pekerjaan wajib diisi.';
    }

    if (!formData.category) {
      nextErrors.category = 'Kategori pekerjaan wajib dipilih.';
    }

    if (!formData.description.trim()) {
      nextErrors.description = 'Deskripsi pekerjaan wajib diisi.';
    } else if (formData.description.trim().length < 75) {
      nextErrors.description = 'Deskripsi pekerjaan minimal 75 karakter.';
    }

    if (!formData.job_type) {
      nextErrors.job_type = 'Jenis pekerjaan wajib dipilih.';
    }

    if (!formData.work_mode) {
      nextErrors.work_mode = 'Jenis tempat bekerja wajib dipilih.';
    }

    if (formData.openings_count !== '' && Number(formData.openings_count) < 0) {
      nextErrors.openings_count = 'Jumlah kandidat tidak boleh kurang dari 0.';
    }

    if (!formData.location) {
      nextErrors.location = 'Alamat penempatan wajib dipilih.';
    }

    if (!formData.salary_min) {
      nextErrors.salary_min = 'Gaji minimum wajib diisi.';
    }

    if (!formData.salary_max) {
      nextErrors.salary_max = 'Gaji maksimum wajib diisi.';
    }

    if (
      formData.salary_min &&
      formData.salary_max &&
      Number(formData.salary_max) < Number(formData.salary_min)
    ) {
      nextErrors.salary_max = 'Gaji maksimum harus lebih besar atau sama dengan gaji minimum.';
    }

    if (!formData.experience_level) {
      nextErrors.experience_level = 'Level kandidat wajib dipilih.';
    }

    if (!formData.interview_type) {
      nextErrors.interview_type = 'Tipe wawancara wajib dipilih.';
    }

    if (!formData.expiry_date) {
      nextErrors.expiry_date = 'Tayang hingga wajib diisi.';
    }

    return nextErrors;
  };

  const validateQualificationStep = () => {
    const nextErrors = {};

    if (!formData.candidate_gender) {
      nextErrors.candidate_gender = 'Jenis kelamin kandidat wajib dipilih.';
    }

    if (!formData.candidate_experience) {
      nextErrors.candidate_experience = 'Pengalaman bekerja kandidat wajib dipilih.';
    }

    if (!formData.candidate_education) {
      nextErrors.candidate_education = 'Tingkat pendidikan minimal wajib dipilih.';
    }

    if (!formData.candidate_no_age_limit) {
      if (!formData.candidate_age_min) {
        nextErrors.candidate_age_min = 'Usia minimum wajib diisi.';
      }

      if (!formData.candidate_age_max) {
        nextErrors.candidate_age_max = 'Usia maksimum wajib diisi.';
      }

      if (
        formData.candidate_age_min &&
        formData.candidate_age_max &&
        Number(formData.candidate_age_max) < Number(formData.candidate_age_min)
      ) {
        nextErrors.candidate_age_max = 'Usia maksimum harus lebih besar atau sama dengan usia minimum.';
      }
    }

    if (!formData.candidate_photo_requirement) {
      nextErrors.candidate_photo_requirement = 'Aturan upload foto wajib dipilih.';
    }

    if (!formData.candidate_domicile) {
      nextErrors.candidate_domicile = 'Domisili kandidat wajib dipilih.';
    }

    if (
      formData.candidate_skills.includes('Keahlian Lainnya') &&
      !formData.candidate_custom_skill.trim()
    ) {
      nextErrors.candidate_custom_skill = 'Tuliskan referensi keahlian lainnya.';
    }

    return nextErrors;
  };

  const handleNextStep = () => {
    const nextErrors =
      currentStep === 1
        ? validateBasicInfoStep()
        : currentStep === 2
          ? validateQualificationStep()
          : {};

    if (Object.keys(nextErrors).length > 0) {
      showValidationFeedback(nextErrors);
      return;
    }

    setFormErrors({});
    clearSubmitFeedback();
    setCurrentStep((current) => Math.min(current + 1, FORM_STEP_OPTIONS.length));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviousStep = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearSubmitFeedback();
    setCurrentStep((current) => Math.max(current - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateAllSteps = () => {
    const nextErrors = {
      ...validateBasicInfoStep(),
      ...validateQualificationStep(),
    };

    if (Object.keys(nextErrors).length > 0) {
      showValidationFeedback(nextErrors, { goToFirstInvalidStep: true });
      return false;
    }

    return true;
  };

  const handleJobSubmission = async (publishMode) => {
    if (!validateAllSteps()) {
      return;
    }

    if (publishMode === 'publish' && !companyCompletion.isReady) {
      setSubmitError(
        `Profil company belum siap untuk publish lowongan. Lengkapi dulu: ${companyCompletion.missingRequiredItems.join(', ')}.`
      );
      setSubmitErrorDetails([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    clearSubmitFeedback();

    try {
      const response = await createJob({
        title: formData.title.trim(),
        experience_level: formData.experience_level,
        category: formData.category,
        description: formData.description.trim(),
        salary_min: Number(formData.salary_min),
        salary_max: Number(formData.salary_max),
        location: formData.location,
        job_type: formData.job_type,
        work_mode: formData.work_mode,
        openings_count: formData.openings_count === '' ? 0 : Number(formData.openings_count),
        interview_type: formData.interview_type,
        interview_note: formData.interview_note.trim(),
        video_screening_requirement: formData.video_screening_requirement,
        quiz_screening_questions: buildScreeningQuestionPayload(
          selectedScreeningQuestions,
          customQuizQuestions
        ),
        workflow_status: publishMode === 'publish' ? 'active' : 'draft',
        status: publishMode === 'publish' ? 'active' : 'inactive',
      });

      if (response?.data?.id) {
        saveJobWorkflowStatus(response.data.id, publishMode === 'publish' ? 'active' : 'draft');
      }

      navigate('/recruiter#jobs', {
        state: {
          recruiterNotice:
            publishMode === 'publish'
              ? 'Lowongan berhasil dipublikasikan dan siap menerima kandidat.'
              : 'Lowongan berhasil disimpan sebagai draft.',
        },
      });
    } catch (error) {
      setSubmitError(getCreateJobErrorMessage(error));
      setSubmitErrorDetails([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (currentStep < FORM_STEP_OPTIONS.length) {
      handleNextStep();
      return;
    }

    await handleJobSubmission('publish');
  };

  return (
    <div className="recruiter-job-create-page">
      <RecruiterTopbar
        sections={RECRUITER_SECTION_OPTIONS}
        activeSection="jobs"
        onSectionSelect={handleTopbarSectionNavigate}
        onBrandClick={() => persistRecruiterDashboardState({ activeSection: 'jobs' })}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        user={user}
        companyProfile={companyProfile}
        onPremiumClick={() => handleTopbarSectionNavigate('package')}
      />

      <main className="recruiter-dashboard-shell recruiter-job-create-shell">
        <div className="recruiter-job-create-header">
          <button
            type="button"
            className="recruiter-job-create-back"
            onClick={() => {
              persistRecruiterDashboardState({ activeSection: 'jobs' });
              navigate('/recruiter');
            }}
          >
            <span aria-hidden="true">‹</span>
            Tambah Lowongan Kerja
          </button>
        </div>

        <section className="recruiter-job-create-stepper" aria-label="Tahapan pembuatan lowongan">
          {FORM_STEP_OPTIONS.map((step, index) => (
            <Fragment key={step.number}>
              <div
                className={`recruiter-job-create-step${
                  step.number === currentStep ? ' active' : ''
                }${step.number < currentStep ? ' completed' : ''}`}
                aria-current={step.number === currentStep ? 'step' : undefined}
              >
                <span className="recruiter-job-create-step-index">
                  {step.number < currentStep ? '✓' : step.number}
                </span>
                <span className="recruiter-job-create-step-label">{step.label}</span>
              </div>
              {index < FORM_STEP_OPTIONS.length - 1 && (
                <span className="recruiter-job-create-step-divider" aria-hidden="true" />
              )}
            </Fragment>
          ))}
        </section>

        <div className="recruiter-job-create-note" role="status">
          <span aria-hidden="true">ⓘ</span>
          <p>{currentStepNote}</p>
        </div>

        {!companyCompletion.isReady && (
          <div className="recruiter-job-create-note recruiter-job-create-note-warning" role="status">
            <span aria-hidden="true">!</span>
            <p>
              Profil company belum lengkap untuk publish lowongan. Anda masih bisa menyimpan draft
              sekarang, lalu lengkapi profil company di dashboard recruiter sebelum mempublikasikan.
            </p>
          </div>
        )}

        <section className="recruiter-job-create-layout">
          <button type="button" className="recruiter-service-rail">
            Customer Service
          </button>

          <form className="recruiter-job-create-card" onSubmit={handleSubmit}>
            {submitError && (
              <div className="recruiter-job-create-alert recruiter-job-create-alert-error" role="alert">
                <p className="recruiter-job-create-alert-copy">{submitError}</p>
                {submitErrorDetails.length > 0 && (
                  <div className="recruiter-job-create-alert-detail-list">
                    {submitErrorDetails.map((detail) => (
                      <button
                        key={detail.fieldName}
                        type="button"
                        className="recruiter-job-create-alert-detail"
                        onClick={() => focusFieldByName(detail.fieldName)}
                      >
                        <strong>{detail.stepLabel}</strong>
                        <span>{`${detail.section} • ${detail.label}`}</span>
                        <small>{detail.message}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentStep === 1 ? (
              <>
                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Loker yang ingin Anda pasang</h2>
                    <p>Tuliskan lowongan dan deskripsi pekerjaan yang Anda butuhkan.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <label
                      className="recruiter-job-create-field"
                      ref={registerFieldRef('title')}
                    >
                      <span>Judul Pekerjaan*</span>
                      <input
                        type="text"
                        name="title"
                        placeholder="Ketik judul pekerjaan"
                        value={formData.title}
                        onChange={handleInputChange}
                      />
                      {formErrors.title && <small>{formErrors.title}</small>}
                    </label>

                    <label
                      className="recruiter-job-create-field"
                      ref={registerFieldRef('experience_level')}
                    >
                      <span>Level Kandidat*</span>
                      <select
                        name="experience_level"
                        value={formData.experience_level}
                        onChange={handleInputChange}
                      >
                        <option value="">Pilih level kandidat</option>
                        {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.experience_level && <small>{formErrors.experience_level}</small>}
                    </label>

                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('category')}
                    >
                      <span>Kategori Pekerjaan*</span>
                      <select name="category" value={formData.category} onChange={handleInputChange}>
                        <option value="">Pilih kategori pekerjaan</option>
                        {CATEGORY_OPTIONS.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      {formErrors.category && <small>{formErrors.category}</small>}
                    </label>

                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('description')}
                    >
                      <span>Deskripsi Pekerjaan (minimal 75 karakter)*</span>
                      <textarea
                        name="description"
                        rows="7"
                        placeholder={
                          'Deskripsikan tentang pekerjaan yang harus dilakukan oleh kandidat\n\nContoh:\n1. Membimbing tim operasional harian\n2. Memastikan KPI cabang tercapai\n3. Menjaga komunikasi dengan pelanggan'
                        }
                        value={formData.description}
                        onChange={handleInputChange}
                      />
                      <div className="recruiter-job-create-field-meta">
                        <small>
                          {formErrors.description || 'Jelaskan tugas inti, target, dan ritme kerja.'}
                        </small>
                        <span>{descriptionLength}/75</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Detil Pekerjaan</h2>
                    <p>Lengkapi spesifikasi pekerjaan agar kandidat melihat konteks yang jelas.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <label
                      className="recruiter-job-create-field"
                      ref={registerFieldRef('job_type')}
                    >
                      <span>Jenis Pekerjaan*</span>
                      <select name="job_type" value={formData.job_type} onChange={handleInputChange}>
                        <option value="">Pilih jenis pekerjaan</option>
                        {JOB_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.job_type && <small>{formErrors.job_type}</small>}
                    </label>

                    <label
                      className="recruiter-job-create-field"
                      ref={registerFieldRef('work_mode')}
                    >
                      <span>Jenis Tempat Bekerja*</span>
                      <select name="work_mode" value={formData.work_mode} onChange={handleInputChange}>
                        <option value="">Pilih mode kerja</option>
                        {WORK_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.work_mode && <small>{formErrors.work_mode}</small>}
                    </label>

                    <fieldset className="recruiter-job-create-field recruiter-job-create-field-full recruiter-job-create-radio-group">
                      <legend>Shift Malam</legend>
                      <div className="recruiter-job-create-radio-options">
                        <label className="recruiter-job-create-radio">
                          <input
                            type="radio"
                            name="shift_night"
                            value="no"
                            checked={formData.shift_night === 'no'}
                            onChange={handleInputChange}
                          />
                          <span>Tidak Perlu</span>
                        </label>
                        <label className="recruiter-job-create-radio">
                          <input
                            type="radio"
                            name="shift_night"
                            value="yes"
                            checked={formData.shift_night === 'yes'}
                            onChange={handleInputChange}
                          />
                          <span>Perlu</span>
                        </label>
                      </div>
                    </fieldset>

                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('openings_count')}
                    >
                      <span>Jumlah Kandidat yang Dibutuhkan</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="openings_count"
                        placeholder="0"
                        value={formData.openings_count}
                        onChange={handleInputChange}
                      />
                      <small>
                        {formErrors.openings_count ||
                          'Mulai dari 0 atau biarkan kosong bila kebutuhan kandidat belum ditentukan.'}
                      </small>
                    </label>

                    <div
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('location')}
                    >
                      <div className="recruiter-job-create-field-inline">
                        <span>Alamat Penempatan*</span>
                        <button
                          type="button"
                          className="recruiter-job-create-inline-link"
                          onClick={handleAddressModalOpen}
                        >
                          + Tambah Alamat
                        </button>
                      </div>

                      <div
                        className={`recruiter-job-create-address-picker${
                          isAddressMenuOpen ? ' is-open' : ''
                        }`}
                        ref={addressSelectorRef}
                      >
                        <button
                          type="button"
                          className="recruiter-job-create-address-trigger"
                          onClick={() => setIsAddressMenuOpen((current) => !current)}
                        >
                          <span>{selectedAddress?.label || 'Pilih area penempatan'}</span>
                          <span
                            className="recruiter-job-create-address-trigger-icon"
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        </button>

                        {isAddressMenuOpen && (
                          <div className="recruiter-job-create-address-menu">
                            {savedAddresses.map((address) => (
                              <div
                                key={address.id}
                                className={`recruiter-job-create-address-option${
                                  formData.location === address.label ? ' active' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className="recruiter-job-create-address-option-main"
                                  onClick={() => handleAddressSelect(address)}
                                >
                                  <strong>{address.label}</strong>
                                  <span>{address.summary}</span>
                                </button>
                                <button
                                  type="button"
                                  className="recruiter-job-create-address-edit"
                                  onClick={() => handleAddressEdit(address)}
                                >
                                  Edit Alamat
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {selectedAddress && (
                        <p className="recruiter-job-create-address-summary">{selectedAddress.summary}</p>
                      )}
                      {formErrors.location && <small>{formErrors.location}</small>}
                    </div>

                    <div className="recruiter-job-create-field recruiter-job-create-field-full">
                      <span>Gaji Bulanan*</span>
                      <div className="recruiter-job-create-salary-grid">
                        <label
                          className={`recruiter-job-create-salary-input${
                            formErrors.salary_min ? ' has-error' : ''
                          }`}
                          ref={registerFieldRef('salary_min')}
                        >
                          <span className="recruiter-sr-only">Gaji Bulanan Minimum</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="salary_min"
                            placeholder="Rp. 4.500.000"
                            value={formatNumericFieldValue(formData.salary_min)}
                            onChange={handleInputChange}
                            aria-label="Gaji Bulanan Minimum"
                          />
                          <small>{formErrors.salary_min || 'Masukkan gaji minimal'}</small>
                        </label>

                        <span className="recruiter-job-create-salary-separator" aria-hidden="true">
                          -
                        </span>

                        <label
                          className={`recruiter-job-create-salary-input${
                            formErrors.salary_max ? ' has-error' : ''
                          }`}
                          ref={registerFieldRef('salary_max')}
                        >
                          <span className="recruiter-sr-only">Gaji Bulanan Maksimum</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="salary_max"
                            placeholder="Rp. 5.000.000"
                            value={formatNumericFieldValue(formData.salary_max)}
                            onChange={handleInputChange}
                            aria-label="Gaji Bulanan Maksimum"
                          />
                          <small>{formErrors.salary_max || 'Masukkan gaji maksimal'}</small>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Informasi wawancara</h2>
                    <p>Beritahu kandidat mengenai persiapan wawancara dan format seleksi awal.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('interview_type')}
                    >
                      <span>Tipe Wawancara*</span>
                      <select
                        name="interview_type"
                        value={formData.interview_type}
                        onChange={handleInputChange}
                      >
                        <option value="">Pilih tipe wawancara</option>
                        {INTERVIEW_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.interview_type && <small>{formErrors.interview_type}</small>}
                    </label>

                    <label className="recruiter-job-create-field recruiter-job-create-field-full">
                      <span>Catatan untuk Kandidat</span>
                      <textarea
                        name="interview_note"
                        rows="4"
                        placeholder="Contoh: Kandidat diminta menyiapkan CV terbaru, datang 15 menit lebih awal, dan mengenakan pakaian rapi."
                        value={formData.interview_note}
                        onChange={handleInputChange}
                      />
                    </label>
                  </div>
                </div>

                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Jangka waktu penayangan loker</h2>
                    <p>Atur batas tayang lowongan agar proses hiring tetap terukur.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('expiry_date')}
                    >
                      <span>Tayang Hingga*</span>
                      <input
                        type="date"
                        min={minimumExpiryDate}
                        name="expiry_date"
                        value={formData.expiry_date}
                        onChange={handleInputChange}
                      />
                      {formErrors.expiry_date && <small>{formErrors.expiry_date}</small>}
                    </label>
                  </div>
                </div>

                <div className="recruiter-job-create-actions recruiter-job-create-actions-split">
                  <button
                    type="button"
                    className="recruiter-job-create-secondary"
                    formNoValidate
                    onClick={handlePreviousStep}
                  >
                    Kembali
                  </button>
                  <button type="submit" className="recruiter-create-job-button" disabled={isLoading}>
                    Selanjutnya
                  </button>
                </div>
              </>
            ) : currentStep === 2 ? (
              <>
                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Kriteria Kandidat</h2>
                    <p>Tentukan kriteria profil kandidat yang Anda inginkan.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <fieldset
                      className="recruiter-job-create-field recruiter-job-create-field-full recruiter-job-create-radio-group"
                      ref={registerFieldRef('candidate_gender')}
                    >
                      <legend>Jenis Kelamin*</legend>
                      <div className="recruiter-job-create-radio-options recruiter-job-create-radio-options-three">
                        {GENDER_OPTIONS.map((option) => (
                          <label key={option.value} className="recruiter-job-create-radio">
                            <input
                              type="radio"
                              name="candidate_gender"
                              value={option.value}
                              checked={formData.candidate_gender === option.value}
                              onChange={handleInputChange}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                      {formErrors.candidate_gender && <small>{formErrors.candidate_gender}</small>}
                    </fieldset>

                    <fieldset
                      className="recruiter-job-create-field recruiter-job-create-field-full recruiter-job-create-radio-group"
                      ref={registerFieldRef('candidate_experience')}
                    >
                      <legend>Pengalaman Bekerja*</legend>
                      <div className="recruiter-job-create-radio-options">
                        {CANDIDATE_EXPERIENCE_OPTIONS.map((option) => (
                          <label key={option.value} className="recruiter-job-create-radio">
                            <input
                              type="radio"
                              name="candidate_experience"
                              value={option.value}
                              checked={formData.candidate_experience === option.value}
                              onChange={handleInputChange}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                      {formErrors.candidate_experience && (
                        <small>{formErrors.candidate_experience}</small>
                      )}
                    </fieldset>

                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('candidate_education')}
                    >
                      <span>Tingkat Pendidikan Minimal*</span>
                      <select
                        name="candidate_education"
                        value={formData.candidate_education}
                        onChange={handleInputChange}
                      >
                        <option value="">Pilih tingkat pendidikan</option>
                        {EDUCATION_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {formErrors.candidate_education && <small>{formErrors.candidate_education}</small>}
                    </label>

                    <div
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('candidate_age_min', 'candidate_age_max')}
                    >
                      <span>Usia (tahun)*</span>
                      <div className="recruiter-job-create-age-grid">
                        <input
                          type="number"
                          min="17"
                          name="candidate_age_min"
                          value={formData.candidate_age_min}
                          onChange={handleInputChange}
                          placeholder="17"
                          disabled={formData.candidate_no_age_limit}
                          aria-label="Usia minimum kandidat"
                        />
                        <input
                          type="number"
                          min="17"
                          name="candidate_age_max"
                          value={formData.candidate_age_max}
                          onChange={handleInputChange}
                          placeholder="60"
                          disabled={formData.candidate_no_age_limit}
                          aria-label="Usia maksimum kandidat"
                        />
                      </div>
                      <label className="recruiter-job-create-checkbox">
                        <input
                          type="checkbox"
                          name="candidate_no_age_limit"
                          checked={formData.candidate_no_age_limit}
                          onChange={handleInputChange}
                        />
                        <span>Tidak ada batasan usia</span>
                      </label>
                      {(formErrors.candidate_age_min || formErrors.candidate_age_max) && (
                        <small>{formErrors.candidate_age_min || formErrors.candidate_age_max}</small>
                      )}
                    </div>

                    <fieldset
                      className="recruiter-job-create-field recruiter-job-create-field-full recruiter-job-create-radio-group"
                      ref={registerFieldRef('candidate_photo_requirement')}
                    >
                      <legend>Upload Foto (berpenampilan menarik)*</legend>
                      <div className="recruiter-job-create-radio-options">
                        {PHOTO_REQUIREMENT_OPTIONS.map((option) => (
                          <label key={option.value} className="recruiter-job-create-radio">
                            <input
                              type="radio"
                              name="candidate_photo_requirement"
                              value={option.value}
                              checked={formData.candidate_photo_requirement === option.value}
                              onChange={handleInputChange}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                      {formErrors.candidate_photo_requirement && (
                        <small>{formErrors.candidate_photo_requirement}</small>
                      )}
                    </fieldset>
                  </div>
                </div>

                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Lokasi Kandidat</h2>
                    <p>Tentukan preferensi domisili kandidat.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <label
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('candidate_domicile')}
                    >
                      <span>Domisili Kandidat*</span>
                      <select
                        name="candidate_domicile"
                        value={formData.candidate_domicile}
                        onChange={handleInputChange}
                      >
                        <option value="">Pilih domisili kandidat</option>
                        {candidateDomicileOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.candidate_domicile && <small>{formErrors.candidate_domicile}</small>}
                    </label>
                  </div>
                </div>

                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Keahlian yang dibutuhkan (opsional)</h2>
                    <p>Pilih keahlian yang Anda harapkan dimiliki kandidat.</p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <div
                      className="recruiter-job-create-field recruiter-job-create-field-full"
                      ref={registerFieldRef('candidate_skills')}
                    >
                      <span>Jenis Keahlian (maksimal 6)</span>
                      <div className="recruiter-job-create-chip-group">
                        {SKILL_OPTIONS.map((option) => {
                          const isSelected = formData.candidate_skills.includes(option);

                          return (
                            <button
                              key={option}
                              type="button"
                              className={`recruiter-job-create-chip${isSelected ? ' is-selected' : ''}`}
                              onClick={() => handleMultiSelectToggle('candidate_skills', option)}
                            >
                              <span className="recruiter-job-create-chip-icon" aria-hidden="true">
                                {isSelected ? '✓' : '+'}
                              </span>
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>
                      <small className="recruiter-job-create-chip-helper">
                        {formErrors.candidate_skills ||
                          `${formData.candidate_skills.length}/6 keahlian dipilih`}
                      </small>
                    </div>

                    {formData.candidate_skills.includes('Keahlian Lainnya') && (
                      <label
                        className="recruiter-job-create-field recruiter-job-create-field-full"
                        ref={registerFieldRef('candidate_custom_skill')}
                      >
                        <span>Referensi Keahlian Lainnya</span>
                        <input
                          type="text"
                          name="candidate_custom_skill"
                          placeholder="Contoh: HACCP, Microsoft Excel lanjutan, atau leadership"
                          value={formData.candidate_custom_skill}
                          onChange={handleInputChange}
                        />
                        <small>
                          {formErrors.candidate_custom_skill ||
                            'Tulis keahlian spesifik yang ingin dijadikan referensi tambahan.'}
                        </small>

                        {customSkillReferences.length > 0 && (
                          <div className="recruiter-job-create-reference-block">
                            <span className="recruiter-job-create-reference-label">
                              Referensi tersimpan
                            </span>
                            <div className="recruiter-job-create-reference-list">
                              {customSkillReferences.map((reference) => (
                                <span
                                  key={reference}
                                  className="recruiter-job-create-reference-pill"
                                >
                                  {reference}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {suggestedCustomSkillReferences.length > 0 && (
                          <div className="recruiter-job-create-reference-block">
                            <span className="recruiter-job-create-reference-label">
                              Referensi otomatis
                            </span>
                            <div className="recruiter-job-create-reference-list">
                              {suggestedCustomSkillReferences.map((reference) => (
                                <button
                                  key={reference}
                                  type="button"
                                  className="recruiter-job-create-reference-suggestion"
                                  onClick={() => handleCustomSkillReferencePick(reference)}
                                >
                                  + {reference}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </label>
                    )}
                  </div>
                </div>

                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Pemberitahuan ke pelamar</h2>
                    <p>
                      Atur informasi video skrining yang akan muncul di sisi pelamar saat mereka
                      menyiapkan berkas lamaran.
                    </p>
                  </div>

                  <div className="recruiter-job-create-fields">
                    <fieldset
                      className="recruiter-job-create-field recruiter-job-create-field-full recruiter-job-create-radio-group"
                      ref={registerFieldRef('video_screening_requirement')}
                    >
                      <legend>Video Skrining</legend>
                      <div className="recruiter-job-create-radio-options">
                        {VIDEO_SCREENING_OPTIONS.map((option) => (
                          <label key={option.value} className="recruiter-job-create-radio">
                            <input
                              type="radio"
                              name="video_screening_requirement"
                              value={option.value}
                              checked={formData.video_screening_requirement === option.value}
                              onChange={handleInputChange}
                            />
                            <span>
                              {option.label}
                              <small className="recruiter-job-create-radio-note">
                                {option.description}
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                      <small className="recruiter-job-create-chip-helper">
                        {formData.video_screening_requirement === 'required'
                          ? 'Label "Video Identitas Wajib" akan muncul di sisi pelamar.'
                          : 'Tidak ada label tambahan yang tampil di lowongan bila video skrining tidak diwajibkan.'}
                      </small>
                    </fieldset>
                  </div>
                </div>

                <div className="recruiter-job-create-actions recruiter-job-create-actions-split">
                  <button
                    type="button"
                    className="recruiter-job-create-secondary"
                    formNoValidate
                    onClick={handlePreviousStep}
                  >
                    Kembali
                  </button>
                  <button type="submit" className="recruiter-create-job-button" disabled={isLoading}>
                    Selanjutnya
                  </button>
                </div>
              </>
            ) : currentStep === 3 ? (
              <>
                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Kuis</h2>
                    <p>Buat pertanyaan yang sesuai dengan kebutuhan Anda untuk menyaring kandidat.</p>
                  </div>

                  <div className="recruiter-job-create-fields recruiter-job-create-quiz-grid">
                    <div className="recruiter-job-create-quiz-preview-panel">
                      <div className="recruiter-job-create-quiz-copy">
                        <span>Tanyakan kandidat tentang kualifikasi mereka (opsional)</span>
                        <p>Gunakan pertanyaan untuk menentukan kandidat terbaik.</p>
                      </div>

                      <div className="recruiter-job-create-phone-preview">
                        <div className="recruiter-job-create-phone-shell">
                          <div className="recruiter-job-create-phone-notch" />
                          <div className="recruiter-job-create-phone-screen">
                            <div className="recruiter-job-create-phone-header">
                              <strong>Kuis</strong>
                              <span>{formData.title || 'Lowongan Baru'}</span>
                            </div>

                            <div className="recruiter-job-create-phone-step">
                              <span>1 dari 5</span>
                              <div className="recruiter-job-create-phone-step-bar">
                                <span />
                              </div>
                            </div>

                            <div className="recruiter-job-create-phone-question">
                              <p>{activeQuizQuestion.question}</p>
                              <span>Pilih salah satu jawaban</span>
                            </div>

                            <div className="recruiter-job-create-phone-options">
                              {activeQuizQuestion.answers.map((answer, index) => (
                                <div
                                  key={answer}
                                  className={`recruiter-job-create-phone-option${
                                    index === 0 ? ' is-highlighted' : ''
                                  }`}
                                >
                                  <span className="recruiter-job-create-phone-option-dot" />
                                  <span>{answer}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="recruiter-job-create-quiz-panel">
                      <div
                        className="recruiter-job-create-field recruiter-job-create-field-full"
                        ref={registerFieldRef('quiz_screening_questions')}
                      >
                        <span>Pertanyaan Skrining</span>
                        <div className="recruiter-job-create-chip-group recruiter-job-create-quiz-chip-group">
                          {QUIZ_SCREENING_QUESTIONS.map((question) => {
                            const isSelected = selectedScreeningQuestionIds.includes(question.id);

                            return (
                              <button
                                key={question.id}
                                type="button"
                                className={`recruiter-job-create-chip recruiter-job-create-quiz-chip${
                                  isSelected ? ' is-selected' : ''
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    setActiveQuizQuestionId(question.id);
                                    return;
                                  }

                                  handleQuizQuestionToggle(question.id);
                                }}
                              >
                                <span className="recruiter-job-create-chip-icon" aria-hidden="true">
                                  {isSelected ? '✓' : '+'}
                                </span>
                                <span>{question.label}</span>
                              </button>
                            );
                          })}

                          <div className="recruiter-job-create-chip recruiter-job-create-quiz-chip recruiter-job-create-quiz-chip-custom">
                            <span className="recruiter-job-create-chip-icon" aria-hidden="true">
                              ⊕
                            </span>
                            <span>{`Pertanyaan Custom (${customQuizQuestions.length})`}</span>
                          </div>
                        </div>
                        <small className="recruiter-job-create-chip-helper">
                          {formErrors.quiz_screening_questions ||
                            'Demi menjaga kandidat potensial tetap termotivasi, kami membatasi jumlah pertanyaan hingga 5 pertanyaan.'}
                        </small>

                        {selectedScreeningQuestions.length > 0 && (
                          <div className="recruiter-job-create-quiz-selected-list">
                            {selectedScreeningQuestions.map((question, index) => (
                              <button
                                key={question.id}
                                type="button"
                                className={`recruiter-job-create-quiz-selected-item${
                                  resolvedActiveQuizQuestionId === question.id ? ' is-active' : ''
                                }`}
                                onClick={() => setActiveQuizQuestionId(question.id)}
                              >
                                <strong>{`${index + 1}. ${question.label}`}</strong>
                                <span>{question.question}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="recruiter-job-create-quiz-detail-card">
                        <h3>{activeQuizQuestion.title}</h3>
                        <p>{activeQuizQuestion.description}</p>

                        <div className="recruiter-job-create-quiz-detail-block">
                          <span>Pertanyaan</span>
                          <strong>{activeQuizQuestion.question}</strong>
                        </div>

                        <div className="recruiter-job-create-quiz-detail-block">
                          <span>Jawaban yang benar</span>
                          <div className="recruiter-job-create-quiz-answer-list">
                            {activeQuizQuestion.answers.map((answer, index) => (
                              <label
                                key={answer}
                                className={`recruiter-job-create-quiz-answer${
                                  index === 0 ? ' is-recommended' : ''
                                }`}
                              >
                                <input type="radio" checked={index === 0} readOnly />
                                <span>{answer}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="recruiter-job-create-field recruiter-job-create-field-full recruiter-job-create-quiz-custom-fields">
                        <span>Pertanyaan Custom</span>
                        <textarea
                          name="quiz_question_1"
                          rows="3"
                          placeholder="Contoh: Mengapa Anda tertarik melamar posisi ini?"
                          value={formData.quiz_question_1}
                          onChange={handleInputChange}
                        />
                        <textarea
                          name="quiz_question_2"
                          rows="3"
                          placeholder="Contoh: Ceritakan pengalaman yang paling relevan dengan pekerjaan ini."
                          value={formData.quiz_question_2}
                          onChange={handleInputChange}
                        />
                        <textarea
                          name="quiz_question_3"
                          rows="3"
                          placeholder="Contoh: Kapan Anda siap mulai bekerja?"
                          value={formData.quiz_question_3}
                          onChange={handleInputChange}
                        />
                        <small>Tambahkan pertanyaan custom bila Anda butuh filter tambahan.</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="recruiter-job-create-actions">
                  <button type="submit" className="recruiter-create-job-button" disabled={isLoading}>
                    Selanjutnya
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="recruiter-job-create-section">
                  <div className="recruiter-job-create-section-copy">
                    <h2>Preview dan Pengaturan</h2>
                    <p>Periksa kembali detail lowongan sebelum dipublikasikan.</p>
                  </div>

                  <div className="recruiter-job-create-fields recruiter-job-create-summary-grid">
                    <div className="recruiter-job-create-summary-card">
                      <strong>Judul Lowongan</strong>
                      <span>{formData.title || '-'}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Kategori</strong>
                      <span>{formData.category || '-'}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Level Kandidat</strong>
                      <span>{selectedExperienceLevelLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Lokasi Penempatan</strong>
                      <span>{formData.location || '-'}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Rentang Gaji</strong>
                      <span>
                        {`${formatCurrency(formData.salary_min)} - ${formatCurrency(formData.salary_max)}`}
                      </span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Tayang Hingga</strong>
                      <span>{formData.expiry_date || '-'}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Mode Kerja</strong>
                      <span>{selectedWorkModeLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Tipe Wawancara</strong>
                      <span>{selectedInterviewTypeLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Jumlah Kandidat</strong>
                      <span>{formData.openings_count === '' ? 'Belum ditentukan' : formData.openings_count}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Jenis Kelamin</strong>
                      <span>{selectedGenderLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Pengalaman Bekerja</strong>
                      <span>{selectedExperienceLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Domisili Kandidat</strong>
                      <span>{selectedDomicileLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card">
                      <strong>Upload Foto</strong>
                      <span>{selectedPhotoRequirementLabel}</span>
                    </div>
                    <div className="recruiter-job-create-summary-card recruiter-job-create-summary-card-full">
                      <strong>Keahlian</strong>
                      <span>
                        {selectedSkillLabels.length > 0
                          ? selectedSkillLabels.join(', ')
                          : 'Tidak ada keahlian khusus.'}
                      </span>
                    </div>
                    <div className="recruiter-job-create-summary-card recruiter-job-create-summary-card-full">
                      <strong>Video Skrining</strong>
                      <span>
                        {formatVideoScreeningRequirement(formData.video_screening_requirement) ||
                          'Tidak wajib / tidak menampilkan label tambahan.'}
                      </span>
                    </div>
                    <div className="recruiter-job-create-summary-card recruiter-job-create-summary-card-full">
                      <strong>Pertanyaan Screening</strong>
                      <span>
                        {selectedScreeningQuestionLabels.length > 0
                          ? selectedScreeningQuestionLabels.join(', ')
                          : 'Tidak ada pertanyaan screening terpilih.'}
                      </span>
                    </div>
                    <div className="recruiter-job-create-summary-card recruiter-job-create-summary-card-full">
                      <strong>Kuis</strong>
                      <span>
                        {customQuizQuestions.join(' | ') || 'Belum ada pertanyaan custom.'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="recruiter-job-create-actions recruiter-job-create-actions-split">
                  <button
                    type="button"
                    className="recruiter-job-create-secondary"
                    formNoValidate
                    onClick={handlePreviousStep}
                  >
                    Kembali
                  </button>
                  <div className="recruiter-job-create-final-actions">
                    <button
                      type="button"
                      className="recruiter-job-create-secondary"
                      onClick={() => handleJobSubmission('draft')}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Menyimpan...' : 'Simpan Draft'}
                    </button>
                    <button
                      type="button"
                      className="recruiter-create-job-button"
                      onClick={() => handleJobSubmission('publish')}
                      disabled={isLoading || !companyCompletion.isReady}
                    >
                      {isLoading ? 'Memasang...' : 'Publikasikan Lowongan'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </section>

        {isAddressModalOpen && (
          <div
            className="recruiter-job-create-modal-backdrop"
            role="presentation"
            onClick={handleAddressModalClose}
          >
            <section
              className="recruiter-job-create-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recruiter-address-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="recruiter-job-create-modal-header">
                <h2 id="recruiter-address-modal-title">
                  {editingAddressId ? 'Edit Alamat' : 'Tambah Alamat'}
                </h2>
                <button
                  type="button"
                  className="recruiter-job-create-modal-close"
                  onClick={handleAddressModalClose}
                  aria-label="Tutup modal alamat"
                >
                  ×
                </button>
              </header>

              <form className="recruiter-job-create-modal-body" onSubmit={handleAddressSave}>
                <fieldset className="recruiter-job-create-field recruiter-job-create-modal-radio-group">
                  <legend>Tipe Lokasi</legend>
                  <div className="recruiter-job-create-modal-radio-options">
                    <label className="recruiter-job-create-modal-radio">
                      <input
                        type="radio"
                        name="type"
                        value="pusat"
                        checked={addressFormData.type === 'pusat'}
                        onChange={handleAddressFormChange}
                      />
                      <span>Pusat</span>
                    </label>
                    <label className="recruiter-job-create-modal-radio">
                      <input
                        type="radio"
                        name="type"
                        value="cabang"
                        checked={addressFormData.type === 'cabang'}
                        onChange={handleAddressFormChange}
                      />
                      <span>Cabang</span>
                    </label>
                  </div>
                </fieldset>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Label Alamat*</span>
                  <input
                    type="text"
                    name="label"
                    placeholder="Contoh: Head Office Kemayoran"
                    value={addressFormData.label}
                    onChange={handleAddressFormChange}
                  />
                  {addressFormErrors.label && <small>{addressFormErrors.label}</small>}
                </label>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Provinsi*</span>
                  <select
                    name="province"
                    value={addressFormData.province}
                    onChange={handleAddressFormChange}
                  >
                    <option value="">Pilih provinsi</option>
                    {provinceOptions.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                  {addressFormErrors.province && <small>{addressFormErrors.province}</small>}
                </label>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Kota/Kabupaten*</span>
                  <select name="city" value={addressFormData.city} onChange={handleAddressFormChange}>
                    <option value="">Pilih kota/kabupaten</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  {addressFormErrors.city && <small>{addressFormErrors.city}</small>}
                </label>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Kecamatan*</span>
                  <select
                    name="district"
                    value={addressFormData.district}
                    onChange={handleAddressFormChange}
                  >
                    <option value="">Pilih kecamatan</option>
                    {districtOptions.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                  {addressFormErrors.district && <small>{addressFormErrors.district}</small>}
                </label>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Kelurahan*</span>
                  <select
                    name="subdistrict"
                    value={addressFormData.subdistrict}
                    onChange={handleAddressFormChange}
                  >
                    <option value="">Pilih kelurahan</option>
                    {subdistrictOptions.map((subdistrict) => (
                      <option key={subdistrict} value={subdistrict}>
                        {subdistrict}
                      </option>
                    ))}
                  </select>
                  {addressFormErrors.subdistrict && <small>{addressFormErrors.subdistrict}</small>}
                </label>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Kode Pos</span>
                  <input
                    type="text"
                    name="postalCode"
                    placeholder="Contoh: 15910"
                    value={addressFormData.postalCode}
                    onChange={handleAddressFormChange}
                  />
                </label>

                <label className="recruiter-job-create-field recruiter-job-create-field-full">
                  <span>Alamat Lengkap (nama jalan, gedung, lantai, dll)*</span>
                  <textarea
                    name="detail"
                    rows="4"
                    maxLength="200"
                    value={addressFormData.detail}
                    onChange={handleAddressFormChange}
                  />
                  <div className="recruiter-job-create-field-meta">
                    <small>{addressFormErrors.detail || 'Tuliskan alamat yang terlihat jelas oleh kandidat.'}</small>
                    <span>{addressDetailLength}/200</span>
                  </div>
                </label>

                <div className="recruiter-job-create-modal-actions">
                  <button
                    type="button"
                    className="recruiter-job-create-secondary"
                    onClick={handleAddressModalClose}
                  >
                    Batal
                  </button>
                  <button type="submit" className="recruiter-job-create-modal-submit">
                    {editingAddressId ? 'Simpan' : 'Tambah'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default RecruiterJobCreatePage;
