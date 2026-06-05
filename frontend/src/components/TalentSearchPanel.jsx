import '../styles/workspace.css';
import { formatRecruiterPlanDocuments } from '../utils/recruiterPlans.js';
import { formatExperienceLevel } from '../utils/jobFormatters.js';
import '../styles/collaboration.css';

const GENDER_LABELS = {
  male: 'Pria',
  female: 'Wanita',
};

const buildCandidateInitials = (value = '') => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return 'CV';
  }

  return normalizedValue
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('');
};

const formatCandidateGender = (value = '') => GENDER_LABELS[String(value || '').trim().toLowerCase()] || '-';

const formatCandidateAge = (value) => {
  const normalizedAge = Number(value || 0);
  return normalizedAge > 0 ? `${normalizedAge} tahun` : '-';
};

const formatAgeFilterLabel = (minimumAge, maximumAge) => {
  if (minimumAge && maximumAge) {
    return `${minimumAge} - ${maximumAge} tahun`;
  }

  if (minimumAge) {
    return `Min ${minimumAge} tahun`;
  }

  if (maximumAge) {
    return `Maks ${maximumAge} tahun`;
  }

  return 'Semua usia';
};

const resolveCandidateHeadline = (candidate) =>
  candidate.latest_experience?.position ||
  candidate.preferred_roles?.find(Boolean) ||
  candidate.education_label ||
  'Talent profesional';

const resolveCandidateLocation = (candidate) =>
  candidate.current_address || candidate.preferred_locations?.find(Boolean) || '-';

const resolveCandidateExperienceSummary = (candidate) => {
  if (candidate.latest_experience?.position || candidate.latest_experience?.company) {
    const experienceTitle = candidate.latest_experience.position || 'Pengalaman kerja';
    const experienceCompany = candidate.latest_experience.company
      ? ` di ${candidate.latest_experience.company}`
      : '';
    const durationLabel = candidate.latest_experience.duration_label
      ? ` • ${candidate.latest_experience.duration_label}`
      : '';

    return `${experienceTitle}${experienceCompany}${durationLabel}`;
  }

  if (candidate.experience_level) {
    return formatExperienceLevel(candidate.experience_level);
  }

  return candidate.experience_type === 'fresh-graduate'
    ? 'Freshgraduate'
    : 'Pengalaman kerja belum diisi';
};

/**
 * Merender panel pencarian kandidat recruiter lengkap dengan filter, hasil, dan pagination.
 */
