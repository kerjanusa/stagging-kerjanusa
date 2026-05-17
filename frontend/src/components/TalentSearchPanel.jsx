import '../styles/workspace.css';
import { formatRecruiterPlanDocuments } from '../utils/recruiterPlans.js';
import '../styles/collaboration.css';

/**
 * Merender panel pencarian kandidat recruiter lengkap dengan filter, hasil, dan pagination.
 */
const TalentSearchPanel = ({
  plan,
  filters,
  onFilterChange,
  onSearch,
  onPageChange,
  results,
  pagination,
  isLoading,
  onMessageCandidate,
}) => {
  return (
    <section className="workspace-section-stack">
      <article className="workspace-panel" data-reveal>
        <div className="workspace-panel-heading">
          <div>
            <span className="workspace-section-label">Talent Search</span>
            <h2>Temukan pelamar aktif yang paling relevan</h2>
          </div>
          <p>
            Paket aktif Anda: <strong>{plan?.label || 'Starter'}</strong>. Batas hasil{' '}
            <strong>{plan?.talent_result_limit || 0}</strong> kandidat dan akses dokumen{' '}
            <strong>{formatRecruiterPlanDocuments(plan?.code || plan?.plan_code)}</strong>.
          </p>
        </div>

        <div className="talent-filter-grid">
          <input
            type="search"
            placeholder="Cari nama, role, skill, atau ringkasan profil..."
            value={filters.query}
            onChange={(event) => onFilterChange('query', event.target.value)}
          />
          <input
            type="text"
            placeholder="Lokasi kandidat"
            value={filters.location}
            onChange={(event) => onFilterChange('location', event.target.value)}
          />
          <input
            type="text"
            placeholder="Skill utama"
            value={filters.skill}
            onChange={(event) => onFilterChange('skill', event.target.value)}
          />
          <select
            value={filters.grade}
            onChange={(event) => onFilterChange('grade', event.target.value)}
          >
            <option value="">Semua Grade</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>
          <select
            value={filters.experience_type}
            onChange={(event) => onFilterChange('experience_type', event.target.value)}
          >
            <option value="">Semua Pengalaman</option>
            <option value="experienced">Berpengalaman</option>
            <option value="fresh-graduate">Fresh Graduate</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={onSearch} disabled={isLoading}>
            {isLoading ? 'Mencari...' : 'Cari Talent'}
          </button>
        </div>
      </article>

      <div className="talent-card-grid">
        {results.map((candidate) => (
          <article key={candidate.id} className="workspace-panel talent-card" data-reveal>
            <div className="talent-card-heading">
              <div>
                <span className="workspace-section-label">Grade {candidate.grade}</span>
                <h2>{candidate.name}</h2>
              </div>
              <div className="talent-grade-chip">{candidate.profile_readiness_percent}% siap</div>
            </div>

            <p>{candidate.profile_summary || 'Ringkasan profil kandidat belum diisi.'}</p>

            <div className="talent-meta-grid">
              <span>Role: {(candidate.preferred_roles || []).slice(0, 2).join(', ') || '-'}</span>
              <span>
                Lokasi: {(candidate.preferred_locations || []).slice(0, 2).join(', ') || '-'}
              </span>
              <span>Pengalaman: {candidate.experience_type === 'experienced' ? 'Berpengalaman' : 'Fresh Graduate'}</span>
              <span>Aplikasi aktif: {candidate.applications_count || 0}</span>
            </div>

            <div className="talent-skill-list">
              {(candidate.skills || []).slice(0, 6).map((skill) => (
                <span key={`${candidate.id}-${skill}`} className="talent-skill-chip">
                  {skill}
                </span>
              ))}
            </div>

            <div className="talent-document-note">
              <strong>Berkas terlihat</strong>
              <span>
                {candidate.document_access?.resume_files_visible || 0}/
                {candidate.document_access?.resume_files_total || 0} CV •{' '}
                {candidate.document_access?.certificate_files_visible || 0}/
                {candidate.document_access?.certificate_files_total || 0} sertifikat
              </span>
            </div>

            <div className="talent-card-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onMessageCandidate?.(candidate)}
              >
                Hubungi Kandidat
              </button>
            </div>
          </article>
        ))}

        {!isLoading && results.length === 0 && (
          <article className="workspace-panel talent-card talent-card-empty">
            <h2>Belum ada kandidat cocok</h2>
            <p>Ubah filter skill, lokasi, pengalaman, atau grade untuk memperluas hasil pencarian.</p>
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
