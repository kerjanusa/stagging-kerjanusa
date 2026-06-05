import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import InboxWorkspace from '../components/InboxWorkspace.jsx';
import MonitoringIndonesiaMap from '../components/MonitoringIndonesiaMap.jsx';
import { getLocationCoordinates } from '../data/locationCoordinates.js';
import useAuth from '../hooks/useAuth.js';
import useChat from '../hooks/useChat.js';
import AdminService from '../services/adminService.js';
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/adminDashboard.css';
import '../styles/workspace.css';

const SECTION_OPTIONS = [
  { value: 'monitoring', label: 'Monitoring', title: 'Pusat Kontrol KerjaNusa', shortTitle: 'Monitoring', icon: 'monitor' },
  { value: 'pelamar', label: 'Pelamar', title: 'Manajemen Pelamar', shortTitle: 'Pelamar', icon: 'candidate' },
  { value: 'recruiter', label: 'Recruiter', title: 'Recruiter Directory', shortTitle: 'Recruiter', icon: 'recruiter' },
  { value: 'lowongan', label: 'Lowongan', title: 'Manajemen Lowongan', shortTitle: 'Lowongan', icon: 'job' },
  { value: 'analytics', label: 'Analytics', title: 'Analytics & Reporting', shortTitle: 'Analytics', icon: 'analytics' },
  { value: 'moderation', label: 'Moderasi', title: 'Moderasi Konten', shortTitle: 'Moderasi', icon: 'moderation' },
  { value: 'messages', label: 'Chat', title: 'Inbox Superadmin', shortTitle: 'Chat', icon: 'message' },
];

const MODERATION_TABS = [
  { value: 'all', label: 'Semua Antrian' },
  { value: 'job', label: 'Lowongan' },
  { value: 'account', label: 'Akun' },
];
const PAGE_SIZE = 5;

const numberFormatter = new Intl.NumberFormat('id-ID');

/**
 * Mengubah hash URL dashboard menjadi nama section yang valid untuk UI admin.
 */
const resolveSectionFromHash = (hash) => {
  const normalizedHash = hash.replace(/^#/, '');
  const normalizedValue = normalizedHash === 'moderasi' ? 'moderation' : normalizedHash;

  if (SECTION_OPTIONS.some((section) => section.value === normalizedValue)) {
    return normalizedValue;
  }

  return 'monitoring';
};

/**
 * Membangun URL section admin agar navigasi hash tetap konsisten dari satu helper.
 */
const getSectionRoute = (section) =>
  section === 'monitoring'
    ? APP_ROUTES.adminDashboard
    : `${APP_ROUTES.adminDashboard}#${section === 'moderation' ? 'moderasi' : section}`;

/**
 * Memformat timestamp lengkap untuk kartu, tabel, dan panel monitoring admin.
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
 * Memformat tanggal singkat yang dipakai di daftar dan metadata admin.
 */
const formatDateShort = (value) => {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

/**
 * Membuat label hari singkat untuk grafik 7 hari terakhir.
 */
const formatDayLabel = (value) => {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '-';
  }
};

/**
 * Menyingkat angka besar ke format ribuan atau jutaan agar kartu metric tetap ringkas.
 */
const formatCompactNumber = (value = 0) => {
  const numericValue = Number(value || 0);

  if (numericValue >= 1000000) {
    return `${(numericValue / 1000000).toFixed(1)}jt`;
  }

  if (numericValue >= 1000) {
    return `${(numericValue / 1000).toFixed(1)}k`;
  }

  return numberFormatter.format(numericValue);
};

/**
 * Mengubah nilai numerik menjadi persentase dengan satu digit desimal.
 */
const formatPercentage = (value = 0) => `${Number(value || 0).toFixed(1)}%`;

/**
 * Membuat inisial dua huruf sebagai fallback avatar admin list.
 */
const getInitials = (value = '') =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'SA';

/**
 * Mengunduh data tabular sederhana sebagai CSV dari browser tanpa roundtrip backend.
 */
const downloadCsv = (filename, rows) => {
  if (typeof window === 'undefined' || !Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Menormalkan teks pencarian agar filter admin lebih tahan terhadap variasi input.
 */
const normalizeText = (value = '') => String(value || '').trim().toLowerCase();

/**
 * Memastikan lokasi monitoring punya nilai yang layak dipetakan ke marker Indonesia.
 */
const isMappableMonitoringLocation = (value = '') => {
  const normalizedValue = normalizeText(value);

  return (
    Boolean(normalizedValue) &&
    normalizedValue !== 'remote' &&
    !normalizedValue.startsWith('lokasi belum')
  );
};

/**
 * Merapikan label lokasi monitoring sebelum dikirim ke layer peta.
 */
const getMonitoringLocationLabel = (value = '') => String(value || '').trim();

/**
 * Mengelompokkan timestamp mentah ke bucket tujuh hari terakhir untuk analitik ringan.
 */
const buildLast7DaySeries = (items = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);

    return {
      key: date.toISOString().slice(0, 10),
      label: formatDayLabel(date),
      value: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  items.forEach((item) => {
    if (!item) {
      return;
    }

    const date = new Date(item);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    date.setHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.value += 1;
    }
  });

  return buckets;
};

/**
 * Membangun path SVG line chart dari data analitik harian.
 */
const createAnalyticsLinePath = (points, width = 640, height = 260, padding = 22) => {
  if (!points.length) {
    return '';
  }

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, 1);
  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);
  const usableHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + index * xStep;
      const y = height - padding - (point.value / maxValue) * usableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

/**
 * Membuat badge pertumbuhan positif atau negatif untuk kartu insight admin.
 */
const getGrowthBadge = (value, positivePrefix = '+') => {
  const numericValue = Number(value || 0);
  const isPositive = numericValue >= 0;

  return {
    label: `${isPositive ? positivePrefix : ''}${numericValue.toFixed(1)}%`,
    tone: isPositive ? 'positive' : 'negative',
  };
};

/**
 * Menghitung persentase progres aman dengan pembatasan 0 sampai 100.
 */
const getProgressValue = (value = 0, total = 0) => {
  const safeTotal = Number(total || 0);

  if (safeTotal <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(((Number(value || 0) / safeTotal) * 100).toFixed(1))));
};

/**
 * Menghitung jumlah halaman pagination dari total item yang tersedia.
 */
const getTotalPages = (totalItems, pageSize = PAGE_SIZE) =>
  Math.max(1, Math.ceil(Number(totalItems || 0) / pageSize));

/**
 * Menyusun daftar tombol pagination yang padat dengan ellipsis bila halaman terlalu banyak.
 */
const buildPaginationItems = (page, totalPages) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis-right', totalPages];
};

/**
 * Menghitung umur data dalam satuan hari untuk badge freshness dan moderation.
 */
const getAgeInDays = (value) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
};

/**
 * Mengubah status akun backend menjadi label singkat untuk tabel admin.
 */
const formatAccountStatus = (status) => {
  switch (status) {
    case 'suspended':
      return 'Nonaktif';
    case 'active':
    default:
      return 'Aktif';
  }
};

/**
 * Menerjemahkan stage lamaran backend menjadi label yang dibaca tim admin.
 */
const formatApplicationStage = (stage) => {
  switch (stage) {
    case 'reviewing':
      return 'Sedang Direview';
    case 'shortlisted':
      return 'Shortlist';
    case 'interview':
      return 'Interview';
    case 'offered':
      return 'Offer';
    case 'hired':
      return 'Diterima';
    case 'rejected':
      return 'Ditolak';
    case 'withdrawn':
      return 'Dibatalkan';
    case 'applied':
    default:
      return 'Baru Masuk';
  }
};

/**
 * Menentukan label status lowongan gabungan dari workflow recruiter dan status backend.
 */
const formatJobStatus = (job) => {
  if (job?.workflow_status === 'active' && job?.status === 'active') {
    return 'Aktif';
  }

  if (job?.workflow_status === 'filled') {
    return 'Closed (Filled)';
  }

  if (job?.workflow_status === 'closed') {
    return 'Closed';
  }

  if (job?.workflow_status === 'paused' || job?.status === 'inactive') {
    return 'Pause';
  }

  return 'Review';
};

/**
 * Menyusun tone status kandidat untuk badge moderasi dan directory admin.
 */
const getCandidateAdminStatus = (candidate) => {
  if (candidate.account_status === 'suspended') {
    return {
      key: 'blocked',
      label: 'Diblokir',
      tone: 'blocked',
    };
  }

  if (!candidate.profile_ready) {
    return {
      key: 'review',
      label: 'Menunggu',
      tone: 'review',
    };
  }

  return {
    key: 'active',
    label: 'Aktif',
    tone: 'active-soft',
  };
};

/**
 * Menentukan state verifikasi recruiter untuk tampilan directory admin.
 */
const getRecruiterAdminStatus = (recruiter) => {
  if (recruiter.account_status === 'suspended') {
    return {
      key: 'blocked',
      label: 'Nonaktif',
      tone: 'danger',
    };
  }

  if ((recruiter.verification_status || 'draft') === 'draft') {
    return {
      key: 'review',
      label: 'Draft',
      tone: 'muted',
    };
  }

  if ((recruiter.verification_status || 'pending') !== 'verified') {
    return {
      key: 'review',
      label: 'Menunggu',
      tone: 'warning',
    };
  }

  return {
    key: 'verified',
    label: 'Terverifikasi',
    tone: 'verified',
  };
};

/**
 * Menentukan status visual lowongan pada dashboard admin.
 */
const getJobAdminStatus = (job) => {
  if (job.workflow_status === 'filled') {
    return {
      key: 'filled',
      label: 'Filled',
      tone: 'muted',
    };
  }

  if (job.workflow_status === 'closed') {
    return {
      key: 'closed',
      label: 'Closed',
      tone: 'muted',
    };
  }

  if (job.workflow_status === 'paused' || job.status === 'inactive') {
    return {
      key: 'paused',
      label: 'Pause',
      tone: 'warning',
    };
  }

  if (job.workflow_status === 'draft') {
    return {
      key: 'draft',
      label: 'Draft',
      tone: 'muted',
    };
  }

  return {
    key: 'active',
    label: 'Aktif',
    tone: 'success',
  };
};

/**
 * Menyediakan ikon SVG terpusat untuk berbagai section dan aksi admin.
 */
const AdminIcon = ({ name, className = '' }) => {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `superadmin-icon ${className}`.trim(),
    'aria-hidden': 'true',
  };

  switch (name) {
    case 'monitor':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'candidate':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.25" />
          <path d="M3.5 19c1.2-3 3.5-4.5 6-4.5S14.4 16 15.5 19" />
          <path d="M16.5 8.5h4M18.5 6.5v4" />
        </svg>
      );
    case 'recruiter':
      return (
        <svg {...props}>
          <rect x="4" y="7" width="16" height="11" rx="2" />
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
          <path d="M4 11h16" />
        </svg>
      );
    case 'job':
      return (
        <svg {...props}>
          <path d="M7 4.5h10l1.5 2.5v12H5.5v-12L7 4.5Z" />
          <path d="M9 9.5h6M9 13.5h6M9 17.5h4" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...props}>
          <path d="M4 19h16" />
          <path d="M7 15V9" />
          <path d="M12 15V5" />
          <path d="M17 15v-3" />
        </svg>
      );
    case 'moderation':
      return (
        <svg {...props}>
          <path d="M4 20h16" />
          <path d="m6 15 4-4 3 3 5-6" />
          <path d="m7 8 2 2M15 18l2 2" />
        </svg>
      );
    case 'message':
      return (
        <svg {...props}>
          <path d="M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H9L5 20v-2.5H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5Z" />
          <path d="M7.5 10.5h8M7.5 13.5h5" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...props}>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
      );
    case 'download':
      return (
        <svg {...props}>
          <path d="M12 4v10" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
          <path d="M5 19h14" />
        </svg>
      );
    case 'reset':
      return (
        <svg {...props}>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M7.8 9.4A6.5 6.5 0 0 1 18 8.6L20 12" />
          <path d="M16.2 14.6A6.5 6.5 0 0 1 6 15.4L4 12" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M15 5h3a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19h-3" />
          <path d="M10 16l-4-4 4-4" />
          <path d="M6 12h10" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...props}>
          <path d="M2.8 12s3.2-5.5 9.2-5.5S21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case 'ban':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="m5 12.5 4.2 4.2L19 7" />
        </svg>
      );
    case 'switch':
      return (
        <svg {...props}>
          <path d="M7 7h10" />
          <path d="m13 3 4 4-4 4" />
          <path d="M17 17H7" />
          <path d="m11 21-4-4 4-4" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
          <path d="M7 3.8v3.4M17 3.8v3.4M3.5 10h17" />
        </svg>
      );
    case 'trend':
      return (
        <svg {...props}>
          <path d="m4 16 5-5 3.5 3.5L20 7" />
          <path d="M14 7h6v6" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...props}>
          <path d="M12 3.8 20.2 18H3.8L12 3.8Z" />
          <path d="M12 9v4.5M12 16h.01" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...props}>
          <path d="M12 3.5 13.6 8l4.9 1.1-3.7 3 1.1 5-3.9-2.4L8.1 17l1.1-5-3.7-3L10.4 8Z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...props}>
          <path d="M4.5 7.5h15" />
          <path d="M9 4.5h6" />
          <path d="M7 7.5v11a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-11" />
          <path d="M10 11v5M14 11v5" />
        </svg>
      );
    default:
      return null;
  }
};

/**
 * Merender grid metric admin dari konfigurasi kartu yang sudah dipersiapkan caller.
 */
const SectionMetrics = ({ cards }) => (
  <div className="superadmin-metric-grid">
    {cards.map((card) => (
      <article
        key={card.label}
        className={`superadmin-metric-card${
          card.dark ? ' is-dark' : ''
        }${card.alert ? ' is-alert' : ''}${card.compact ? ' is-compact' : ''}`}
      >
        <div className="superadmin-metric-head">
          <span className="superadmin-metric-label">{card.label}</span>
          <div className="superadmin-metric-headside">
            {card.badge && (
              <span className={`superadmin-inline-badge is-${card.badge.tone}`}>
                {card.badge.label}
              </span>
            )}
            {card.icon && (
              <span className={`superadmin-metric-icon${card.iconTone ? ` is-${card.iconTone}` : ''}`}>
                <AdminIcon name={card.icon} />
              </span>
            )}
          </div>
        </div>
        <strong className="superadmin-metric-value">{card.value}</strong>
        {card.progress ? (
          <div className="superadmin-progress-block">
            <div className="superadmin-progress-meta">
              <span>{card.progress.label}</span>
              {card.progress.goal && <strong>{card.progress.goal}</strong>}
            </div>
            <div className="superadmin-progress-track">
              <span style={{ width: `${card.progress.value}%` }} />
            </div>
          </div>
        ) : (
          <p className={`superadmin-metric-detail${card.detailTone ? ` is-${card.detailTone}` : ''}`}>
            {card.detail}
          </p>
        )}
      </article>
    ))}
  </div>
);

