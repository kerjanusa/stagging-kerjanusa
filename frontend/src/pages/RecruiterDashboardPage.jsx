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
import {
  APPLICATION_STAGE_OPTIONS,
  RECRUITER_JOB_WORKFLOW_OPTIONS,
  RECRUITER_SECTION_OPTIONS,
  getApplicationStage,
  getApplicationStageLabel,
  getJobWorkflowLabel,
  getJobWorkflowStatus,
  getRecruiterApplicationStageMeta,
  getRecruiterCompanyCompletion,
  getRecruiterOverviewNextAction,
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
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/workspace.css';
import '../styles/recruiterDashboard.css';

const RECRUITER_SUPPORT_WHATSAPP_LINK =
  'https://api.whatsapp.com/send?phone=6281286402753&text=Halo%20KerjaNusa';

const RECRUITER_MOBILE_BOTTOM_SECTIONS = [
  { value: 'overview', label: 'Beranda', icon: 'home' },
  { value: 'jobs', label: 'Lowongan', icon: 'briefcase' },
  { value: 'candidates', label: 'Kandidat', icon: 'clipboard' },
  { value: 'company', label: 'Profil', icon: 'user' },
];

/**
 * Mengubah hash URL recruiter menjadi nama section yang valid untuk dashboard.
 */
const resolveRecruiterSectionFromHash = (hash) => {
  const normalizedHash = hash.replace(/^#/, '');

  if (RECRUITER_SECTION_OPTIONS.some((section) => section.value === normalizedHash)) {
    return normalizedHash;
  }

  return 'overview';
};

/**
 * Menyusun URL section recruiter dari satu helper agar navigasi hash konsisten.
 */
const getRecruiterSectionRoute = (section) =>
  section === 'overview'
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
    case 'companyName':
      return 'Nama perusahaan yang valid membantu kandidat percaya pada lowongan yang dipublikasikan.';
    case 'contactRole':
      return 'Lengkapi peran ini agar kandidat tahu siapa PIC recruiter untuk proses hiring.';
    case 'phone':
      return 'Nomor aktif dibutuhkan agar recruiter mudah dihubungi saat proses rekrutmen berjalan.';
    case 'companyLocation':
      return 'Lokasi utama membantu kandidat memahami area operasional perusahaan.';
    case 'companyDescription':
      return 'Ringkasan perusahaan membuat lowongan aktif terlihat lebih kredibel dan siap dipublikasikan.';
    case 'hiringFocus':
      return 'Fokus hiring saat ini membantu arah publikasi dan screening lowongan baru.';
    default:
      return 'Lengkapi komponen ini agar lowongan aktif terlihat lebih kredibel dan siap dipublikasikan.';
  }
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
  const [jobWorkflowFilter, setJobWorkflowFilter] = useState('all');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [jobActionInFlightId, setJobActionInFlightId] = useState(null);
  const [applicationActionInFlightId, setApplicationActionInFlightId] = useState(null);
  const [packageOverview, setPackageOverview] = useState({
    current: companyProfile.plan || null,
    catalog: [],
  });
  const [isLoadingPackage, setIsLoadingPackage] = useState(false);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [talentFilters, setTalentFilters] = useState({
    query: '',
    location: '',
    skill: '',
    grade: '',
    experience_type: '',
  });
  const [talentCandidates, setTalentCandidates] = useState([]);
  const [talentPagination, setTalentPagination] = useState(null);
  const [isLoadingTalent, setIsLoadingTalent] = useState(false);
  const [selectedChatContact, setSelectedChatContact] = useState(null);
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  useEffect(() => {
    setActiveSection(resolveRecruiterSectionFromHash(location.hash));
  }, [location.hash]);

  useEffect(() => {
    setCompanyProfile(readRecruiterCompanyProfile(user));
  }, [user]);

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

  const recruiterJobs = useMemo(
    () =>
      jobs.map((job) => {
        const workflowStatus = getJobWorkflowStatus(job);

        return {
          ...job,
          workflowStatus,
          workflowLabel: getJobWorkflowLabel(workflowStatus),
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
    if (activeSection !== 'talent' || talentCandidates.length > 0) {
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
      }
    };

    loadTalent();
  }, [activeSection, talentCandidates.length, talentFilters]);

  const selectedJob = useMemo(
    () => recruiterJobs.find((job) => Number(job.id) === Number(selectedJobId)) || null,
    [recruiterJobs, selectedJobId]
  );

  const recruiterApplications = useMemo(
    () =>
      applications.map((application) => {
        const candidateProfile = readCandidateProfile(application.candidate);
        const stage = getApplicationStage(application);
        const stageMeta = getRecruiterApplicationStageMeta(stage);

        return {
          ...application,
          stage,
          stageLabel: getApplicationStageLabel(stage),
          stageMeta,
          candidateProfile,
        };
      }),
    [applications]
  );

  const candidateStageCounts = useMemo(() => {
    const counts = { all: recruiterApplications.length };

    APPLICATION_STAGE_OPTIONS.forEach((option) => {
      counts[option.value] = recruiterApplications.filter(
        (application) => application.stage === option.value
      ).length;
    });

    return counts;
  }, [recruiterApplications]);

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

  const filteredApplications = useMemo(() => {
    const normalizedQuery = candidateSearchQuery.trim().toLowerCase();

    return recruiterApplications.filter((application) => {
      const matchesStage =
        candidateStageFilter === 'all' ? true : application.stage === candidateStageFilter;
      const matchesSearch =
        !normalizedQuery ||
        [
          application.candidate?.name,
          application.candidate?.email,
          application.candidate?.phone,
          application.job?.title,
          application.candidateProfile?.companyName,
          application.candidateProfile?.profileSummary,
          ...(application.candidateProfile?.skills || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStage && matchesSearch;
    });
  }, [candidateSearchQuery, candidateStageFilter, recruiterApplications]);

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

  const handleSaveCompanyProfile = async () => {
    if (!user) {
      return;
    }

    setIsSavingCompanyProfile(true);
    const savedProfile = saveRecruiterCompanyProfile(user, companyProfile);
    setCompanyProfile(savedProfile);

    try {
      await updateProfile({
        name: savedProfile.recruiterName.trim(),
        phone: savedProfile.phone.trim(),
        company_name: savedProfile.companyName.trim(),
        recruiter_profile: savedProfile,
      });

      setFeedback({
        type: 'success',
        message: companyCompletion.isReady
          ? 'Profil company berhasil disimpan dan siap dipakai untuk publish lowongan.'
          : 'Profil company berhasil disimpan. Lengkapi checklist minimum agar siap publish lowongan.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error?.message ||
          'Profil company lokal tersimpan, tetapi sinkronisasi nama atau telepon recruiter belum berhasil.',
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

  const runTalentSearch = async (page = 1) => {
    setIsLoadingTalent(true);

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
    setTalentFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
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
      setCompanyProfile(readRecruiterCompanyProfile(response.user || refreshedUser || user));
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
        sections={RECRUITER_SECTION_OPTIONS}
        activeSection={activeSection}
        onSectionSelect={handleSectionChange}
        onBrandClick={() => handleSectionChange('overview')}
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
                  <span className="workspace-section-label">Profil Company</span>
                  <h2>Identitas minimum recruiter</h2>
                </div>
                <p>
                  Company profile ini dipakai sebagai gerbang publish lowongan. Fokus ke data yang
                  memang penting untuk membangun trust kandidat.
                </p>
              </div>

              <div className="workspace-profile-status-banner">
                <div>
                  <strong>{companyCompletion.isReady ? 'Siap publish lowongan' : 'Belum siap publish'}</strong>
                  <span>
                    {companyCompletion.completedRequiredItems}/{companyCompletion.totalRequiredItems}{' '}
                    syarat inti terpenuhi
                  </span>
                </div>
                <div>
                  <strong>{companyCompletion.readinessPercent}%</strong>
                  <span>Kesiapan company profile</span>
                </div>
              </div>
            </article>

            <article className="workspace-panel" data-reveal data-reveal-delay="60ms">
              <div className="workspace-panel-heading">
                <div>
                  <span className="workspace-section-label">Data Company</span>
                  <h2>Siapa yang sedang hiring</h2>
                </div>
                <p>
                  Perjelas nama perusahaan, lokasi, fokus hiring, dan PIC recruiter agar kandidat
                  tahu konteks perusahaan yang akan mereka lamar.
                </p>
              </div>

              <div className="workspace-form-grid workspace-form-grid-two">
                <label className="workspace-field">
                  <span>Nama PIC recruiter</span>
                  <input
                    type="text"
                    value={companyProfile.recruiterName}
                    onChange={(event) =>
                      handleCompanyFieldChange('recruiterName', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Peran PIC recruiter</span>
                  <input
                    type="text"
                    placeholder="Contoh: HR Manager"
                    value={companyProfile.contactRole}
                    onChange={(event) =>
                      handleCompanyFieldChange('contactRole', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Nama perusahaan</span>
                  <input
                    type="text"
                    value={companyProfile.companyName}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyName', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Telepon aktif</span>
                  <input
                    type="tel"
                    value={companyProfile.phone}
                    onChange={(event) => handleCompanyFieldChange('phone', event.target.value)}
                  />
                </label>
                <label className="workspace-field">
                  <span>Lokasi utama perusahaan</span>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta Selatan"
                    value={companyProfile.companyLocation}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyLocation', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field">
                  <span>Website / tautan company</span>
                  <input
                    type="text"
                    placeholder="Contoh: https://perusahaananda.com"
                    value={companyProfile.website}
                    onChange={(event) => handleCompanyFieldChange('website', event.target.value)}
                  />
                </label>
                <label className="workspace-field workspace-field-span-two">
                  <span>Ringkasan perusahaan</span>
                  <textarea
                    rows="4"
                    placeholder="Jelaskan secara singkat bisnis utama, skala tim, dan nilai kerja perusahaan."
                    value={companyProfile.companyDescription}
                    onChange={(event) =>
                      handleCompanyFieldChange('companyDescription', event.target.value)
                    }
                  />
                </label>
                <label className="workspace-field workspace-field-span-two">
                  <span>Fokus hiring saat ini</span>
                  <textarea
                    rows="3"
                    placeholder="Contoh: memperkuat tim operasional cabang Bogor dan Jakarta untuk kuartal ini."
                    value={companyProfile.hiringFocus}
                    onChange={(event) =>
                      handleCompanyFieldChange('hiringFocus', event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="workspace-action-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveCompanyProfile}
                  disabled={isSavingCompanyProfile}
                >
                  {isSavingCompanyProfile ? 'Menyimpan...' : 'Simpan Profil Company'}
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
                  <span className="workspace-section-label">Lowongan Saya</span>
                  <h2>Kelola lifecycle lowongan</h2>
                </div>
                <p>
                  Dashboard recruiter harus membantu Anda bergerak dari draft, publish, jeda, sampai
                  penutupan lowongan tanpa kehilangan konteks hiring.
                </p>
              </div>

              <div className="workspace-action-row recruiter-flow-toolbar">
                <input
                  type="search"
                  className="recruiter-flow-search"
                  placeholder="Cari judul, kategori, atau lokasi lowongan"
                  value={jobSearchQuery}
                  onChange={(event) => setJobSearchQuery(event.target.value)}
                />

                <select
                  className="recruiter-flow-select"
                  value={jobWorkflowFilter}
                  onChange={(event) => setJobWorkflowFilter(event.target.value)}
                >
                  <option value="all">Semua status workflow</option>
                  {RECRUITER_JOB_WORKFLOW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <Link to={APP_ROUTES.recruiterCreateJob} className="btn btn-primary">
                  Buat Lowongan Baru
                </Link>
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
                <div className="workspace-card-list">
                  {filteredJobs.map((job) => (
                    <article key={job.id} className="workspace-subcard recruiter-flow-job-card">
                      <div className="workspace-subcard-heading">
                        <div>
                          <strong>{job.title}</strong>
                          <span>
                            {job.category} • {job.location}
                          </span>
                        </div>
                        <span className={`workspace-status-pill workspace-status-pill-${job.workflowStatus === 'active' ? 'success' : job.workflowStatus === 'draft' ? 'muted' : 'warning'}`}>
                          {job.workflowLabel}
                        </span>
                      </div>

                      <p>{job.description}</p>

                      <div className="workspace-inline-metadata">
                        <span>{formatExperienceLevel(job.experience_level)}</span>
                        <span>{formatWorkMode(job.work_mode)}</span>
                        <span>
                          {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
                        </span>
                        <span>{formatPlural(Number(job.openings_count) || 0, 'posisi')}</span>
                        <span>{formatPlural(Number(job.applications_count) || 0, 'pelamar')}</span>
                      </div>

                      <div className="workspace-action-row recruiter-flow-job-actions">
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
                          className="btn btn-outline"
                          onClick={() => {
                            setSelectedJobId(job.id);
                            handleSectionChange('candidates');
                          }}
                        >
                          Lihat Kandidat
                        </button>

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
                  <span className="workspace-section-label">Pipeline Kandidat</span>
                  <h2>Gerakkan kandidat per lowongan</h2>
                </div>
                <p>
                  Kandidat harus dikelola per lowongan, bukan daftar umum tanpa konteks. Fokus pada
                  screening, pemindahan stage, dan keputusan hiring.
                </p>
              </div>

              <div className="workspace-action-row recruiter-flow-toolbar">
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
                  placeholder="Cari nama, email, skill, atau ringkasan kandidat"
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

                    return (
                      <article
                        key={application.id}
                        className="workspace-subcard recruiter-flow-candidate-card"
                      >
                        <div className="workspace-subcard-heading">
                          <div>
                            <strong>{application.candidate?.name || 'Kandidat'}</strong>
                            <span>
                              {application.candidate?.email || '-'} •{' '}
                              {application.candidate?.phone || '-'}
                            </span>
                          </div>
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
                        </div>

                        <p>{application.stageMeta.summary}</p>

                        <div className="workspace-inline-metadata">
                          <span>Role incaran: {preferredRole}</span>
                          <span>Lokasi minat: {preferredLocation}</span>
                          <span>Dikirim: {formatDateTime(application.applied_at)}</span>
                          <span>{selectedJob.title}</span>
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

                        <div className="workspace-inline-metadata">
                          <span>
                            CV tersimpan: {application.candidateProfile.resumeFiles.length}
                          </span>
                          <span>
                            Dokumen pendukung:{' '}
                            {application.candidateProfile.certificateFiles.length}
                          </span>
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

                        <div className="workspace-action-row recruiter-flow-job-actions">
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
                            Hubungi Kandidat
                          </a>
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
            filters={talentFilters}
            onFilterChange={handleTalentFilterChange}
            onSearch={() => runTalentSearch(1)}
            onPageChange={runTalentSearch}
            results={talentCandidates}
            pagination={talentPagination}
            isLoading={isLoadingTalent}
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
            </span>
            <span>{section.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default RecruiterDashboardPage;
