import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_ROUTES } from '../utils/routeHelpers.js';

/**
 * Membuat fallback inisial singkat untuk avatar recruiter atau perusahaan.
 */
const buildInitials = (value) => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return 'R';
  }

  const segments = normalizedValue.split(/\s+/).filter(Boolean).slice(0, 2);
  return segments.map((segment) => segment.charAt(0).toUpperCase()).join('') || 'R';
};

/**
 * Merender navigasi utama recruiter beserta shortcut paket, profil, dan logout.
 */
const RecruiterTopbar = ({
  sections,
  activeSection,
  onSectionSelect,
  onBrandClick,
  onLogout,
  isLoggingOut,
  user,
  companyProfile,
  onPremiumClick,
}) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const recruiterDisplayName = companyProfile?.recruiterName || user?.name || 'Recruiter';
  const companyDisplayName = companyProfile?.companyName || user?.company_name || 'Perusahaan';
  const companyDisplayRole = companyProfile?.contactRole || 'Dashboard recruiter';
  const companyLogoUrl = companyProfile?.companyLogoDataUrl || user?.profile_picture || '';
  const companyInitials = buildInitials(companyDisplayName);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.hash, location.pathname]);

  /**
   * Menutup panel navigasi mobile ketika user berpindah aksi.
   */
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  /**
   * Memastikan perpindahan section dimulai dari posisi scroll paling atas.
   */
  const scrollToTop = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  /**
   * Menangani klik logo recruiter sekaligus merapikan state UI mobile.
   */
  const handleBrandClick = () => {
    closeMobileMenu();
    scrollToTop();
    onBrandClick?.();
  };

  /**
   * Menjalankan perpindahan section recruiter dari topbar.
   */
  const handleSectionClick = (section) => {
    closeMobileMenu();
    scrollToTop();
    onSectionSelect?.(section);
  };

  /**
   * Menutup menu lalu meneruskan aksi logout ke parent.
   */
  const handleLogoutClick = () => {
    closeMobileMenu();
    onLogout?.();
  };

  const recruiterPlanLabel = companyProfile?.plan?.label || 'Starter';
  const recruiterCredit = Number(companyProfile?.kn_credit || 0);

  return (
    <>
      <header
        className={`recruiter-topbar${isMobileMenuOpen ? ' recruiter-topbar-menu-open' : ''}`}
      >
        <div className="recruiter-topbar-shell">
          <Link
            to={APP_ROUTES.landing}
            className="recruiter-topbar-brand"
            aria-label="Dashboard awal recruiter"
            onClick={handleBrandClick}
          >
            <img src="/kerjanusa-logo-cutout.png" alt="KerjaNusa Recruitment Platform" />
          </Link>

          <button
            type="button"
            className="recruiter-topbar-toggle"
            aria-expanded={isMobileMenuOpen}
            aria-controls="recruiter-topbar-panel"
            aria-label={isMobileMenuOpen ? 'Tutup menu recruiter' : 'Buka menu recruiter'}
            onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
          >
            <span className="recruiter-topbar-toggle-line" />
            <span className="recruiter-topbar-toggle-line" />
            <span className="recruiter-topbar-toggle-line" />
          </button>

          <div
            id="recruiter-topbar-panel"
            className={`recruiter-topbar-panel${isMobileMenuOpen ? ' is-open' : ''}`}
          >
            <nav className="recruiter-topbar-nav" aria-label="Navigasi recruiter">
              {sections.map((section) => (
                <button
                  key={section.value}
                  type="button"
                  className={`recruiter-topbar-link${
                    activeSection === section.value ? ' active' : ''
                  }`}
                  onClick={() => handleSectionClick(section.value)}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            <div className="recruiter-topbar-actions">
              <button
                type="button"
                className="recruiter-premium-button"
                onClick={onPremiumClick}
              >
                Paket {recruiterPlanLabel}
              </button>
              <div className="recruiter-credit-chip" aria-label="KerjaNusa Credit">
                <span>KN Credit</span>
                <strong>{recruiterCredit}</strong>
              </div>
              <div className="recruiter-profile-chip">
                <span className="recruiter-profile-avatar" aria-hidden="true">
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt="" />
                  ) : (
                    <span>{companyInitials}</span>
                  )}
                </span>
                <div className="recruiter-profile-copy">
                  <strong>{recruiterDisplayName}</strong>
                  <span>{companyDisplayName}</span>
                </div>
              </div>
              <button
                type="button"
                className="recruiter-logout-button"
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Keluar...' : 'Logout'}
              </button>
            </div>

            <div className="recruiter-topbar-menu-footer">
              <div className="recruiter-topbar-menu-company">
                <span className="recruiter-topbar-menu-company-avatar" aria-hidden="true">
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt="" />
                  ) : (
                    <span>{companyInitials}</span>
                  )}
                </span>
                <div className="recruiter-topbar-menu-company-copy">
                  <strong>{companyDisplayName}</strong>
                  <span>{recruiterDisplayName}</span>
                  <small>{companyDisplayRole}</small>
                </div>
              </div>

              <button
                type="button"
                className="recruiter-logout-button recruiter-topbar-menu-logout"
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Keluar...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <button
        type="button"
        className={`recruiter-topbar-backdrop${isMobileMenuOpen ? ' is-open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
        tabIndex={isMobileMenuOpen ? 0 : -1}
        onClick={closeMobileMenu}
      />
    </>
  );
};

export default RecruiterTopbar;