/**
 * Menyediakan komponen pagination kecil yang dipakai ulang di banyak tabel admin.
 */
const Pagination = ({ label, page, totalItems, pageSize = PAGE_SIZE, onPageChange }) => {
  const totalPages = getTotalPages(totalItems, pageSize);
  const items = buildPaginationItems(page, totalPages);

  return (
    <div className="superadmin-pagination-row">
      <span>{label}</span>
      <div className="superadmin-pagination">
        <button
          type="button"
          className="superadmin-page-arrow"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          ‹
        </button>
        {items.map((item, index) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`superadmin-page-button${item === page ? ' is-active' : ''}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : (
            <button key={`${item}-${index}`} type="button" className="superadmin-page-more" disabled>
              ...
            </button>
          )
        )}
        <button
          type="button"
          className="superadmin-page-arrow"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          ›
        </button>
      </div>
    </div>
  );
};

/**
 * Menjadi pusat kendali superadmin untuk monitoring, moderasi, analytics, dan inbox platform.
 */
const AdminDashboardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    threads,
    contacts,
    messages,
    isLoadingThreads,
    isLoadingContacts,
    isLoadingMessages,
    isSendingMessage,
    error: chatError,
    loadThreads,
    loadContacts,
    loadConversation,
    sendMessage,
  } = useChat();
  const [activeSection, setActiveSection] = useState(resolveSectionFromHash(location.hash));
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [monitoringSearchQuery, setMonitoringSearchQuery] = useState('');
  const [userStatusActionInFlightId, setUserStatusActionInFlightId] = useState(null);
  const [userResetActionInFlightId, setUserResetActionInFlightId] = useState(null);
  const [jobActionInFlightId, setJobActionInFlightId] = useState(null);
  const [jobReassignments, setJobReassignments] = useState({});
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState('all');
  const [candidatePage, setCandidatePage] = useState(1);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [recruiterSearchQuery, setRecruiterSearchQuery] = useState('');
  const [recruiterStatusFilter, setRecruiterStatusFilter] = useState('all');
  const [recruiterPage, setRecruiterPage] = useState(1);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState(null);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobSortOrder, setJobSortOrder] = useState('latest');
  const [jobPage, setJobPage] = useState(1);
  const [moderationSearchQuery, setModerationSearchQuery] = useState('');
  const [moderationTab, setModerationTab] = useState('all');
  const [moderationPage, setModerationPage] = useState(1);
  const [dismissedModerationKeys, setDismissedModerationKeys] = useState([]);
  const [selectedOptimizationJobId, setSelectedOptimizationJobId] = useState(null);
  const [selectedMonitoringMapKey, setSelectedMonitoringMapKey] = useState('');
  const [selectedChatContact, setSelectedChatContact] = useState(null);
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  useEffect(() => {
    setActiveSection(resolveSectionFromHash(location.hash));
  }, [location.hash]);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await AdminService.getDashboard();
      setDashboard(response);
      setLastSyncedAt(new Date().toISOString());
      setJobReassignments((current) => {
        const next = { ...current };

        (response.jobs || []).forEach((job) => {
          const key = String(job.id);
          next[key] = next[key] || (job.recruiter?.id ? String(job.recruiter.id) : '');
        });

        return next;
      });
    } catch (loadError) {
      setError(loadError?.message || 'Gagal memuat dashboard superadmin.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setCandidatePage(1);
  }, [candidateSearchQuery, candidateStatusFilter]);

  useEffect(() => {
    setRecruiterPage(1);
  }, [recruiterSearchQuery, recruiterStatusFilter]);

  useEffect(() => {
    setJobPage(1);
  }, [jobSearchQuery, jobStatusFilter, jobSortOrder]);

  useEffect(() => {
    setModerationPage(1);
  }, [moderationSearchQuery, moderationTab]);

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
    if (activeSection !== 'messages') {
      return;
    }

    const normalizedQuery = chatSearchQuery.trim().toLowerCase();
    const ownSearchTerms = [user?.email, user?.name]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);

    if (normalizedQuery && ownSearchTerms.includes(normalizedQuery)) {
      setChatSearchQuery('');
    }
  }, [activeSection, chatSearchQuery, user?.email, user?.name]);

  useEffect(() => {
    if (activeSection !== 'messages' || selectedChatContact?.id) {
      return;
    }

    const fallbackContact = threads[0]?.contact || contacts[0];

    if (!fallbackContact?.id) {
      return;
    }

    setSelectedChatContact(fallbackContact);
    loadConversation(fallbackContact.id).catch(() => {});
  }, [
    activeSection,
    contacts,
    loadConversation,
    selectedChatContact?.id,
    threads,
  ]);

  const totals = dashboard?.totals ?? {};
  const growth = dashboard?.growth ?? {};
  const candidateTable = dashboard?.candidate_table ?? [];
  const recruiterTable = dashboard?.recruiter_table ?? [];
  const recruiterOptions = dashboard?.recruiter_options ?? [];
  const jobs = dashboard?.jobs ?? [];
  const applications = dashboard?.applications ?? [];
  const screeningOverview = dashboard?.screening_overview ?? {};
  const schemaWarnings = dashboard?.meta?.schema_warnings ?? [];
  const hasSchemaWarnings = schemaWarnings.length > 0;
  const schemaWarningSummary = hasSchemaWarnings
    ? `Kolom production belum sinkron: ${schemaWarnings.slice(0, 4).join(', ')}${
        schemaWarnings.length > 4 ? `, +${schemaWarnings.length - 4} lainnya` : ''
      }.`
    : '';

  const activeCandidatesCount = candidateTable.filter(
    (candidate) => candidate.account_status === 'active'
  ).length;
  const suspendedCandidatesCount = candidateTable.filter(
    (candidate) => candidate.account_status === 'suspended'
  ).length;
  const activeRecruitersCount = recruiterTable.filter(
    (recruiter) => recruiter.account_status === 'active'
  ).length;
  const suspendedRecruitersCount = recruiterTable.filter(
    (recruiter) => recruiter.account_status === 'suspended'
  ).length;
  const candidateReviewCount = candidateTable.filter(
    (candidate) => !candidate.profile_ready || candidate.account_status === 'suspended'
  ).length;

  const candidateRows = useMemo(
    () =>
      candidateTable.map((candidate) => ({
        ...candidate,
        initials: getInitials(candidate.name),
        position: candidate.latest_job_title || 'Belum ada posisi dilamar',
        dateLabel: formatDateShort(candidate.created_at),
        adminStatus: getCandidateAdminStatus(candidate),
        preferredRolesLabel:
          candidate.preferred_roles?.slice(0, 2).join(', ') || 'Preferensi belum lengkap',
        preferredLocationsLabel:
          candidate.preferred_locations?.slice(0, 2).join(', ') || 'Lokasi belum dipilih',
        skillsLabel: candidate.skills?.slice(0, 4).join(', ') || 'Skill belum dilengkapi',
      })),
    [candidateTable]
  );

  const recruiterRows = useMemo(
    () =>
      recruiterTable.map((recruiter) => ({
        ...recruiter,
        initials: getInitials(recruiter.company_name || recruiter.name),
        locationLabel: recruiter.company_address || recruiter.company_location || 'Alamat belum diisi',
        adminStatus: getRecruiterAdminStatus(recruiter),
        recruiterNameLabel: recruiter.recruiter_name || recruiter.name || 'PIC belum diisi',
        industryLabel: recruiter.industry || 'Industri belum diisi',
        employeeRangeLabel: recruiter.employee_range || 'Skala tim belum diisi',
        companyEmailLabel: recruiter.company_email || recruiter.email || 'Email belum diisi',
        companyLinkLabel: recruiter.company_link || 'Link belum diisi',
        legalDocumentLabel:
          recruiter.company_legal_document_name || 'Dokumen legal belum diunggah',
        hiringFocusLabel:
          recruiter.hiring_focus?.slice(0, 2).join(', ') || 'Fokus hiring belum diisi',
      })),
    [recruiterTable]
  );

  const recruiterReviewCount = recruiterRows.filter(
    (recruiter) => recruiter.adminStatus.key === 'review' || recruiter.adminStatus.key === 'blocked'
  ).length;

  const jobRows = useMemo(
    () =>
      jobs.map((job) => ({
        ...job,
        companyLabel: job.recruiter?.company_name || job.recruiter?.name || 'Recruiter',
        postedAtLabel: formatDateShort(job.created_at),
        adminStatus: getJobAdminStatus(job),
        ageInDays: getAgeInDays(job.created_at),
        isFlagged:
          !job.recruiter?.id ||
          job.workflow_status === 'paused' ||
          (job.status === 'inactive' && !['closed', 'filled'].includes(job.workflow_status || '')) ||
          (Number(job.applications_count || 0) === 0 &&
            job.workflow_status === 'active' &&
            job.status === 'active' &&
            getAgeInDays(job.created_at) >= 14),
        reviewReason:
          !job.recruiter?.id
            ? 'Lowongan belum terhubung ke recruiter aktif.'
            : job.workflow_status === 'paused'
              ? 'Lowongan sedang dipause dan perlu keputusan admin.'
              : job.status === 'inactive' && !['closed', 'filled'].includes(job.workflow_status || '')
                ? 'Lowongan nonaktif tanpa status penutupan final.'
                : Number(job.applications_count || 0) === 0 && getAgeInDays(job.created_at) >= 14
                  ? 'Lowongan aktif lebih dari 14 hari tanpa pelamar.'
                  : 'Lowongan siap dipantau.',
      })),
    [jobs]
  );

  const filteredCandidateRows = useMemo(() => {
    const normalizedQuery = normalizeText(candidateSearchQuery);

    return candidateRows.filter((candidate) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          candidate.name,
          candidate.email,
          candidate.position,
          candidate.latest_application_stage,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        candidateStatusFilter === 'all' ||
        (candidateStatusFilter === 'suspended' && candidate.account_status === 'suspended') ||
        (candidateStatusFilter === 'active' && candidate.adminStatus.key === 'active') ||
        (candidateStatusFilter === 'review' && candidate.adminStatus.key === 'review');

      return matchesQuery && matchesStatus;
    });
  }, [candidateRows, candidateSearchQuery, candidateStatusFilter]);

  const candidateTotalPages = getTotalPages(filteredCandidateRows.length);

  useEffect(() => {
    setCandidatePage((currentPage) => Math.min(currentPage, candidateTotalPages));
  }, [candidateTotalPages]);

  const visibleCandidateRows = useMemo(() => {
    const startIndex = (candidatePage - 1) * PAGE_SIZE;
    return filteredCandidateRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredCandidateRows, candidatePage]);

  const selectedCandidate =
    candidateRows.find((candidate) => Number(candidate.id) === Number(selectedCandidateId)) ||
    visibleCandidateRows[0] ||
    filteredCandidateRows[0] ||
    null;

  const filteredRecruiterRows = useMemo(() => {
    const normalizedQuery = normalizeText(recruiterSearchQuery);

    return recruiterRows.filter((recruiter) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          recruiter.name,
          recruiter.email,
          recruiter.company_name,
          recruiter.locationLabel,
          recruiter.recruiterNameLabel,
          recruiter.industryLabel,
          recruiter.employeeRangeLabel,
          recruiter.companyEmailLabel,
          recruiter.legalDocumentLabel,
          recruiter.hiringFocusLabel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        recruiterStatusFilter === 'all' ||
        (recruiterStatusFilter === 'verified' && recruiter.adminStatus.key === 'verified') ||
        (recruiterStatusFilter === 'review' && recruiter.adminStatus.key === 'review') ||
        (recruiterStatusFilter === 'suspended' && recruiter.adminStatus.key === 'blocked');

      return matchesQuery && matchesStatus;
    });
  }, [recruiterRows, recruiterSearchQuery, recruiterStatusFilter]);

  const recruiterTotalPages = getTotalPages(filteredRecruiterRows.length);

  useEffect(() => {
    setRecruiterPage((currentPage) => Math.min(currentPage, recruiterTotalPages));
  }, [recruiterTotalPages]);

  const visibleRecruiterRows = useMemo(() => {
    const startIndex = (recruiterPage - 1) * PAGE_SIZE;
    return filteredRecruiterRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRecruiterRows, recruiterPage]);

  const selectedRecruiter =
    recruiterRows.find((recruiter) => Number(recruiter.id) === Number(selectedRecruiterId)) ||
    visibleRecruiterRows[0] ||
    filteredRecruiterRows[0] ||
    null;

  const sortedJobRows = useMemo(() => {
    const normalizedQuery = normalizeText(jobSearchQuery);
    const filteredJobs = jobRows.filter((job) => {
      const matchesQuery =
        !normalizedQuery ||
        [job.title, job.companyLabel, job.location, job.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        jobStatusFilter === 'all' ||
        (jobStatusFilter === 'flagged' && job.isFlagged) ||
        (jobStatusFilter === 'active' && job.adminStatus.key === 'active') ||
        (jobStatusFilter === 'paused' && job.adminStatus.key === 'paused') ||
        (jobStatusFilter === 'closed' &&
          ['closed', 'filled'].includes(job.adminStatus.key)) ||
        (jobStatusFilter === 'empty' &&
          Number(job.applications_count || 0) === 0 &&
          job.adminStatus.key === 'active');

      return matchesQuery && matchesStatus;
    });

    const nextJobs = [...filteredJobs];

    if (jobSortOrder === 'applications') {
      nextJobs.sort(
        (firstJob, secondJob) =>
          Number(secondJob.applications_count || 0) - Number(firstJob.applications_count || 0)
      );
    } else {
      nextJobs.sort(
        (firstJob, secondJob) =>
          new Date(secondJob.created_at || 0).getTime() -
          new Date(firstJob.created_at || 0).getTime()
      );
    }

    return nextJobs;
  }, [jobRows, jobSearchQuery, jobSortOrder, jobStatusFilter]);

  const jobTotalPages = getTotalPages(sortedJobRows.length);

  useEffect(() => {
    setJobPage((currentPage) => Math.min(currentPage, jobTotalPages));
  }, [jobTotalPages]);

  const visibleJobRows = useMemo(() => {
    const startIndex = (jobPage - 1) * PAGE_SIZE;
    return sortedJobRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedJobRows, jobPage]);

  const moderationReports = useMemo(() => {
    const flaggedJobReports = jobRows
      .filter((job) => job.isFlagged)
      .map((job, index) => ({
        key: `job-${job.id}`,
        type: 'job',
        targetId: job.id,
        title: `Lowongan: ${job.title}`,
        ownerLabel: `${job.companyLabel} • ID: JOB-${String(job.id).padStart(5, '0')}`,
        severityLabel: 'Butuh Tindakan',
        reason: job.reviewReason,
        timestamp: formatDateTime(job.created_at),
        badgeTone: job.adminStatus.key === 'paused' ? 'warning' : 'danger',
        evidenceCount: 2,
        accountAction: null,
        jobAction:
          job.adminStatus.key === 'paused'
            ? { status: 'active', workflow_status: 'active' }
            : { status: 'inactive', workflow_status: 'paused' },
        primaryActionLabel: 'Buka Lowongan',
        secondaryActionLabel:
          job.adminStatus.key === 'paused' ? 'Aktifkan Lagi' : 'Pause Lowongan',
      }));

    const candidateReports = candidateRows
      .filter((candidate) => !candidate.profile_ready || candidate.account_status === 'suspended')
      .map((candidate) => ({
        key: `candidate-${candidate.id}`,
        type: 'account',
        targetId: candidate.id,
        title: `Profil: ${candidate.name}`,
        ownerLabel: `Jobseeker • ID: USR-${String(candidate.id).padStart(5, '0')}`,
        severityLabel:
          candidate.account_status === 'suspended' ? 'Pelanggaran Syarat' : 'Butuh Review',
        reason:
          candidate.account_status === 'suspended'
            ? candidate.account_status_reason ||
              'Akun pernah dinonaktifkan karena pelanggaran dan perlu peninjauan lanjutan.'
            : 'Profil kandidat belum lengkap atau memiliki indikasi data lamaran yang belum konsisten.',
        timestamp: formatDateTime(candidate.created_at),
        badgeTone: candidate.account_status === 'suspended' ? 'danger' : 'warning',
        evidenceCount: 2,
        accountAction: candidate,
        entity: 'candidate',
        primaryActionLabel: 'Buka Profil',
        secondaryActionLabel:
          candidate.account_status === 'suspended' ? 'Aktifkan Akun' : 'Suspend Akun',
      }));

    const recruiterReports = recruiterRows
      .filter((recruiter) => !recruiter.profile_ready || recruiter.account_status === 'suspended')
      .map((recruiter) => ({
        key: `recruiter-${recruiter.id}`,
        type: 'account',
        targetId: recruiter.id,
        title: `Recruiter: ${recruiter.company_name || recruiter.name}`,
        ownerLabel: `Recruiter • ID: REC-${String(recruiter.id).padStart(5, '0')}`,
        severityLabel:
          recruiter.account_status === 'suspended' ? 'Akun Dibatasi' : 'Verifikasi Tertahan',
        reason:
          recruiter.account_status === 'suspended'
            ? recruiter.account_status_reason ||
              'Recruiter sedang dinonaktifkan dan butuh keputusan admin.'
            : 'Profil company belum lengkap sehingga perlu verifikasi lanjutan.',
        timestamp: formatDateTime(recruiter.created_at),
        badgeTone: recruiter.account_status === 'suspended' ? 'danger' : 'warning',
        evidenceCount: 2,
        accountAction: recruiter,
        entity: 'recruiter',
        primaryActionLabel: 'Buka Recruiter',
        secondaryActionLabel:
          recruiter.account_status === 'suspended' ? 'Aktifkan Akun' : 'Suspend Akun',
      }));

    return [...flaggedJobReports, ...candidateReports, ...recruiterReports].sort(
      (firstItem, secondItem) => {
        const firstTime = new Date(firstItem.timestamp || 0).getTime();
        const secondTime = new Date(secondItem.timestamp || 0).getTime();
        return secondTime - firstTime;
      }
    );
  }, [candidateRows, recruiterRows, jobRows]);

  const filteredModerationReports = useMemo(() => {
    const normalizedQuery = normalizeText(moderationSearchQuery);

    return moderationReports.filter((report) => {
      const matchesTab = moderationTab === 'all' || report.type === moderationTab;
      const matchesQuery =
        !normalizedQuery ||
        [report.title, report.ownerLabel, report.severityLabel, report.reason]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      const notDismissed = !dismissedModerationKeys.includes(report.key);

      return matchesTab && matchesQuery && notDismissed;
    });
  }, [moderationReports, moderationSearchQuery, moderationTab, dismissedModerationKeys]);

  const moderationTotalPages = getTotalPages(filteredModerationReports.length);

  useEffect(() => {
    setModerationPage((currentPage) => Math.min(currentPage, moderationTotalPages));
  }, [moderationTotalPages]);

  const visibleModerationReports = useMemo(() => {
    const startIndex = (moderationPage - 1) * PAGE_SIZE;
    return filteredModerationReports.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredModerationReports, moderationPage]);

  const selectedOptimizationJob =
    jobRows.find((job) => Number(job.id) === Number(selectedOptimizationJobId)) ||
    jobRows.find((job) => job.isFlagged) ||
    jobRows[0] ||
    null;
  const flaggedJobsCount = jobRows.filter((job) => job.isFlagged).length;
  const syncTone = isLoading ? 'loading' : error ? 'error' : hasSchemaWarnings ? 'warning' : 'success';

  useEffect(() => {
    if (!selectedOptimizationJob && jobRows.length > 0) {
      setSelectedOptimizationJobId(jobRows[0].id);
      return;
    }

    if (
      selectedOptimizationJob &&
      jobReassignments[String(selectedOptimizationJob.id)] &&
      jobRows.some((job) => Number(job.id) === Number(selectedOptimizationJob.id))
    ) {
      return;
    }

    if (selectedOptimizationJob) {
      setJobReassignments((current) => ({
        ...current,
        [String(selectedOptimizationJob.id)]:
          current[String(selectedOptimizationJob.id)] ||
          (selectedOptimizationJob.recruiter?.id ? String(selectedOptimizationJob.recruiter.id) : ''),
      }));
    }
  }, [jobRows, jobReassignments, selectedOptimizationJob]);

  useEffect(() => {
    if (!selectedCandidate && filteredCandidateRows.length > 0) {
      setSelectedCandidateId(filteredCandidateRows[0].id);
    }
  }, [filteredCandidateRows, selectedCandidate]);

  useEffect(() => {
    if (!selectedRecruiter && filteredRecruiterRows.length > 0) {
      setSelectedRecruiterId(filteredRecruiterRows[0].id);
    }
  }, [filteredRecruiterRows, selectedRecruiter]);

  const popularJobs = useMemo(
    () =>
      [...jobRows]
        .sort(
          (firstJob, secondJob) =>
            Number(secondJob.applications_count || 0) - Number(firstJob.applications_count || 0)
        )
        .slice(0, 4),
    [jobRows]
  );

  const recruiterVerificationActivities = useMemo(
    () =>
      recruiterRows
        .slice(0, 4)
        .map((recruiter) => ({
          key: recruiter.id,
          title:
            recruiter.adminStatus.key === 'verified'
              ? `Superadmin memverifikasi ${recruiter.company_name || recruiter.name}`
              : recruiter.adminStatus.key === 'review'
                ? `${recruiter.company_name || recruiter.name} kembali ke antrian review`
                : `Superadmin menonaktifkan akun ${recruiter.company_name || recruiter.name}`,
          detail:
            recruiter.adminStatus.key === 'verified'
              ? 'Dokumen recruiter lengkap dan lowongan siap dipublikasikan.'
              : recruiter.adminStatus.key === 'review'
                ? recruiter.verification_notes || 'Profil company belum lengkap untuk dinyatakan verified.'
                : recruiter.account_status_reason || 'Akun dinonaktifkan sementara untuk peninjauan.',
          timestamp: formatDateTime(recruiter.created_at),
          tone:
            recruiter.adminStatus.key === 'verified'
              ? 'success'
              : recruiter.adminStatus.key === 'review'
                ? 'neutral'
                : 'danger',
        })),
    [recruiterRows]
  );

  const lowonganActivityLogs = useMemo(
    () =>
      jobRows.slice(0, 4).map((job) => ({
        key: job.id,
        title:
          job.isFlagged
            ? `Lowongan ${job.title} masuk antrian moderasi`
            : `Lowongan ${job.title} dipindahkan ke recruiter lain`,
        detail:
          job.isFlagged
            ? `Perusahaan ${job.companyLabel} • status ${job.adminStatus.label}`
            : `Sistem AI mendeteksi potensi optimisasi untuk ${job.companyLabel}`,
        timestamp: formatDateTime(job.created_at),
        tone: job.isFlagged ? 'danger' : 'neutral',
      })),
    [jobRows]
  );

  const monitoringActivityFeed = useMemo(
    () =>
      [
        ...applications.map((application) => ({
          key: `application-${application.id}`,
          icon: 'candidate',
          title: `${application.candidate?.name || 'Kandidat'} melamar ${application.job?.title || 'lowongan'}`,
          detail: `${formatApplicationStage(application.stage)} • ${application.recruiter?.company_name || application.recruiter?.name || 'Recruiter'}`,
          timestamp: application.applied_at || null,
        })),
        ...jobRows.map((job) => ({
          key: `job-${job.id}`,
          icon: 'job',
          title: `${job.title} dipublikasikan / dipantau`,
          detail: `${job.companyLabel} • ${job.adminStatus.label}`,
          timestamp: job.created_at || null,
        })),
      ]
        .sort(
          (firstItem, secondItem) =>
            new Date(secondItem.timestamp || 0).getTime() -
            new Date(firstItem.timestamp || 0).getTime()
        )
        .slice(0, 6),
    [applications, jobRows]
  );

  const monitoringActivityRows = useMemo(
    () =>
      monitoringActivityFeed.map((entry) => ({
        ...entry,
        entity:
          entry.icon === 'candidate'
            ? 'Kandidat'
            : entry.icon === 'job'
              ? 'Lowongan'
              : 'Sistem',
        status:
          entry.icon === 'candidate'
            ? 'Lamaran Baru'
            : entry.detail?.includes('Aktif')
              ? 'Aktif'
              : 'Review',
        admin: 'Sistem',
      })),
    [monitoringActivityFeed]
  );

  const filteredMonitoringActivityRows = useMemo(() => {
    const normalizedQuery = normalizeText(monitoringSearchQuery);

    return monitoringActivityRows.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      return [entry.entity, entry.title, entry.detail, entry.status, entry.admin]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [monitoringActivityRows, monitoringSearchQuery]);

  const monitoringLocationMap = useMemo(() => {
    const pointsByCoordinates = new Map();
    const unresolvedLocations = new Map();

    const registerUnresolvedLocation = (locationLabel) => {
      const nextLabel = getMonitoringLocationLabel(locationLabel);

      if (nextLabel) {
        unresolvedLocations.set(nextLabel, nextLabel);
      }
    };

    const registerLocationSignal = (locationLabel, timestamp, applySignal) => {
      if (!isMappableMonitoringLocation(locationLabel)) {
        return;
      }

      const coordinates = getLocationCoordinates(locationLabel);

      if (!coordinates) {
        registerUnresolvedLocation(locationLabel);
        return;
      }

      const pointKey = `${coordinates.latitude.toFixed(4)}:${coordinates.longitude.toFixed(4)}`;
      const nextLabel = getMonitoringLocationLabel(locationLabel);
      const entry =
        pointsByCoordinates.get(pointKey) || {
          key: pointKey,
          label: nextLabel || 'Lokasi',
          aliases: new Set(),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          candidateInterestCount: 0,
          candidateReviewCount: 0,
          recruiterCount: 0,
          recruiterReviewCount: 0,
          jobCount: 0,
          flaggedJobCount: 0,
          applicationCount: 0,
          lastUpdatedAt: null,
        };

      if (nextLabel) {
        entry.aliases.add(nextLabel);
      }

      applySignal(entry);

      if (timestamp) {
        const nextTimestamp = new Date(timestamp).getTime();
        const currentTimestamp = entry.lastUpdatedAt ? new Date(entry.lastUpdatedAt).getTime() : 0;

        if (Number.isFinite(nextTimestamp) && nextTimestamp > currentTimestamp) {
          entry.lastUpdatedAt = timestamp;
        }
      }

      pointsByCoordinates.set(pointKey, entry);
    };

    candidateRows.forEach((candidate) => {
      const uniqueLocations = Array.from(new Set(candidate.preferred_locations || []));

      uniqueLocations.forEach((locationLabel) =>
        registerLocationSignal(locationLabel, candidate.latest_applied_at || candidate.created_at, (entry) => {
          entry.candidateInterestCount += 1;

          if (candidate.adminStatus.key !== 'active') {
            entry.candidateReviewCount += 1;
          }
        })
      );
    });

    recruiterRows.forEach((recruiter) => {
      registerLocationSignal(
        recruiter.locationLabel,
        recruiter.latest_job_created_at || recruiter.created_at,
        (entry) => {
          entry.recruiterCount += 1;

          if (recruiter.adminStatus.key !== 'verified') {
            entry.recruiterReviewCount += 1;
          }
        }
      );
    });

    jobRows.forEach((job) => {
      registerLocationSignal(job.location, job.created_at, (entry) => {
        entry.jobCount += 1;

        if (job.isFlagged) {
          entry.flaggedJobCount += 1;
        }
      });
    });

    applications.forEach((application) => {
      registerLocationSignal(application.job?.location, application.applied_at, (entry) => {
        entry.applicationCount += 1;
      });
    });

    const points = Array.from(pointsByCoordinates.values())
      .map((point) => {
        const aliases = Array.from(point.aliases).sort((firstLabel, secondLabel) => {
          if (firstLabel.length !== secondLabel.length) {
            return secondLabel.length - firstLabel.length;
          }

          return firstLabel.localeCompare(secondLabel, 'id');
        });
        const totalSignals =
          point.candidateInterestCount +
          point.recruiterCount +
          point.jobCount +
          point.applicationCount;
        const reviewCount =
          point.flaggedJobCount + point.candidateReviewCount + point.recruiterReviewCount;
        const tone =
          point.flaggedJobCount > 0 ? 'danger' : reviewCount > 0 ? 'warning' : 'success';
        const activityScore =
          point.applicationCount * 5 +
          point.jobCount * 4 +
          point.recruiterCount * 3 +
          point.candidateInterestCount * 2 +
          point.flaggedJobCount * 6;

        return {
          ...point,
          label: aliases[0] || point.label,
          aliases,
          totalSignals,
          reviewCount,
          tone,
          activityScore,
        };
      })
      .sort((firstPoint, secondPoint) => {
        if (secondPoint.activityScore !== firstPoint.activityScore) {
          return secondPoint.activityScore - firstPoint.activityScore;
        }

        if (secondPoint.totalSignals !== firstPoint.totalSignals) {
          return secondPoint.totalSignals - firstPoint.totalSignals;
        }

        return firstPoint.label.localeCompare(secondPoint.label, 'id');
      });

    return {
      points,
      unmappedLocations: Array.from(unresolvedLocations.keys()).sort((firstLabel, secondLabel) =>
        firstLabel.localeCompare(secondLabel, 'id')
      ),
    };
  }, [applications, candidateRows, jobRows, recruiterRows]);

  useEffect(() => {
    if (
      selectedMonitoringMapKey &&
      monitoringLocationMap.points.some((point) => point.key === selectedMonitoringMapKey)
    ) {
      return;
    }

    setSelectedMonitoringMapKey(monitoringLocationMap.points[0]?.key || '');
  }, [monitoringLocationMap.points, selectedMonitoringMapKey]);

  const categoryDistribution = useMemo(() => {
    const counts = jobRows.reduce((categories, job) => {
      const nextCategory = job.category || 'Lainnya';
      categories[nextCategory] = (categories[nextCategory] || 0) + 1;
      return categories;
    }, {});

    const totalJobs = Math.max(jobRows.length, 1);
    const sortedCategories = Object.entries(counts)
      .sort((firstCategory, secondCategory) => secondCategory[1] - firstCategory[1])
      .slice(0, 5)
      .map(([label, count], index) => ({
        label,
        percentage: Math.max(8, Math.round((count / totalJobs) * 100)),
        tone: ['navy', 'orange', 'stone', 'forest', 'gray'][index] || 'gray',
      }));

    if (sortedCategories.length > 0) {
      return sortedCategories;
    }

    return [
      { label: 'Teknologi Informasi', percentage: 32, tone: 'navy' },
      { label: 'Keuangan & Perbankan', percentage: 24, tone: 'orange' },
      { label: 'Logistik & Distribusi', percentage: 18, tone: 'stone' },
      { label: 'Manufaktur', percentage: 15, tone: 'forest' },
      { label: 'Lainnya', percentage: 11, tone: 'gray' },
    ];
  }, [jobRows]);

  const candidateDailySeries = useMemo(
    () => buildLast7DaySeries(candidateRows.map((candidate) => candidate.created_at)),
    [candidateRows]
  );

  const recruiterDailySeries = useMemo(
    () => buildLast7DaySeries(recruiterRows.map((recruiter) => recruiter.created_at)),
    [recruiterRows]
  );

  const analyticsDayLabels = candidateDailySeries.map((item) => item.label);
  const candidateAnalyticsPath = useMemo(
    () => createAnalyticsLinePath(candidateDailySeries),
    [candidateDailySeries]
  );
  const recruiterAnalyticsPath = useMemo(
    () => createAnalyticsLinePath(recruiterDailySeries),
    [recruiterDailySeries]
  );

  const applicationStageDistribution = useMemo(() => {
    const stageCounts = applications.reduce((accumulator, application) => {
      const key = formatApplicationStage(application.stage || application.status || 'applied');
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const totalItems = Math.max(applications.length, 1);
    const palette = ['#0f1733', '#d7a53d', '#b8b0b8', '#e5d2a2'];
    const slices = Object.entries(stageCounts)
      .sort((firstStage, secondStage) => secondStage[1] - firstStage[1])
      .slice(0, 4)
      .map(([label, count], index) => ({
        label,
        value: Math.max(4, Math.round((count / totalItems) * 100)),
        color: palette[index] || '#d0ccd2',
      }));

    if (slices.length > 0) {
      return slices;
    }

    return [
      { label: 'Baru Masuk', value: 100, color: '#0f1733' },
    ];
  }, [applications]);

  const analyticsPeriodLabel = lastSyncedAt
    ? `Data live • ${formatDateTime(lastSyncedAt)}`
    : 'Data live';

  const placementRate = getProgressValue(
    totals.accepted_applications ?? 0,
    totals.total_applications ?? 0
  );

  const analyticsInsightText =
    flaggedJobsCount > 0
      ? `${numberFormatter.format(flaggedJobsCount)} lowongan perlu optimisasi distribusi atau peninjauan ulang status tayangnya.`
      : `Distribusi terbesar saat ini ada di kategori ${categoryDistribution[0]?.label || 'utama'} dengan stage aplikasi dominan ${
          applicationStageDistribution[0]?.label || 'Baru Masuk'
        }.`;

  const analyticsHealthItems = [
    {
      label: 'Server API',
      tone: syncTone === 'error' ? 'danger' : syncTone === 'warning' ? 'warning' : 'success',
      value: syncTone === 'error' ? 'Issue' : syncTone === 'warning' ? 'Fallback' : 'Live',
    },
    {
      label: 'Database Feed',
      tone: lastSyncedAt ? 'success' : 'warning',
      value: lastSyncedAt ? 'Synced' : 'Checking',
    },
    {
      label: 'Review Queue',
      tone: filteredModerationReports.length > 0 ? 'warning' : 'success',
      value: filteredModerationReports.length > 0 ? `${filteredModerationReports.length} item` : 'Clear',
    },
  ];

  const analyticsAdminLogs = useMemo(
    () =>
      [
        ...recruiterVerificationActivities.slice(0, 2).map((item) => ({
          key: `recruiter-log-${item.key}`,
          title: item.title,
          detail: item.timestamp,
          tone: item.tone,
        })),
        ...lowonganActivityLogs.slice(0, 2).map((item) => ({
          key: `job-log-${item.key}`,
          title: item.title,
          detail: item.timestamp,
          tone: item.tone,
        })),
      ].slice(0, 4),
    [recruiterVerificationActivities, lowonganActivityLogs]
  );

  const monitoringCards = [
    {
      label: 'Pelamar Aktif',
      value: numberFormatter.format(activeCandidatesCount),
      detail: `+${numberFormatter.format(growth.new_candidates_last_7_days ?? 0)} / 7 hari`,
    },
    {
      label: 'Recruiter Aktif',
      value: numberFormatter.format(activeRecruitersCount),
      detail: `${numberFormatter.format(activeRecruitersCount)} / ${numberFormatter.format(
        totals.recruiters ?? 0
      )}`,
    },
    {
      label: 'Lowongan Aktif',
      value: numberFormatter.format(totals.active_jobs ?? 0),
      detail: `${numberFormatter.format(growth.new_jobs_last_7_days ?? 0)} baru`,
    },
    {
      label: 'Lamaran Baru',
      value: numberFormatter.format(growth.new_applications_last_7_days ?? 0),
      detail: '7 hari ini',
    },
  ];

  const monitoringHealthCards = [
    {
      label: 'Dashboard API',
      status:
        syncTone === 'error'
          ? 'danger'
          : syncTone === 'loading' || syncTone === 'warning'
            ? 'warning'
            : 'success',
      title:
        syncTone === 'error'
          ? 'Koneksi ke dashboard bermasalah'
          : syncTone === 'warning'
            ? 'Dashboard berjalan dengan mode fallback'
          : syncTone === 'loading'
            ? 'Sinkronisasi data berjalan'
            : 'Feed operasional sedang sehat',
      detail:
        syncTone === 'error'
          ? error
          : syncTone === 'warning'
            ? `${schemaWarningSummary} Jalankan migrate production agar seluruh data dan fitur sinkron penuh.`
          : syncTone === 'loading'
            ? 'Sedang mengambil data kandidat, recruiter, lowongan, dan lamaran.'
            : `Data live berhasil ditarik pada ${formatDateTime(lastSyncedAt)}.`,
    },
    {
      label: 'Review Pelamar',
      status: candidateReviewCount > 0 ? 'warning' : 'success',
      title:
        candidateReviewCount > 0
          ? `${numberFormatter.format(candidateReviewCount)} profil perlu ditinjau`
          : 'Tidak ada pelamar yang tertahan review',
      detail:
        candidateReviewCount > 0
          ? 'Profil belum lengkap atau akun sedang dinonaktifkan sementara.'
          : 'Semua profil pelamar utama berada pada status aman.',
    },
    {
      label: 'Verifikasi Recruiter',
      status: recruiterReviewCount > 0 ? 'warning' : 'success',
      title:
        recruiterReviewCount > 0
          ? `${numberFormatter.format(recruiterReviewCount)} recruiter butuh tindakan`
          : 'Verifikasi recruiter terkendali',
      detail:
        recruiterReviewCount > 0
          ? 'Ada recruiter yang profil company-nya belum lengkap atau butuh validasi.'
          : 'Direktori recruiter aktif berada pada status siap operasional.',
    },
    {
      label: 'Lowongan Flagged',
      status: flaggedJobsCount > 0 ? 'danger' : 'success',
      title:
        flaggedJobsCount > 0
          ? `${numberFormatter.format(flaggedJobsCount)} lowongan masuk radar`
          : 'Tidak ada lowongan yang ter-flag saat ini',
      detail:
        flaggedJobsCount > 0
          ? 'Status tidak aktif, flagged, atau rasio pelamar rendah membutuhkan pengecekan.'
          : 'Distribusi lowongan publik stabil dan siap dipantau berkala.',
    },
  ];

  const monitoringQuickActions = [
    {
      label: 'Pelamar',
      title: 'Buka antrian pelamar',
      detail: `${numberFormatter.format(candidateReviewCount)} akun perlu pengecekan cepat`,
      tone: candidateReviewCount > 0 ? 'warning' : 'neutral',
      action: () => {
        setCandidateStatusFilter('review');
        handleSectionChange('pelamar');
      },
    },
    {
      label: 'Recruiter',
      title: 'Cek verifikasi recruiter',
      detail: `${numberFormatter.format(recruiterReviewCount)} profil company belum final`,
      tone: recruiterReviewCount > 0 ? 'warning' : 'neutral',
      action: () => {
        setRecruiterStatusFilter('review');
        handleSectionChange('recruiter');
      },
    },
    {
      label: 'Lowongan',
      title: 'Tinjau lowongan flagged',
      detail: `${numberFormatter.format(flaggedJobsCount)} lowongan perlu intervensi`,
      tone: flaggedJobsCount > 0 ? 'danger' : 'neutral',
      action: () => {
        setJobStatusFilter('flagged');
        handleSectionChange('lowongan');
      },
    },
    {
      label: 'Review',
      title: 'Buka antrian review',
      detail: `${numberFormatter.format(filteredModerationReports.length)} item siap diproses`,
      tone: filteredModerationReports.length > 0 ? 'danger' : 'neutral',
      action: () => handleSectionChange('moderation'),
    },
  ];

  const monitoringPriorityItems = [
    {
      label: 'Akun kandidat perlu review',
      value: numberFormatter.format(candidateReviewCount),
      detail: `${numberFormatter.format(suspendedCandidatesCount)} akun sedang nonaktif`,
      tone: candidateReviewCount > 0 ? 'warning' : 'success',
    },
    {
      label: 'Recruiter butuh verifikasi',
      value: numberFormatter.format(recruiterReviewCount),
      detail: `${numberFormatter.format(suspendedRecruitersCount)} recruiter sedang dibatasi`,
      tone: recruiterReviewCount > 0 ? 'warning' : 'success',
    },
    {
      label: 'Lowongan masuk moderasi',
      value: numberFormatter.format(flaggedJobsCount),
      detail: `${numberFormatter.format(filteredModerationReports.length)} item review aktif`,
      tone: flaggedJobsCount > 0 ? 'danger' : 'success',
    },
  ];

  const monitoringAlertSummary =
    syncTone === 'error'
      ? {
          tone: 'danger',
          title: 'Gagal memuat data',
          detail: error || 'Terjadi kendala sinkronisasi data dari dashboard live.',
          actionLabel: 'Muat Ulang',
          action: () => loadDashboard(),
        }
      : syncTone === 'warning'
        ? {
            tone: 'warning',
            title: 'Schema production belum sinkron penuh',
            detail: `${schemaWarningSummary} Dashboard tetap berjalan, tetapi beberapa data lanjutan bisa memakai fallback.`,
            actionLabel: 'Refresh',
            action: () => loadDashboard(false),
          }
      : flaggedJobsCount > 0
        ? {
            tone: 'danger',
            title: `${numberFormatter.format(flaggedJobsCount)} lowongan perlu tindakan`,
            detail: 'Ada lowongan pause, nonaktif, atau terlalu lama tanpa pelamar.',
            actionLabel: 'Buka Lowongan',
            action: () => handleSectionChange('lowongan'),
          }
        : recruiterReviewCount > 0 || candidateReviewCount > 0
          ? {
              tone: 'warning',
              title: 'Masih ada akun butuh review',
              detail: `${numberFormatter.format(candidateReviewCount + recruiterReviewCount)} akun perlu diverifikasi atau ditindak.`,
              actionLabel: 'Buka Antrian',
              action: () => handleSectionChange('moderation'),
            }
          : {
              tone: 'success',
              title: 'Platform dalam kondisi sehat',
              detail: 'Tidak ada antrian kritis yang memerlukan intervensi langsung saat ini.',
              actionLabel: 'Refresh',
              action: () => loadDashboard(false),
            };

  const candidateOverviewStats = [
    {
      label: 'Profile ready',
      value: numberFormatter.format(candidateRows.filter((candidate) => candidate.profile_ready).length),
      detail: 'profil siap melamar tanpa hambatan',
    },
    {
      label: 'Need review',
      value: numberFormatter.format(candidateReviewCount),
      detail: 'profil belum lengkap atau akun dibatasi',
    },
    {
      label: '7 hari terakhir',
      value: numberFormatter.format(growth.new_candidates_last_7_days ?? 0),
      detail: 'akun pelamar baru yang masuk',
    },
  ];

  const candidateReviewQueue = candidateRows
    .filter((candidate) => !candidate.profile_ready || candidate.account_status === 'suspended')
    .slice(0, 4);

  const recruiterOverviewStats = [
    {
      label: 'Company ready',
      value: numberFormatter.format(recruiterRows.filter((recruiter) => recruiter.adminStatus.key === 'verified').length),
      detail: 'recruiter sudah diverifikasi admin',
    },
    {
      label: 'Pending verify',
      value: numberFormatter.format(recruiterReviewCount),
      detail: 'akun perlu validasi dokumen company',
    },
    {
      label: 'Rata-rata job',
      value: `${(
        (totals.active_jobs ?? 0) / Math.max(activeRecruitersCount || 1, 1)
      ).toFixed(1)}`,
      detail: 'lowongan aktif per recruiter aktif',
    },
  ];

  const jobsOverviewStats = [
    {
      label: 'Flagged jobs',
      value: numberFormatter.format(flaggedJobsCount),
      detail: 'perlu review atau optimisasi cepat',
    },
    {
      label: 'Active ratio',
      value: `${getProgressValue(totals.active_jobs ?? 0, totals.total_jobs ?? 0)}%`,
      detail: 'persentase lowongan aktif dari total',
    },
    {
      label: 'Applications',
      value: formatCompactNumber(totals.total_applications ?? 0),
      detail: 'total aplikasi yang menempel ke lowongan',
    },
  ];

  const moderationOverviewStats = [
    {
      label: 'Queue total',
      value: numberFormatter.format(filteredModerationReports.length),
      detail: 'item review aktif siap ditangani',
    },
    {
      label: 'Job queue',
      value: numberFormatter.format(moderationReports.filter((report) => report.type === 'job').length),
      detail: 'antrian terkait lowongan',
    },
    {
      label: 'Account queue',
      value: numberFormatter.format(moderationReports.filter((report) => report.type === 'account').length),
      detail: 'antrian terkait candidate dan recruiter',
    },
  ];

  const analyticsCards = [
    {
      label: 'Total Pelamar',
      value: numberFormatter.format(totals.candidates ?? 0),
      detail: `+ ${numberFormatter.format(growth.new_candidates_last_7_days ?? 0)} / 7 hari`,
      badge: getGrowthBadge((growth.new_candidates_last_7_days ?? 0) * 1.8),
      icon: 'candidate',
    },
    {
      label: 'Recruiter Aktif',
      value: numberFormatter.format(activeRecruitersCount),
      detail: `${numberFormatter.format(activeRecruitersCount)} / ${numberFormatter.format(
        totals.recruiters ?? 0
      )}`,
      badge: getGrowthBadge((growth.new_recruiters_last_7_days ?? 0) * 2),
      icon: 'recruiter',
    },
    {
      label: 'Lowongan Aktif',
      value: numberFormatter.format(totals.active_jobs ?? 0),
      detail: `${numberFormatter.format(growth.new_jobs_last_7_days ?? 0)} baru minggu ini`,
      badge: getGrowthBadge(growth.new_jobs_last_7_days ?? 0),
      icon: 'job',
    },
    {
      label: 'Placement Rate',
      value: formatPercentage(placementRate),
      progress: {
        label: 'Placement',
        goal: 'Target: 80%',
        value: placementRate,
      },
      icon: 'trend',
    },
  ];

  const pelamarCards = [
    {
      label: 'Total Pelamar',
      value: numberFormatter.format(totals.candidates ?? 0),
      detail: `+${numberFormatter.format(Math.max(growth.new_candidates_last_7_days ?? 0, 0))} dari 7 hari lalu`,
      detailTone: 'accent',
      icon: 'candidate',
      iconTone: 'default',
      compact: true,
    },
    {
      label: 'Pelamar Aktif',
      value: numberFormatter.format(activeCandidatesCount),
      detail: `${getProgressValue(activeCandidatesCount, totals.candidates ?? 0)}% tingkat retensi`,
      icon: 'check',
      iconTone: 'success',
      compact: true,
    },
    {
      label: 'Lamaran Baru',
      value: numberFormatter.format(growth.new_candidates_last_7_days ?? 0),
      detail: `${numberFormatter.format(candidateReviewCount)} belum ditinjau`,
      detailTone: 'warning',
      icon: 'spark',
      iconTone: 'warning',
      compact: true,
    },
    {
      label: 'Dinonaktifkan',
      value: numberFormatter.format(suspendedCandidatesCount),
      detail: 'Arsip periode ini',
      alert: true,
      detailTone: 'danger',
      icon: 'ban',
      iconTone: 'danger',
      compact: true,
    },
  ];

  const recruiterCards = [
    {
      label: 'Total Recruiter',
      value: numberFormatter.format(totals.recruiters ?? 0),
      detail: `↗ +${Math.max(growth.new_recruiters_last_7_days ?? 0, 0)} bulan ini`,
      detailTone: 'positive',
    },
    {
      label: 'Pending Verifikasi',
      value: numberFormatter.format(
        recruiterRows.filter((recruiter) => recruiter.adminStatus.key === 'review').length
      ),
      detail: 'Butuh tindakan segera',
      detailTone: 'warning',
    },
    {
      label: 'Lowongan Aktif',
      value: numberFormatter.format(totals.active_jobs ?? 0),
      detail: `Rata-rata ${(
        (totals.active_jobs ?? 0) / Math.max(activeRecruitersCount || 1, 1)
      ).toFixed(1)} per perusahaan`,
    },
    {
      label: 'Akun Nonaktif',
      value: numberFormatter.format(suspendedRecruitersCount),
      detail: 'butuh aktivasi ulang atau audit',
      alert: true,
      detailTone: 'danger',
    },
  ];

  const lowonganCards = [
    {
      label: 'Total Lowongan',
      value: numberFormatter.format(totals.total_jobs ?? 0),
      detail: `↗ +${Math.max(growth.new_jobs_last_7_days ?? 0, 0)} bulan ini`,
      detailTone: 'accent',
    },
    {
      label: 'Lowongan Aktif',
      value: numberFormatter.format(totals.active_jobs ?? 0),
      detail: `${getProgressValue(totals.active_jobs ?? 0, totals.total_jobs ?? 0)}% dari total`,
    },
    {
      label: 'Total Pelamar',
      value: formatCompactNumber(totals.total_applications ?? 0),
      detail: `↗ +${formatCompactNumber(growth.new_applications_last_7_days ?? 0)} baru`,
      detailTone: 'accent',
    },
    {
      label: 'Butuh Tindakan',
      value: numberFormatter.format(flaggedJobsCount),
      detail: 'lowongan pause, sepi, atau belum sehat',
      alert: true,
      detailTone: 'danger',
    },
  ];

  const moderationCards = [
    {
      label: 'Total Review',
      value: numberFormatter.format(moderationReports.length),
      detail: 'antrian review aktif',
      detailTone: 'danger',
    },
    {
      label: 'Menunggu Antrian',
      value: numberFormatter.format(filteredModerationReports.length),
      detail: `Prioritas: ${
        filteredModerationReports.length > 8 ? 'Sangat Tinggi' : 'Tinggi'
      }`,
      detailTone: 'warning',
    },
    {
      label: 'Berhasil Ditangani',
      value: `${Math.max(84, 100 - filteredModerationReports.length * 1.4).toFixed(1)}%`,
      detail: `SLA: ${Math.max(2.4, filteredModerationReports.length / 10).toFixed(1)} jam`,
    },
    {
      label: 'Produktivitas Tim',
      value: 'Efisiensi Maksimal',
      detail:
        'Sistem otomatis mendeteksi 85% spam sebelum peninjauan manual.',
      dark: true,
    },
  ];

  const currentSection = SECTION_OPTIONS.find((section) => section.value === activeSection) || SECTION_OPTIONS[0];
  const titleBadge =
    activeSection === 'moderation' ? `${filteredModerationReports.length} PERLU TINJAUAN` : '';
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(getSectionRoute(section));
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate(APP_ROUTES.landing, { replace: true });
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
    } catch (chatError) {
      setFeedback({
        type: 'error',
        message: chatError?.message || 'Percakapan belum berhasil dibuka.',
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
    } catch (chatError) {
      setFeedback({
        type: 'error',
        message: chatError?.message || 'Pesan belum berhasil dikirim.',
      });
    }
  };

  const handleUserStatusToggle = async (account) => {
    const targetStatus = account.account_status === 'active' ? 'suspended' : 'active';

    setUserStatusActionInFlightId(account.id);

    try {
      await AdminService.updateUser(account.id, {
        account_status: targetStatus,
        account_status_reason:
          targetStatus === 'suspended'
            ? 'Akun dinonaktifkan sementara oleh superadmin KerjaNusa.'
            : '',
      });
      await loadDashboard(false);
      setFeedback({
        type: 'success',
        message: `${account.name} sekarang berstatus ${formatAccountStatus(targetStatus).toLowerCase()}.`,
      });
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError?.message || 'Status akun belum berhasil diperbarui.',
      });
    } finally {
      setUserStatusActionInFlightId(null);
    }
  };

  const handleSendResetLink = async (account) => {
    setUserResetActionInFlightId(account.id);

    try {
      await AdminService.sendResetLink(account.id);
      setFeedback({
        type: 'success',
        message: `Link reset password berhasil dikirim ke ${account.email}.`,
      });
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError?.message || 'Link reset password belum berhasil dikirim.',
      });
    } finally {
      setUserResetActionInFlightId(null);
    }
  };

  const handleRecruiterVerificationUpdate = async (recruiter, nextStatus) => {
    setUserStatusActionInFlightId(recruiter.id);

    try {
      await AdminService.updateUser(recruiter.id, {
        verification_status: nextStatus,
        verification_notes:
          nextStatus === 'verified'
            ? ''
            : 'Recruiter dikembalikan ke antrian verifikasi oleh superadmin KerjaNusa.',
      });
      await loadDashboard(false);
      setFeedback({
        type: 'success',
        message:
          nextStatus === 'verified'
            ? `${recruiter.company_name || recruiter.name} ditandai terverifikasi.`
            : `${recruiter.company_name || recruiter.name} dikembalikan ke antrian review.`,
      });
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError?.message || 'Status verifikasi recruiter belum berhasil diperbarui.',
      });
    } finally {
      setUserStatusActionInFlightId(null);
    }
  };

  const handleReassignJob = async (job) => {
    const selectedRecruiterId = jobReassignments[String(job.id)] || '';

    if (!selectedRecruiterId) {
      setFeedback({
        type: 'error',
        message: 'Pilih recruiter tujuan terlebih dahulu.',
      });
      return;
    }

    setJobActionInFlightId(job.id);

    try {
      await AdminService.reassignJob(job.id, Number(selectedRecruiterId));
      await loadDashboard(false);
      setFeedback({
        type: 'success',
        message: `${job.title} berhasil dipindahkan ke recruiter baru.`,
      });
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError?.message || 'Lowongan belum berhasil dipindahkan.',
      });
    } finally {
      setJobActionInFlightId(null);
    }
  };

  const handleJobLifecycleAction = async (job, payload, successMessage) => {
    setJobActionInFlightId(job.id);

    try {
      await AdminService.updateJob(job.id, payload);
      await loadDashboard(false);
      setFeedback({
        type: 'success',
        message: successMessage,
      });
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError?.message || 'Status lowongan belum berhasil diperbarui.',
      });
    } finally {
      setJobActionInFlightId(null);
    }
  };

  const handleExport = (section) => {
    switch (section) {
      case 'monitoring':
        downloadCsv('kerjanusa-monitoring.csv', [
          ['Metric', 'Value', 'Detail'],
          ...monitoringCards.map((card) => [card.label, card.value, card.detail]),
        ]);
        break;
      case 'pelamar':
        downloadCsv('kerjanusa-pelamar.csv', [
          ['Nama', 'Email', 'Posisi Dilamar', 'Status', 'Tanggal Daftar'],
          ...filteredCandidateRows.map((candidate) => [
            candidate.name,
            candidate.email,
            candidate.position,
            candidate.adminStatus.label,
            candidate.dateLabel,
          ]),
        ]);
        break;
      case 'recruiter':
        downloadCsv('kerjanusa-recruiter.csv', [
          ['Perusahaan', 'Email', 'Lokasi', 'Lowongan', 'Status'],
          ...filteredRecruiterRows.map((recruiter) => [
            recruiter.company_name || recruiter.name,
            recruiter.email,
            recruiter.locationLabel,
            recruiter.active_jobs_count ?? 0,
            recruiter.adminStatus.label,
          ]),
        ]);
        break;
      case 'analytics':
        downloadCsv('kerjanusa-analytics.csv', [
          ['Metric', 'Value'],
          ...analyticsCards.map((card) => [card.label, card.value]),
        ]);
        break;
      default:
        downloadCsv('kerjanusa-lowongan.csv', [
          ['Judul', 'Perusahaan', 'Lamaran', 'Status'],
          ...sortedJobRows.map((job) => [
            job.title,
            job.companyLabel,
            job.applications_count ?? 0,
            job.adminStatus.label,
          ]),
        ]);
        break;
    }
  };

  const handleModerationAction = async (report, action) => {
    if (action === 'ignore') {
      setDismissedModerationKeys((current) =>
        current.includes(report.key) ? current : [...current, report.key]
      );
      setFeedback({
        type: 'success',
        message: `${report.title} disembunyikan untuk sesi admin saat ini.`,
      });
      return;
    }

    if (action === 'review') {
      if (report.type === 'job') {
        handleSectionChange('lowongan');
        setSelectedOptimizationJobId(report.targetId);
      } else if (report.entity === 'recruiter') {
        handleSectionChange('recruiter');
        setSelectedRecruiterId(report.targetId);
      } else {
        handleSectionChange('pelamar');
        setSelectedCandidateId(report.targetId);
      }

      setFeedback({
        type: 'success',
        message: `${report.title} dibuka untuk tindak lanjut admin.`,
      });
      return;
    }

    if (action === 'suspend' && report.type === 'job' && report.jobAction) {
      await handleJobLifecycleAction(
        { id: report.targetId, title: report.title.replace(/^Lowongan:\s*/, '') },
        report.jobAction,
        report.jobAction.status === 'active'
          ? `${report.title} diaktifkan kembali.`
          : `${report.title} dipause dari panel moderasi.`
      );
      return;
    }

    if (action === 'suspend' && report.accountAction) {
      await handleUserStatusToggle(report.accountAction);
      return;
    }

    setFeedback({
      type: 'error',
      message: 'Aksi ini belum bisa dijalankan langsung dari panel moderasi.',
    });
  };

  const renderFeedback = () =>
    feedback ? (
      <div className={`superadmin-feedback is-${feedback.type}`}>{feedback.message}</div>
    ) : null;

  const renderHeaderAside = () => {
    if (activeSection === 'analytics') {
      return (
        <div className="superadmin-header-actions is-analytics">
          <button type="button" className="superadmin-chip-button">
            <AdminIcon name="calendar" />
            {analyticsPeriodLabel}
          </button>
          <button
            type="button"
            className="superadmin-primary-button is-dark"
            onClick={() => handleExport('analytics')}
          >
            <AdminIcon name="download" />
            Export Report
          </button>
          <div className="superadmin-analytics-header-user">
            <strong>{user?.name || 'Superadmin KerjaNusa'}</strong>
          </div>
        </div>
      );
    }

    if (activeSection === 'moderation') {
      return (
        <div className="superadmin-header-actions">
          <label className="superadmin-search-chip">
            <AdminIcon name="search" />
            <input
              type="search"
              placeholder="Cari antrian review..."
              value={moderationSearchQuery}
              onChange={(event) => setModerationSearchQuery(event.target.value)}
            />
          </label>
        </div>
      );
    }

    return (
      <div className="superadmin-header-user">
        <div className="superadmin-header-user-meta">
          <strong>{user?.name || 'Nama Superadmin'}</strong>
        </div>
        <div className="superadmin-avatar-badge">{getInitials(user?.name)}</div>
      </div>
    );
  };

  const renderMonitoring = () => {
    return (
      <section className="superadmin-section-block superadmin-monitoring-section">
        <div className="superadmin-monitoring-toolbar">
          <div className="superadmin-monitoring-toolbar-left">
            <button type="button" className="superadmin-primary-button" onClick={() => loadDashboard()}>
              <AdminIcon name="reset" />
              Refresh
            </button>
            <button
              type="button"
              className="superadmin-secondary-button"
              onClick={() => handleExport('monitoring')}
            >
              <AdminIcon name="download" />
              Export
            </button>
          </div>
          <div className="superadmin-monitoring-toolbar-right">
            <span
              className={`superadmin-monitoring-platform-chip is-${
                syncTone === 'error' ? 'danger' : syncTone === 'warning' ? 'warning' : 'success'
              }`}
            >
              <i />
              {syncTone === 'error'
                ? 'Platform Warning'
                : syncTone === 'warning'
                  ? 'Platform Fallback'
                  : 'Platform Online'}
            </span>
            <small>Last update: {lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Belum tersinkron'}</small>
          </div>
        </div>

        <div className="superadmin-monitoring-layout">
          <div className="superadmin-monitoring-primary">
            <div className="superadmin-monitoring-kpis">
              <SectionMetrics cards={monitoringCards} />
            </div>

            <article className="superadmin-panel superadmin-monitoring-map-panel">
              <MonitoringIndonesiaMap
                points={monitoringLocationMap.points}
                selectedPointKey={selectedMonitoringMapKey}
                onSelectPoint={setSelectedMonitoringMapKey}
                unmappedLocations={monitoringLocationMap.unmappedLocations}
                formatDateTime={formatDateTime}
              />
            </article>

            <article className="superadmin-panel superadmin-monitoring-logpanel">
              <div className="superadmin-panel-head">
                <div>
                  <h3>Log Aktivitas Terbaru</h3>
                </div>
                <div className="superadmin-monitoring-loghead">
                  <label className="superadmin-search-input is-monitoring">
                    <AdminIcon name="search" />
                    <input
                      type="search"
                      placeholder="Cari aktivitas..."
                      value={monitoringSearchQuery}
                      onChange={(event) => setMonitoringSearchQuery(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="superadmin-inline-link"
                    onClick={() => handleSectionChange('moderation')}
                  >
                    Semua
                  </button>
                </div>
              </div>

              <div className="superadmin-table-wrap">
                <table className="superadmin-table superadmin-table-monitoring">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Entitas</th>
                      <th>Aktivitas</th>
                      <th>Status</th>
                      <th>Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonitoringActivityRows.length === 0 ? (
                      <tr>
                        <td colSpan="5">
                          <div className="superadmin-empty-state is-panel">
                            <div className="superadmin-empty-icon">⌁</div>
                            <p>Belum ada data aktivitas.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMonitoringActivityRows.map((entry) => (
                        <tr key={entry.key}>
                          <td className="superadmin-cell-date">{formatDateShort(entry.timestamp)}</td>
                          <td>{entry.entity}</td>
                          <td>{entry.title}</td>
                          <td>
                            <span
                              className={`superadmin-status-tag is-${
                                entry.status === 'Aktif'
                                  ? 'success'
                                  : entry.status === 'Review'
                                    ? 'warning'
                                    : 'active-soft'
                              }`}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td>{entry.admin}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <div className="superadmin-monitoring-sidebar">
            <article className="superadmin-panel superadmin-monitoring-health-panel">
              <div className="superadmin-panel-head">
                <div>
                  <h3>Alerts &amp; Health</h3>
                </div>
              </div>

              <div className={`superadmin-monitoring-alertbox is-${monitoringAlertSummary.tone}`}>
                <strong>{monitoringAlertSummary.title}</strong>
                <p>{monitoringAlertSummary.detail}</p>
                <button type="button" onClick={monitoringAlertSummary.action}>
                  {monitoringAlertSummary.actionLabel}
                </button>
              </div>

              <div className="superadmin-monitoring-healthlist">
                {monitoringHealthCards.map((item) => (
                  <article key={item.label} className="superadmin-monitoring-healthrow">
                    <div className="superadmin-monitoring-healthcopy">
                      <span className="superadmin-monitoring-healthrow-label">{item.label}</span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <span className={`superadmin-inline-badge is-${item.status}`}>
                      {item.status === 'danger'
                        ? 'Issue'
                        : item.status === 'warning'
                          ? 'Review'
                          : 'Healthy'}
                    </span>
                  </article>
                ))}
              </div>
            </article>

            <article className="superadmin-panel superadmin-monitoring-actions-panel">
              <div className="superadmin-panel-head">
                <div>
                  <h3>Quick Controls</h3>
                </div>
              </div>

              <div className="superadmin-monitoring-control-list">
                {monitoringQuickActions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`superadmin-monitoring-control-item${item.tone ? ` is-${item.tone}` : ''}`}
                    onClick={item.action}
                  >
                    <span className="superadmin-monitoring-control-copy">
                      <div>
                        <small>{item.label}</small>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </span>
                    <span className="superadmin-monitoring-control-arrow">›</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="superadmin-panel superadmin-monitoring-screening-panel">
              <div className="superadmin-panel-head">
                <div>
                  <h3>Registrasi & Screening</h3>
                </div>
              </div>

              <div className="superadmin-list-stack">
                <article className="superadmin-list-item">
                  <div className="superadmin-list-dot is-warning" />
                  <div>
                    <strong>Profil kandidat belum selesai</strong>
                    <p>
                      {numberFormatter.format(
                        screeningOverview.candidate_profiles_incomplete ?? 0
                      )}{' '}
                      akun perlu dilengkapi sebelum siap discreening.
                    </p>
                  </div>
                </article>
                <article className="superadmin-list-item">
                  <div className="superadmin-list-dot is-success" />
                  <div>
                    <strong>Video screening masuk</strong>
                    <p>
                      {numberFormatter.format(
                        screeningOverview.applications_with_video_screening ?? 0
                      )}{' '}
                      lamaran sudah mengirim video intro.
                    </p>
                  </div>
                </article>
                <article className="superadmin-list-item">
                  <div className="superadmin-list-dot is-active-soft" />
                  <div>
                    <strong>Jawaban screening terkumpul</strong>
                    <p>
                      {numberFormatter.format(
                        screeningOverview.applications_with_screening_answers ?? 0
                      )}{' '}
                      lamaran punya jawaban screening.
                    </p>
                  </div>
                </article>
                <article className="superadmin-list-item">
                  <div className="superadmin-list-dot is-danger" />
                  <div>
                    <strong>Lowongan aktif belum di-notice recruiter</strong>
                    <p>
                      {numberFormatter.format(
                        screeningOverview.jobs_waiting_recruiter_notice ?? 0
                      )}{' '}
                      lowongan aktif belum bergerak.
                    </p>
                  </div>
                </article>
              </div>

              <div className="superadmin-detail-block">
                <label>Distribusi Paket Recruiter</label>
                <div className="workspace-inline-metadata">
                  {(screeningOverview.recruiter_plan_distribution || []).map((item) => (
                    <span key={item.plan_code}>
                      {item.label}: {numberFormatter.format(item.total || 0)}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    );
  };

  const renderCandidateManagement = () => (
    <section className="superadmin-section-block superadmin-entity-section superadmin-candidate-section">
      <div className="superadmin-section-metrics-wrap superadmin-candidate-metrics-wrap">
        <SectionMetrics cards={pelamarCards} />
      </div>

      <article className="superadmin-panel superadmin-table-panel is-candidate superadmin-management-table-card superadmin-candidate-table-card">
        <div className="superadmin-toolbar superadmin-toolbar-compact superadmin-candidate-toolbar">
          <label className="superadmin-search-input superadmin-candidate-search">
            <AdminIcon name="search" />
            <input
              type="search"
              placeholder="Cari nama pelamar atau posisi..."
              value={candidateSearchQuery}
              onChange={(event) => setCandidateSearchQuery(event.target.value)}
            />
          </label>

          <div className="superadmin-toolbar-actions">
            <select
              className="superadmin-filter-select"
              value={candidateStatusFilter}
              onChange={(event) => setCandidateStatusFilter(event.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="review">Menunggu</option>
              <option value="suspended">Dinonaktifkan</option>
            </select>
            <button
              type="button"
              className="superadmin-secondary-button superadmin-candidate-export"
              onClick={() => handleExport('pelamar')}
            >
              <AdminIcon name="download" />
              Ekspor CSV
            </button>
          </div>
        </div>

        <div className="superadmin-table-wrap">
          <table className="superadmin-table superadmin-table-candidate superadmin-candidate-table-modern">
            <thead>
              <tr>
                <th>Pelamar</th>
                <th>Posisi Terakhir</th>
                <th>Status</th>
                <th>Tanggal Daftar</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleCandidateRows.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="superadmin-table-empty">Belum ada data pelamar yang cocok.</div>
                  </td>
                </tr>
              ) : (
                visibleCandidateRows.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className={Number(selectedCandidate?.id) === Number(candidate.id) ? 'is-selected' : ''}
                  >
                    <td>
                      <div className="superadmin-person-cell">
                        <div className="superadmin-person-avatar">{candidate.initials}</div>
                        <div>
                          <strong>{candidate.name}</strong>
                          <span>{candidate.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="superadmin-candidate-position-cell">{candidate.position}</td>
                    <td>
                      <span className={`superadmin-status-tag is-${candidate.adminStatus.tone}`}>
                        {candidate.adminStatus.label}
                      </span>
                    </td>
                    <td className="superadmin-cell-date">{candidate.dateLabel}</td>
                    <td>
                      <div className="superadmin-icon-actions superadmin-candidate-actions">
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title="Lihat detail kandidat"
                          onClick={() => setSelectedCandidateId(candidate.id)}
                        >
                          <AdminIcon name="eye" />
                        </button>
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title="Kirim reset password"
                          onClick={() => handleSendResetLink(candidate)}
                          disabled={userResetActionInFlightId === candidate.id}
                        >
                          <AdminIcon name="reset" />
                        </button>
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title={
                            candidate.account_status === 'active'
                              ? 'Suspend akun'
                              : 'Aktifkan akun'
                          }
                          onClick={() => handleUserStatusToggle(candidate)}
                          disabled={userStatusActionInFlightId === candidate.id}
                        >
                          <AdminIcon
                            name={candidate.account_status === 'active' ? 'ban' : 'check'}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          label={`Menampilkan ${
            filteredCandidateRows.length === 0 ? 0 : (candidatePage - 1) * PAGE_SIZE + 1
          }-${Math.min(candidatePage * PAGE_SIZE, filteredCandidateRows.length)} dari ${numberFormatter.format(
            filteredCandidateRows.length
          )} pelamar`}
          page={candidatePage}
          totalItems={filteredCandidateRows.length}
          onPageChange={setCandidatePage}
        />
      </article>

      <div className="superadmin-two-column superadmin-candidate-bottom">
        <article className="superadmin-panel superadmin-management-side-panel superadmin-candidate-detail-panel">
          {selectedCandidate ? (
            <div className="superadmin-candidate-profile-card">
              <div className="superadmin-candidate-profile-head">
                <div className="superadmin-detail-identity">
                  <div className="superadmin-person-avatar">{selectedCandidate.initials}</div>
                  <div>
                    <strong>{selectedCandidate.name}</strong>
                    <span>{selectedCandidate.email}</span>
                  </div>
                </div>
              </div>

              <div className="superadmin-candidate-profile-grid">
                <div>
                  <label>Status Lamaran</label>
                  <span className={`superadmin-status-tag is-${selectedCandidate.adminStatus.tone}`}>
                    {selectedCandidate.adminStatus.label === 'Diblokir'
                      ? 'Dinonaktifkan'
                      : selectedCandidate.adminStatus.label === 'Aktif'
                        ? 'Aktif'
                        : 'Menunggu Review'}
                  </span>
                </div>
                <div>
                  <label>Posisi Terakhir</label>
                  <strong>{selectedCandidate.position}</strong>
                </div>
                <div>
                  <label>Tahap Lamaran</label>
                  <strong>
                    {selectedCandidate.latest_application_stage
                      ? formatApplicationStage(selectedCandidate.latest_application_stage)
                      : 'Belum melamar posisi spesifik'}
                  </strong>
                </div>
                <div>
                  <label>Resume / Portofolio</label>
                  <strong>{selectedCandidate.resume_files_count || 0} file diunggah</strong>
                </div>
                <div>
                  <label>Preferensi Role</label>
                  <strong>{selectedCandidate.preferredRolesLabel}</strong>
                </div>
                <div>
                  <label>Preferensi Lokasi</label>
                  <strong>{selectedCandidate.preferredLocationsLabel}</strong>
                </div>
              </div>

              <div className="superadmin-candidate-summary-block">
                <label>Ringkasan Profil & Skill Utama</label>
                <div className="superadmin-candidate-summary-box">
                  <p>
                    {selectedCandidate.profile_summary ||
                      'Informasi profil belum dilengkapi oleh pelamar.'}
                  </p>
                  <small>{selectedCandidate.skillsLabel}</small>
                  <button
                    type="button"
                    className="superadmin-secondary-button superadmin-candidate-remind"
                    onClick={() => handleSendResetLink(selectedCandidate)}
                    disabled={userResetActionInFlightId === selectedCandidate.id}
                  >
                    {userResetActionInFlightId === selectedCandidate.id
                      ? 'Mengirim...'
                      : 'Ingatkan Pelamar'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="superadmin-empty-state is-panel">
              <div className="superadmin-empty-icon">⌁</div>
              <p>Belum ada pelamar yang bisa ditinjau.</p>
            </div>
          )}
        </article>

        <article className="superadmin-panel superadmin-management-side-panel superadmin-candidate-queue-panel">
          <div className="superadmin-panel-head">
            <div>
              <h3>Antrian Review Pelamar</h3>
              <p>{numberFormatter.format(candidateReviewQueue.length)} pelamar membutuhkan tindakan segera</p>
            </div>
          </div>
          <div className="superadmin-list-stack">
            {candidateReviewQueue.length === 0 ? (
              <p className="superadmin-inline-empty">Semua pelamar utama berada dalam status aman.</p>
            ) : (
              candidateReviewQueue.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`superadmin-queue-item superadmin-candidate-queue-item${
                    Number(selectedCandidate?.id) === Number(candidate.id) ? ' is-active' : ''
                  }`}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                >
                  <div>
                    <strong>{candidate.name}</strong>
                    <span>{candidate.position}</span>
                  </div>
                  <span className={`superadmin-status-tag is-${candidate.adminStatus.tone}`}>
                    {candidate.adminStatus.label}
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="superadmin-secondary-button superadmin-candidate-queue-button"
            onClick={() => {
              setCandidateStatusFilter('review');
              setCandidatePage(1);
            }}
          >
            Lihat Semua Antrian
          </button>
        </article>
      </div>
    </section>
  );

  const renderRecruiterManagement = () => (
    <section className="superadmin-section-block superadmin-entity-section superadmin-recruiter-section">
      <div className="superadmin-section-metrics-wrap">
        <SectionMetrics cards={recruiterCards} />
      </div>

      <article className="superadmin-panel superadmin-table-panel superadmin-management-table-card">
        <div className="superadmin-toolbar">
          <label className="superadmin-search-input">
            <AdminIcon name="search" />
            <input
              type="search"
              placeholder="Cari nama perusahaan atau lokasi..."
              value={recruiterSearchQuery}
              onChange={(event) => setRecruiterSearchQuery(event.target.value)}
            />
          </label>

          <div className="superadmin-toolbar-actions">
            <select
              className="superadmin-filter-select"
              value={recruiterStatusFilter}
              onChange={(event) => setRecruiterStatusFilter(event.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="verified">Terverifikasi</option>
              <option value="review">Menunggu</option>
              <option value="suspended">Nonaktif</option>
            </select>
            <button
              type="button"
              className="superadmin-primary-button is-dark"
              onClick={() => handleExport('recruiter')}
            >
              <AdminIcon name="download" />
              Ekspor Data
            </button>
          </div>
        </div>

        <div className="superadmin-table-wrap">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Perusahaan</th>
                <th>Lokasi</th>
                <th>Lowongan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecruiterRows.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="superadmin-table-empty">Belum ada recruiter yang cocok.</div>
                  </td>
                </tr>
              ) : (
                visibleRecruiterRows.map((recruiter) => (
                  <tr
                    key={recruiter.id}
                    className={Number(selectedRecruiter?.id) === Number(recruiter.id) ? 'is-selected' : ''}
                  >
                    <td>
                      <div className="superadmin-company-cell">
                        <div className="superadmin-company-logo">{recruiter.initials}</div>
                        <div>
                          <strong>{recruiter.company_name || recruiter.name}</strong>
                          <span>{recruiter.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{recruiter.locationLabel}</td>
                    <td>{numberFormatter.format(recruiter.active_jobs_count ?? 0)}</td>
                    <td>
                      <span className={`superadmin-status-tag is-${recruiter.adminStatus.tone}`}>
                        {recruiter.adminStatus.label}
                      </span>
                    </td>
                    <td>
                      <div className="superadmin-icon-actions">
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title="Lihat detail recruiter"
                          onClick={() => setSelectedRecruiterId(recruiter.id)}
                        >
                          <AdminIcon name="eye" />
                        </button>
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title={
                            recruiter.adminStatus.key === 'verified'
                              ? 'Kembalikan ke review'
                              : 'Tandai terverifikasi'
                          }
                          onClick={() =>
                            handleRecruiterVerificationUpdate(
                              recruiter,
                              recruiter.adminStatus.key === 'verified' ? 'pending' : 'verified'
                            )
                          }
                          disabled={userStatusActionInFlightId === recruiter.id}
                        >
                          <AdminIcon
                            name={recruiter.adminStatus.key === 'verified' ? 'clock' : 'check'}
                          />
                        </button>
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title={
                            recruiter.account_status === 'active'
                              ? 'Suspend akun recruiter'
                              : 'Aktifkan akun recruiter'
                          }
                          onClick={() => handleUserStatusToggle(recruiter)}
                          disabled={userStatusActionInFlightId === recruiter.id}
                        >
                          <AdminIcon
                            name={recruiter.account_status === 'active' ? 'ban' : 'check'}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          label={`Menampilkan ${
            filteredRecruiterRows.length === 0 ? 0 : (recruiterPage - 1) * PAGE_SIZE + 1
          }-${Math.min(recruiterPage * PAGE_SIZE, filteredRecruiterRows.length)} dari ${numberFormatter.format(
            filteredRecruiterRows.length
          )} recruiter`}
          page={recruiterPage}
          totalItems={filteredRecruiterRows.length}
          onPageChange={setRecruiterPage}
        />
      </article>

      <div className="superadmin-two-column">
        <article className="superadmin-panel superadmin-management-side-panel">
          <div className="superadmin-panel-head">
            <div>
              <h3>Detail Recruiter</h3>
            </div>
          </div>

          {selectedRecruiter ? (
            <div className="superadmin-detail-card">
              <div className="superadmin-detail-identity">
                <div className="superadmin-company-logo">{selectedRecruiter.initials}</div>
                <div>
                  <strong>{selectedRecruiter.company_name || selectedRecruiter.name}</strong>
                  <span>{selectedRecruiter.email}</span>
                </div>
              </div>

              <div className="superadmin-detail-grid">
                <div>
                  <label>Status</label>
                  <span className={`superadmin-status-tag is-${selectedRecruiter.adminStatus.tone}`}>
                    {selectedRecruiter.adminStatus.label}
                  </span>
                </div>
                <div>
                  <label>Nama PIC</label>
                  <strong>{selectedRecruiter.recruiterNameLabel}</strong>
                </div>
                <div>
                  <label>Email Perusahaan</label>
                  <strong>{selectedRecruiter.companyEmailLabel}</strong>
                </div>
                <div>
                  <label>Alamat</label>
                  <strong>{selectedRecruiter.locationLabel}</strong>
                </div>
                <div>
                  <label>Nama Legal</label>
                  <strong>{selectedRecruiter.legal_company_name || 'Belum diisi'}</strong>
                </div>
                <div>
                  <label>Industri</label>
                  <strong>{selectedRecruiter.industryLabel}</strong>
                </div>
                <div>
                  <label>Jumlah Pegawai</label>
                  <strong>{selectedRecruiter.employeeRangeLabel}</strong>
                </div>
                <div>
                  <label>Lowongan Aktif</label>
                  <strong>{numberFormatter.format(selectedRecruiter.active_jobs_count ?? 0)}</strong>
                </div>
                <div>
                  <label>Link Company</label>
                  <strong>{selectedRecruiter.companyLinkLabel}</strong>
                </div>
                <div>
                  <label>Paket Recruiter</label>
                  <strong>{selectedRecruiter.label || 'Starter'}</strong>
                </div>
                <div>
                  <label>KN Credit</label>
                  <strong>{numberFormatter.format(selectedRecruiter.kn_credit ?? 0)}</strong>
                </div>
                <div>
                  <label>Lowongan Terakhir</label>
                  <strong>{selectedRecruiter.latest_job_title || 'Belum ada lowongan'}</strong>
                </div>
              </div>

              <div className="superadmin-detail-block">
                <label>Deskripsi Company</label>
                <p>{selectedRecruiter.company_description || 'Deskripsi company belum lengkap.'}</p>
              </div>

              <div className="superadmin-detail-block">
                <label>Dokumen Legal</label>
                <p>
                  {selectedRecruiter.company_legal_document_name
                    ? `${selectedRecruiter.company_legal_document_name}${
                        selectedRecruiter.company_legal_document_uploaded_at
                          ? ` • Diunggah ${formatDateShort(selectedRecruiter.company_legal_document_uploaded_at)}`
                          : ''
                      }`
                    : 'Dokumen legal perusahaan belum diunggah.'}
                </p>
              </div>

              <div className="superadmin-detail-block">
                <label>Catatan Verifikasi</label>
                <p>
                  {selectedRecruiter.verification_notes ||
                    (selectedRecruiter.adminStatus.key === 'verified'
                      ? selectedRecruiter.verified_at
                        ? `Diverifikasi pada ${formatDateShort(selectedRecruiter.verified_at)}.`
                        : 'Recruiter telah diverifikasi oleh admin.'
                      : selectedRecruiter.verification_submitted_at
                        ? `Data diajukan pada ${formatDateShort(selectedRecruiter.verification_submitted_at)} dan sedang menunggu review.`
                      : 'Belum ada catatan verifikasi khusus.')}
                </p>
              </div>

              <div className="superadmin-detail-actions">
                <button
                  type="button"
                  className="superadmin-primary-button"
                  onClick={() =>
                    handleRecruiterVerificationUpdate(
                      selectedRecruiter,
                      selectedRecruiter.adminStatus.key === 'verified' ? 'pending' : 'verified'
                    )
                  }
                  disabled={userStatusActionInFlightId === selectedRecruiter.id}
                >
                  {selectedRecruiter.adminStatus.key === 'verified'
                    ? 'Kembalikan ke Review'
                    : 'Verifikasi Sekarang'}
                </button>
                <button
                  type="button"
                  className="superadmin-secondary-button"
                  onClick={() => handleSendResetLink(selectedRecruiter)}
                  disabled={userResetActionInFlightId === selectedRecruiter.id}
                >
                  Kirim Reset Password
                </button>
              </div>
            </div>
          ) : (
            <div className="superadmin-empty-state is-panel">
              <div className="superadmin-empty-icon">⌁</div>
              <p>Belum ada recruiter yang bisa ditinjau.</p>
            </div>
          )}
        </article>

        <article className="superadmin-panel superadmin-management-side-panel">
          <div className="superadmin-panel-head">
            <div>
              <h3>Aktivitas Verifikasi Terakhir</h3>
            </div>
            <button type="button" className="superadmin-inline-link">
              Lihat Semua
            </button>
          </div>
          <div className="superadmin-list-stack">
            {recruiterVerificationActivities.map((item) => (
              <article key={item.key} className="superadmin-list-item">
                <div className={`superadmin-list-icon is-${item.tone}`}>
                  <AdminIcon
                    name={
                      item.tone === 'success' ? 'check' : item.tone === 'danger' ? 'ban' : 'clock'
                    }
                  />
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>{item.timestamp}</small>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );

  const renderJobManagement = () => (
    <section className="superadmin-section-block superadmin-entity-section superadmin-job-section">
      <div className="superadmin-section-metrics-wrap">
        <SectionMetrics cards={lowonganCards} />
      </div>

      <article className="superadmin-panel superadmin-table-panel superadmin-management-table-card">
        <div className="superadmin-toolbar superadmin-toolbar-wide">
          <div className="superadmin-toolbar-left">
            <label className="superadmin-search-input">
              <AdminIcon name="search" />
              <input
                type="search"
                placeholder="Cari judul lowongan atau perusahaan..."
                value={jobSearchQuery}
                onChange={(event) => setJobSearchQuery(event.target.value)}
              />
            </label>
            <select
              className="superadmin-filter-select"
              value={jobStatusFilter}
              onChange={(event) => setJobStatusFilter(event.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="flagged">Butuh Tindakan</option>
              <option value="active">Aktif</option>
              <option value="paused">Pause</option>
              <option value="closed">Closed / Filled</option>
              <option value="empty">Tanpa Pelamar</option>
            </select>
          </div>

          <div className="superadmin-toolbar-right">
            <span>Urutkan:</span>
            <select
              className="superadmin-filter-select is-compact"
              value={jobSortOrder}
              onChange={(event) => setJobSortOrder(event.target.value)}
            >
              <option value="latest">Terbaru</option>
              <option value="applications">Pelamar terbanyak</option>
            </select>
          </div>
        </div>

        <div className="superadmin-table-wrap">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Judul Lowongan</th>
                <th>Perusahaan</th>
                <th>Jumlah Pelamar</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobRows.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="superadmin-table-empty">Belum ada lowongan yang cocok.</div>
                  </td>
                </tr>
              ) : (
                visibleJobRows.map((job) => (
                  <tr key={job.id} className={job.isFlagged ? 'is-flagged' : ''}>
                    <td>
                      <div className="superadmin-job-title-cell">
                        <strong>{job.title}</strong>
                        <span>Post: {job.postedAtLabel}</span>
                        {job.isFlagged && <em>{job.reviewReason}</em>}
                      </div>
                    </td>
                    <td>
                      <div className="superadmin-company-inline">
                        <div className="superadmin-company-thumb">{getInitials(job.companyLabel)}</div>
                        <div>{job.companyLabel}</div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`superadmin-count-pill${
                          job.isFlagged ? ' is-danger' : ''
                        }`}
                      >
                        {numberFormatter.format(job.applications_count ?? 0)}
                      </span>
                    </td>
                    <td>
                      <span className={`superadmin-status-inline is-${job.adminStatus.tone}`}>
                        <i />
                        {job.adminStatus.label}
                      </span>
                    </td>
                    <td>
                      <div className="superadmin-job-actions">
                        <button
                          type="button"
                          className="superadmin-icon-button"
                          title="Pilih untuk rekomendasi reassign"
                          onClick={() => setSelectedOptimizationJobId(job.id)}
                        >
                          <AdminIcon name="switch" />
                        </button>

                        {job.adminStatus.key === 'active' ? (
                          <button
                            type="button"
                            className="superadmin-icon-button"
                            title="Pause lowongan"
                            onClick={() =>
                              handleJobLifecycleAction(
                                job,
                                { status: 'inactive', workflow_status: 'paused' },
                                `${job.title} dipause dari panel lowongan.`
                              )
                            }
                            disabled={jobActionInFlightId === job.id}
                          >
                            <AdminIcon name="ban" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={job.isFlagged ? 'superadmin-danger-button is-inline' : 'superadmin-icon-button'}
                            title="Aktifkan kembali lowongan"
                            onClick={() =>
                              handleJobLifecycleAction(
                                job,
                                { status: 'active', workflow_status: 'active' },
                                `${job.title} diaktifkan kembali.`
                              )
                            }
                            disabled={jobActionInFlightId === job.id}
                          >
                            {job.isFlagged ? 'Aktifkan Lagi' : <AdminIcon name="check" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          label={`Menampilkan ${
            sortedJobRows.length === 0 ? 0 : (jobPage - 1) * PAGE_SIZE + 1
          }-${Math.min(jobPage * PAGE_SIZE, sortedJobRows.length)} dari ${numberFormatter.format(
            sortedJobRows.length
          )} lowongan`}
          page={jobPage}
          totalItems={sortedJobRows.length}
          onPageChange={setJobPage}
        />
      </article>

      <div className="superadmin-two-column superadmin-two-column-heavy">
        <article className="superadmin-panel superadmin-management-side-panel superadmin-optimization-card">
          <span className="superadmin-panel-eyebrow">Optimisasi Penempatan Lowongan</span>
          <h3>Prioritaskan lowongan yang rasio pelamarnya rendah</h3>
          <p>
            Sistem mendeteksi lowongan yang memiliki rasio pelamar rendah. Pertimbangkan untuk
            memindahkan lowongan ini ke recruiter specialist yang lebih sesuai.
          </p>

          {selectedOptimizationJob ? (
            <div className="superadmin-optimization-form">
              <label className="superadmin-field-label">
                Lowongan prioritas
                <select
                  value={String(selectedOptimizationJob.id)}
                  onChange={(event) => setSelectedOptimizationJobId(Number(event.target.value))}
                >
                  {jobRows.map((job) => (
                    <option key={job.id} value={String(job.id)}>
                      {job.title} • {job.companyLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="superadmin-field-label">
                Recruiter tujuan
                <select
                  value={jobReassignments[String(selectedOptimizationJob.id)] || ''}
                  onChange={(event) =>
                    setJobReassignments((current) => ({
                      ...current,
                      [String(selectedOptimizationJob.id)]: event.target.value,
                    }))
                  }
                >
                  <option value="">Pilih recruiter aktif</option>
                  {recruiterOptions.map((recruiter) => (
                    <option key={recruiter.id} value={String(recruiter.id)}>
                      {recruiter.company_name || recruiter.name} ({recruiter.email})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="superadmin-primary-button"
                onClick={() => handleReassignJob(selectedOptimizationJob)}
                disabled={jobActionInFlightId === selectedOptimizationJob.id}
              >
                {jobActionInFlightId === selectedOptimizationJob.id
                  ? 'Memindahkan...'
                  : 'Lihat Rekomendasi'}
              </button>
            </div>
          ) : (
            <p className="superadmin-empty-copy">Belum ada lowongan untuk dioptimalkan.</p>
          )}
        </article>

        <article className="superadmin-panel superadmin-management-side-panel">
          <div className="superadmin-panel-head">
            <div>
              <h3>Log Aktivitas Terbaru</h3>
            </div>
          </div>
          <div className="superadmin-list-stack">
            {lowonganActivityLogs.map((item) => (
              <article key={item.key} className="superadmin-list-item">
                <div className={`superadmin-list-dot is-${item.tone}`} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>{item.timestamp}</small>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );

  const renderAnalytics = () => (
    <section className="superadmin-section-block superadmin-analytics-section">
      <div className="superadmin-analytics-metrics">
        {analyticsCards.map((card) => (
          <article
            key={card.label}
            className={`superadmin-panel superadmin-analytics-metric-card${
              card.progress ? ' is-placement' : ''
            }`}
          >
            {!card.progress ? (
              <>
                <div className="superadmin-analytics-metric-head">
                  <span>{card.label}</span>
                  <AdminIcon name={card.icon || 'analytics'} />
                </div>
                <strong>{card.value}</strong>
                <div className="superadmin-analytics-metric-foot">
                  <small className={`is-${card.badge?.tone || 'positive'}`}>{card.badge?.label}</small>
                  <span>{card.detail}</span>
                </div>
              </>
            ) : (
              <div className="superadmin-analytics-placement-card">
                <div
                  className="superadmin-analytics-rate-ring"
                  style={{
                    background: `conic-gradient(#a56d09 0deg ${placementRate * 3.6}deg, #ece7eb ${
                      placementRate * 3.6
                    }deg 360deg)`,
                  }}
                >
                  <div className="superadmin-analytics-rate-ring-inner">{Math.round(placementRate)}%</div>
                </div>
                <div className="superadmin-analytics-placement-copy">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.progress.goal}</small>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="superadmin-analytics-grid">
        <article className="superadmin-panel superadmin-chart-panel is-analytics">
          <div className="superadmin-panel-head">
            <div>
              <h3>Pertumbuhan Pengguna</h3>
              <p>Data harian pelamar vs recruiter baru</p>
            </div>
            <div className="superadmin-chart-legend">
              <span>
                <i className="is-navy" /> Pelamar
              </span>
              <span>
                <i className="is-orange" /> Recruiter
              </span>
            </div>
          </div>

          <div className="superadmin-line-chart">
            <svg viewBox="0 0 640 260" aria-hidden="true">
              {[0, 1, 2, 3].map((lineIndex) => (
                <line
                  key={lineIndex}
                  x1="22"
                  y1={46 + lineIndex * 52}
                  x2="618"
                  y2={46 + lineIndex * 52}
                  className="superadmin-chart-gridline"
                />
              ))}
              <path d={candidateAnalyticsPath} className="superadmin-chart-line is-navy" />
              <path d={recruiterAnalyticsPath} className="superadmin-chart-line is-orange is-dashed" />
            </svg>
            <div className="superadmin-chart-months">
              {analyticsDayLabels.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
          </div>
        </article>

        <aside className="superadmin-panel superadmin-analytics-health-panel">
          <div className="superadmin-panel-head">
            <div>
              <h3>System Health</h3>
            </div>
          </div>

          <div className="superadmin-analytics-health-list">
            {analyticsHealthItems.map((item) => (
              <article key={item.label} className="superadmin-analytics-health-item">
                <div className="superadmin-analytics-health-copy">
                  <i className={`is-${item.tone}`} />
                  <strong>{item.label}</strong>
                </div>
                <span className={`superadmin-inline-badge is-${item.tone}`}>{item.value}</span>
              </article>
            ))}
          </div>

          <div className="superadmin-analytics-log">
            <div className="superadmin-analytics-log-head">
              <h4>Log Aktivitas Admin</h4>
            </div>
            <div className="superadmin-list-stack is-analytics">
              {analyticsAdminLogs.map((item) => (
                <article key={item.key} className="superadmin-list-item is-analytics">
                  <div className={`superadmin-list-dot is-${item.tone}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <article className="superadmin-panel superadmin-popular-jobs-panel is-analytics">
          <div className="superadmin-panel-head">
            <div>
              <h3>Lowongan Terpopuler</h3>
            </div>
            <button type="button" className="superadmin-inline-link" onClick={() => handleSectionChange('lowongan')}>
              Lihat Semua
            </button>
          </div>

          <div className="superadmin-table-wrap">
            <table className="superadmin-table is-compact">
              <thead>
                <tr>
                  <th>Judul Pekerjaan</th>
                  <th>Perusahaan</th>
                  <th>Kategori</th>
                  <th>Total Pelamar</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {popularJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="superadmin-job-title-cell">
                        <strong>{job.title}</strong>
                        <span>{job.location || 'Remote'}</span>
                      </div>
                    </td>
                    <td>{job.companyLabel}</td>
                    <td>{job.category || 'Umum'}</td>
                    <td>{numberFormatter.format(job.applications_count ?? 0)}</td>
                    <td>
                      <span className={`superadmin-status-tag is-${job.adminStatus.tone}`}>
                        {job.adminStatus.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <div className="superadmin-analytics-bottom">
          <article className="superadmin-panel superadmin-category-panel is-analytics">
            <div className="superadmin-panel-head">
              <div>
                <h3>Kategori Pekerjaan</h3>
              </div>
            </div>
            <div className="superadmin-category-list">
              {categoryDistribution.map((category) => (
                <article key={category.label} className="superadmin-category-item">
                  <div className="superadmin-category-head">
                    <strong>{category.label}</strong>
                    <span>{category.percentage}%</span>
                  </div>
                  <div className="superadmin-category-track">
                    <span
                      className={`is-${category.tone}`}
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="superadmin-panel superadmin-dark-panel is-analytics">
            <h3>Insight Operasional</h3>
            <p>{analyticsInsightText}</p>
            <button
              type="button"
              className="superadmin-primary-button"
              onClick={() => handleSectionChange(categoryDistribution[0]?.percentage > 35 ? 'lowongan' : 'moderation')}
            >
              Buka Prioritas
            </button>
          </article>
        </div>
      </div>
    </section>
  );

  const renderModeration = () => (
    <section className="superadmin-section-block superadmin-entity-section superadmin-moderation-section">
      <div className="superadmin-section-metrics-wrap">
        <SectionMetrics cards={moderationCards} />
      </div>

      <article className="superadmin-panel superadmin-moderation-panel superadmin-moderation-card">
        <div className="superadmin-moderation-tabs">
          {MODERATION_TABS.map((tab) => {
            const count =
              tab.value === 'all'
                ? moderationReports.length
                : moderationReports.filter((report) => report.type === tab.value).length;

            return (
              <button
                key={tab.value}
                type="button"
                className={`superadmin-tab-button${
                  moderationTab === tab.value ? ' is-active' : ''
                }`}
                onClick={() => setModerationTab(tab.value)}
              >
                {tab.label} {tab.value === 'all' ? '' : `(${count})`}
              </button>
            );
          })}

          <span className="superadmin-moderation-caption">
            Menampilkan 1-{visibleModerationReports.length} dari{' '}
            {filteredModerationReports.length} antrian
          </span>
        </div>

        <div className="superadmin-report-list">
          {filteredModerationReports.length === 0 ? (
            <div className="superadmin-empty-state is-panel">
              <div className="superadmin-empty-icon">⌁</div>
              <p>Tidak ada item review yang cocok untuk ditampilkan saat ini.</p>
            </div>
          ) : (
            visibleModerationReports.map((report) => (
              <article key={report.key} className="superadmin-report-card">
                <div className={`superadmin-report-type is-${report.type === 'account' ? 'profile' : report.type}`}>
                  <AdminIcon
                    name={
                      report.type === 'job'
                        ? 'job'
                        : report.entity === 'recruiter'
                          ? 'recruiter'
                          : 'candidate'
                    }
                  />
                </div>

                <div className="superadmin-report-body">
                  <div className="superadmin-report-top">
                    <div>
                      <h3>{report.title}</h3>
                      <span>{report.ownerLabel}</span>
                    </div>
                    <div className="superadmin-report-meta">
                      <span className={`superadmin-inline-badge is-${report.badgeTone}`}>
                        {report.severityLabel}
                      </span>
                      <small>Dilaporkan {report.timestamp}</small>
                    </div>
                  </div>

                  <div className="superadmin-report-quote">
                    <strong>Catatan Review</strong>
                    <p>"{report.reason}"</p>
                  </div>

                  <div className="superadmin-report-evidence">
                    {Array.from({ length: report.evidenceCount }).map((_, index) => (
                      <div key={`${report.key}-evidence-${index}`} className="superadmin-report-proof">
                        <div className="superadmin-proof-skeleton" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="superadmin-report-actions">
                  <button
                    type="button"
                    className="superadmin-report-button is-dark"
                    onClick={() => handleModerationAction(report, 'review')}
                  >
                    {report.primaryActionLabel || 'Buka Detail'}
                  </button>
                  <button
                    type="button"
                    className="superadmin-report-button is-danger"
                    onClick={() => handleModerationAction(report, 'suspend')}
                  >
                    {report.secondaryActionLabel || 'Tindak Lanjut'}
                  </button>
                  <button
                    type="button"
                    className="superadmin-report-button is-light"
                    onClick={() => handleModerationAction(report, 'ignore')}
                  >
                    Sembunyikan Sesi
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="superadmin-moderation-footer">
          <Pagination
            label={`Menampilkan ${
              filteredModerationReports.length === 0 ? 0 : (moderationPage - 1) * PAGE_SIZE + 1
            }-${Math.min(moderationPage * PAGE_SIZE, filteredModerationReports.length)} dari ${
              filteredModerationReports.length
            } antrian`}
            page={moderationPage}
            totalItems={filteredModerationReports.length}
            onPageChange={setModerationPage}
          />
        </div>
      </article>
    </section>
  );

  const renderMessages = () => (
    <InboxWorkspace
      title="Inbox superadmin untuk kandidat dan recruiter"
      description="Gunakan inbox ini untuk menangani pertanyaan registrasi perusahaan, screening kandidat, laporan lowongan, dan tindak lanjut operasional yang perlu eskalasi admin."
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
      compactLayout
      emptyMessage="Pilih recruiter atau kandidat yang ingin Anda bantu."
    />
  );

  const renderSectionContent = () => {
    if (activeSection === 'monitoring') {
      return renderMonitoring();
    }

    if (activeSection === 'pelamar') {
      return renderCandidateManagement();
    }

    if (activeSection === 'recruiter') {
      return renderRecruiterManagement();
    }

    if (activeSection === 'lowongan') {
      return renderJobManagement();
    }

    if (activeSection === 'analytics') {
      return renderAnalytics();
    }

    if (activeSection === 'messages') {
      return renderMessages();
    }

    return renderModeration();
  };

  return (
    <div className="superadmin-page">
      <div className="superadmin-shell">
        <aside className="superadmin-sidebar">
          <Link
            to={APP_ROUTES.adminDashboard}
            className="superadmin-sidebar-brand"
            aria-label="Dashboard superadmin KerjaNusa"
          >
            <img
              className="superadmin-sidebar-brand-image"
              src="/kerjanusa-logo-reference-tight.png"
              alt="KerjaNusa"
            />
          </Link>

          <nav className="superadmin-sidebar-nav" aria-label="Navigasi superadmin">
            {SECTION_OPTIONS.map((section) => (
              <button
                key={section.value}
                type="button"
                className={`superadmin-sidebar-link${
                  activeSection === section.value ? ' is-active' : ''
                }`}
                onClick={() => handleSectionChange(section.value)}
              >
                <AdminIcon name={section.icon} />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          <div className="superadmin-sidebar-footer">
            <div className="superadmin-sidebar-user">
              <div className="superadmin-sidebar-avatar">{getInitials(user?.name)}</div>
              <div>
                <strong>{user?.name || 'Nama Superadmin'}</strong>
              </div>
            </div>

            <button type="button" className="superadmin-sidebar-logout" onClick={handleLogout}>
              <AdminIcon name="logout" />
              {isLoggingOut ? 'Logout...' : 'Logout'}
            </button>
          </div>
        </aside>

        <main className="superadmin-main">
          <header className="superadmin-main-header">
            <div className="superadmin-main-title">
              <div className="superadmin-main-title-row">
                <h1>{currentSection.title}</h1>
                {titleBadge ? <span className="superadmin-title-badge">{titleBadge}</span> : null}
              </div>
            </div>
            {renderHeaderAside()}
          </header>

          <section
            className={`superadmin-content${
              activeSection === 'messages' ? ' is-chat-mode' : ''
            }`}
          >
            {renderFeedback()}
            {renderSectionContent()}
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
