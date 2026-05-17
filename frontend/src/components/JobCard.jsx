import '../styles/jobCard.css';
import {
  formatExperienceLevel,
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
 * Menampilkan ringkasan lowongan publik lengkap dengan CTA apply.
 */
const JobCard = ({
  job,
  index = 0,
  onApply,
  actionLabel = 'Lamar Sekarang',
  actionVariant = 'primary',
}) => {
  const videoScreeningLabel = formatVideoScreeningRequirement(job.video_screening_requirement);

  return (
    <div
      className="job-card"
      data-reveal
      data-reveal-delay={`${Math.min(index, 5) * 70}ms`}
    >
      <div className="job-header">
        <div>
          <h3 className="job-title">{job.title}</h3>
          <p className="job-company">{job.recruiter?.name}</p>
        </div>
        <span className="job-type">{formatDisplayLabel(job.job_type)}</span>
      </div>

      <div className="job-details">
        <div className="detail-item">
          <span className="label">Lokasi</span>
          <span className="value">{job.location}</span>
        </div>
        <div className="detail-item">
          <span className="label">Kategori</span>
          <span className="value">{formatDisplayLabel(job.category)}</span>
        </div>
        <div className="detail-item">
          <span className="label">Level</span>
          <span className="value">{formatExperienceLevel(job.experience_level)}</span>
        </div>
      </div>

      <div className="job-salary">
        <span>Rp {job.salary_min?.toLocaleString('id-ID')}</span>
        <span> - Rp {job.salary_max?.toLocaleString('id-ID')}</span>
      </div>

      {videoScreeningLabel && <p className="job-video-screening-note">{videoScreeningLabel}</p>}

      <p className="job-description">{job.description?.substring(0, 150)}...</p>

      <div className="job-actions">
        <button className={`btn btn-${actionVariant}`} onClick={() => onApply?.(job)}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default JobCard;