const TalentSearchPanel = ({
  plan,
  jobs,
  activeJob,
  filters,
  onFilterChange,
  onReset,
  onSearch,
  onPageChange,
  results,
  pagination,
  isLoading,
  favoriteCandidateIds,
  onToggleFavorite,
  onDownloadResume,
  onMessageCandidate,
}) => {
  const totalResults = pagination?.total ?? results.length;

  return (
    <section className="workspace-section-stack talent-search-workspace">
      <article className="workspace-panel talent-search-hero" data-reveal>
        <div className="talent-search-hero-copy">
          <div>
            <span className="workspace-section-label">Fitur Kolam Pelamar</span>
            <h2>Solusi Cepat Menemukan Talent Berkualitas</h2>
          </div>
          <p>
            Jangkau 10 juta+ database kandidat profesional sesuai kebutuhan bisnis Anda, lalu
            sinkronkan pencarian dengan lowongan yang sudah dibuat di dashboard recruiter.
          </p>
        </div>

        <div className="talent-search-hero-meta">
          <div className="talent-search-plan-chip">
            <strong>Paket {plan?.label || 'Starter'}</strong>
            <span>{plan?.talent_result_limit || 0} kandidat terlihat</span>
          </div>
          <div className="talent-search-plan-chip is-muted">
            <strong>Akses Dokumen</strong>
            <span>{formatRecruiterPlanDocuments(plan?.code || plan?.plan_code)}</span>
          </div>
        </div>

        <div className="talent-filter-shell">
          <div className="talent-filter-grid">
            <label className="talent-filter-field">
              <span>Lowongan Pekerjaan</span>
              <select
                value={filters.job_id}
                onChange={(event) => onFilterChange('job_id', event.target.value)}
              >
                <option value="">Semua lowongan recruiter</option>
                {(jobs || []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} • {job.location || 'Tanpa lokasi'}
                  </option>
                ))}
              </select>
            </label>

            <label className="talent-filter-field">
              <span>Minimal Pengalaman</span>
              <select
                value={filters.experience_level}
                onChange={(event) => onFilterChange('experience_level', event.target.value)}
              >
                <option value="">Semua pengalaman</option>
                <option value="entry">Freshgraduate</option>
                <option value="junior">Junior 1 - 3 tahun</option>
                <option value="mid">Mid 3 - 5 tahun</option>
                <option value="senior">Senior 5+ tahun</option>
              </select>
            </label>

            <label className="talent-filter-field">
              <span>Lokasi Kandidat</span>
              <input
                type="text"
                placeholder="Contoh: DKI Jakarta"
                value={filters.location}
                onChange={(event) => onFilterChange('location', event.target.value)}
              />
            </label>

            <label className="talent-filter-field">
              <span>Usia Kandidat</span>
              <div className="talent-filter-age-grid">
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={filters.age_min}
                  onChange={(event) => onFilterChange('age_min', event.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Maks"
                  value={filters.age_max}
                  onChange={(event) => onFilterChange('age_max', event.target.value)}
                />
              </div>
            </label>

            <label className="talent-filter-field">
              <span>Jenis Kelamin</span>
              <select
                value={filters.gender}
                onChange={(event) => onFilterChange('gender', event.target.value)}
              >
                <option value="">Semua jenis kelamin</option>
                <option value="male">Pria</option>
                <option value="female">Wanita</option>
              </select>
            </label>
          </div>

          <div className="talent-filter-actions">
            <div className="talent-filter-summary">
              <strong>{activeJob?.title || 'Belum memilih lowongan'}</strong>
              <span>
                {activeJob
                  ? `${activeJob.location || 'Tanpa lokasi'} • ${formatAgeFilterLabel(
                      filters.age_min,
                      filters.age_max
                    )}`
                  : 'Pilih lowongan agar pencarian otomatis mengikuti kebutuhan posting lowongan.'}
              </span>
            </div>

            <div className="talent-filter-action-buttons">
              <button type="button" className="btn btn-outline" onClick={onReset} disabled={isLoading}>
                Reset
              </button>
              <button type="button" className="btn btn-primary" onClick={onSearch} disabled={isLoading}>
                {isLoading ? 'Mencari...' : 'Cari Talent'}
              </button>
            </div>
          </div>
        </div>
      </article>

      <article className="workspace-panel talent-result-summary" data-reveal>
        <div>
          <span className="workspace-section-label">Database Kandidat</span>
          <h2>{isLoading ? 'Memuat kandidat...' : `${totalResults} kandidat siap ditinjau`}</h2>
          <p>
            {activeJob
              ? `Hasil berikut mengikuti kebutuhan dasar lowongan ${activeJob.title}.`
              : 'Gunakan filter lowongan, pengalaman, lokasi, umur, dan gender untuk menyaring kandidat.'}
          </p>
        </div>
      </article>

      <div className="talent-card-grid">
        {results.map((candidate) => (
          <article key={candidate.id} className="workspace-panel talent-card" data-reveal>
            <div className="talent-card-topbar">
              <div className="talent-card-profile">
                {candidate.profile_photo_url ? (
                  <img
                    src={candidate.profile_photo_url}
                    alt={candidate.name}
                    className="talent-card-avatar-image"
                  />
                ) : (
                  <div className="talent-card-avatar-fallback" aria-hidden="true">
                    {buildCandidateInitials(candidate.name)}
                  </div>
                )}

                <div className="talent-card-profile-copy">
                  <span className="workspace-section-label">Grade {candidate.grade}</span>
                  <h2>{candidate.name}</h2>
                  <p>{resolveCandidateHeadline(candidate)}</p>
                </div>
              </div>

              <button
                type="button"
                className={`talent-favorite-button ${
                  favoriteCandidateIds?.includes(candidate.id) ? 'is-active' : ''
                }`}
                onClick={() => onToggleFavorite?.(candidate)}
                title={
                  favoriteCandidateIds?.includes(candidate.id)
                    ? 'Batalkan favorit kandidat'
                    : 'Simpan kandidat ke favorit'
                }
                aria-label={
                  favoriteCandidateIds?.includes(candidate.id)
                    ? 'Batalkan favorit kandidat'
                    : 'Simpan kandidat ke favorit'
                }
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18.5 14.5A7.5 7.5 0 1 1 12.7 2.2a6.2 6.2 0 1 0 5.8 12.3Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="talent-card-health">
              <div className="talent-grade-chip">{candidate.profile_readiness_percent}% profil siap</div>
              <span>{candidate.education_label || 'Pendidikan belum diisi'}</span>
            </div>

            <p className="talent-card-summary">
              {candidate.profile_summary || 'Ringkasan profil kandidat belum diisi.'}
            </p>

            <div className="talent-meta-grid">
              <span>Domisili: {resolveCandidateLocation(candidate)}</span>
              <span>Pengalaman: {resolveCandidateExperienceSummary(candidate)}</span>
              <span>Usia: {formatCandidateAge(candidate.age)}</span>
              <span>Jenis kelamin: {formatCandidateGender(candidate.gender)}</span>
            </div>

            <div className="talent-skill-list">
              {(candidate.skills || []).slice(0, 6).map((skill) => (
                <span key={`${candidate.id}-${skill}`} className="talent-skill-chip">
                  {skill}
                </span>
              ))}
            </div>

            <div className="talent-document-note">
              <strong>{candidate.resume_files?.[0] || 'CV belum diunggah'}</strong>
              <span>
                {candidate.document_access?.resume_files_visible || 0}/
                {candidate.document_access?.resume_files_total || 0} CV •{' '}
                {candidate.document_access?.certificate_files_visible || 0}/
                {candidate.document_access?.certificate_files_total || 0} sertifikat
              </span>
              {candidate.document_access?.upgrade_required && (
                <small>Upgrade paket untuk membuka lebih banyak dokumen kandidat.</small>
              )}
            </div>

            <div className="talent-card-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onDownloadResume?.(candidate)}
                disabled={!candidate.resume_files?.length}
              >
                Download CV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onMessageCandidate?.(candidate)}
              >
                Chat Kandidat
              </button>
            </div>
          </article>
        ))}

        {!isLoading && results.length === 0 && (
          <article className="workspace-panel talent-card talent-card-empty">
            <h2>Belum ada kandidat yang cocok</h2>
            <p>
              Ubah lowongan, lokasi, pengalaman, usia, atau gender lalu jalankan pencarian ulang
              dari fitur Kolam Pelamar.
            </p>
          </article>
        )}
      </div>

      {pagination?.last_page > 1 && (
        <div className="talent-pagination">
          {Array.from({ length: pagination.last_page }).map((_, index) => {
            const nextPage = index + 1;

            return (
              <button
                key={`talent-page-${nextPage}`}
                type="button"
                className={`page-btn ${pagination.current_page === nextPage ? 'active' : ''}`}
                onClick={() => onPageChange(nextPage)}
              >
                {nextPage}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TalentSearchPanel;
