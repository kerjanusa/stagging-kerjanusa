import '../styles/jobCard.css';
import {
  formatExperienceLevel,
  formatJobType,
  formatWorkMode,
  formatVideoScreeningRequirement,
} from '../utils/jobFormatters.js';

/**
 * Menjadikan slug atau kode teknis job menjadi label yang lebih ramah dibaca.
 */
const formatDisplayLabel = (value) => {
  if (!value) {
    return '-';
  }

  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

/**
 * Menghasilkan inisial perusahaan singkat untuk badge visual di kartu lowongan.
 */
const buildCompanyInitials = (value = '') =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('') || 'KN';

/**
 * Memadatkan label level pengalaman agar kartu tetap ringkas.
 */
const formatExperienceChip = (value) => {
  const label = formatExperienceLevel(value);
  return label.replace(/\s*\(.*?\)\s*/g, '').trim() || label;
};

/**
 * Memotong deskripsi lowongan menjadi teaser singkat.
 */
const buildDescriptionPreview = (value = '', limit = 150) => {
  const normalizedValue = String(value || '').trim().replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return 'Detail lowongan akan ditampilkan saat Anda membuka proses melamar.';
  }

  if (normalizedValue.length <= limit) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, limit).trimEnd()}...`;
};

/**
 * Mengubah nominal gaji menjadi format juta yang lebih singkat untuk UI kandidat.
 */
const formatSalaryCompact = (value) => {
  const numericValue = Number(value || 0);

  if (!numericValue) {
    return '';
  }

  if (numericValue >= 1000000) {
    return `${(numericValue / 1000000).toFixed(1).replace('.', ',')}jt`;
  }

  return numericValue.toLocaleString('id-ID');
};

/**
 * Menyusun label rentang gaji untuk footer kartu.
 */
const formatSalaryRange = (minimumSalary, maximumSalary) => {
  const minimumValue = Number(minimumSalary || 0);
  const maximumValue = Number(maximumSalary || 0);

  if (minimumValue && maximumValue) {
    return `Rp ${formatSalaryCompact(minimumValue)} - ${formatSalaryCompact(maximumValue)}`;
  }

  if (maximumValue) {
    return `Hingga Rp ${formatSalaryCompact(maximumValue)}`;
  }

  if (minimumValue) {
    return `Mulai Rp ${formatSalaryCompact(minimumValue)}`;
  }

  return 'Gaji dirundingkan';
};

/**
 * Menampilkan ringkasan lowongan publik lengkap dengan CTA apply.
 */
const JobCard = ({
  job,
  index = 0,
  onApply,
  onToggleSave,
  isSaved = false,
  actionLabel = 'Lamar Sekarang',
  actionVariant = 'primary',
}) => {
  const videoScreeningLabel = formatVideoScreeningRequirement(job.video_screening_requirement);
  const companyName = job.recruiter?.company_name || job.recruiter?.name || 'Perusahaan';
  const jobMetaChips = [
    job.location,
    formatExperienceChip(job.experience_level),
    formatWorkMode(job.work_mode),
  ].filter(Boolean);

  return (
    <div
      className="job-card"
      data-reveal
      data-reveal-delay={`${Math.min(index, 5) * 70}ms`}
    >
      <div className="job-header">
        <div className="job-header-main">
          <div className="job-company-mark" aria-hidden="true">
            {buildCompanyInitials(companyName)}
          </div>
          <div className="job-header-copy">
            <span className="job-kicker">
              {job.isRecommended ? 'Lowongan rekomendasi' : 'Peluang aktif'}
            </span>
            <h3 className="job-title">{job.title}</h3>
            <p className="job-company">{companyName}</p>
          </div>
        </div>
        <div className="job-header-actions">
          <button
            type="button"
            className={`job-save-button${isSaved ? ' is-saved' : ''}`}
            onClick={() => onToggleSave?.(job.id)}
            aria-label={isSaved ? 'Batalkan simpan lowongan' : 'Simpan lowongan'}
            title={isSaved ? 'Batalkan simpan lowongan' : 'Simpan lowongan'}
          >
            {isSaved ? 'Tersimpan' : 'Simpan'}
          </button>
          {job.recommendationMatchLabel ? (
            <span className="job-match-badge">{job.recommendationMatchLabel}</span>
          ) : (
            <span className="job-type">{formatJobType(job.job_type)}</span>
          )}
        </div>
      </div>

      {(job.closingCountdownLabel || job.recommendationMatchLabel || videoScreeningLabel) && (
        <div className="job-status-row">
          {job.closingCountdownLabel && (
            <span className="job-countdown-badge">{job.closingCountdownLabel}</span>
          )}
          {job.recommendationMatchLabel && (
            <span className="job-countdown-badge">{job.isRecommended ? 'Diprioritaskan' : 'Cocok'}</span>
          )}
          {videoScreeningLabel && (
            <span className="job-countdown-badge job-countdown-badge-muted">
              {videoScreeningLabel}
            </span>
          )}
        </div>
      )}

      <div className="job-pill-row">
        {jobMetaChips.map((item) => (
          <span key={`${job.id}-${item}`} className="job-pill">
            {item}
          </span>
        ))}
      </div>

      <div className="job-details">
        <div className="detail-item">
          <span className="label">Kategori</span>
          <span className="value">{formatDisplayLabel(job.category)}</span>
        </div>
        <div className="detail-item">
          <span className="label">Tipe kerja</span>
          <span className="value">{formatJobType(job.job_type)}</span>
        </div>
        <div className="detail-item">
          <span className="label">Level</span>
          <span className="value">{formatExperienceChip(job.experience_level)}</span>
        </div>
      </div>

      <p className="job-description">{buildDescriptionPreview(job.description)}</p>

      <div className="job-card-footer">
        <div className="job-salary-block">
          <span className="job-salary-label">Estimasi gaji</span>
          <strong className="job-salary">
            {formatSalaryRange(job.salary_min, job.salary_max)}
          </strong>
        </div>

        <div className="job-actions">
          <button className={`btn btn-${actionVariant}`} onClick={() => onApply?.(job)}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
