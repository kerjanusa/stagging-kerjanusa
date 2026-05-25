import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_ROUTES } from '../utils/routeHelpers.js';

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
   * Menutup menu saat user kembali ke website publik.
   */
  const handleHomeClick = () => {
    closeMobileMenu();
    scrollToTop();
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
              <Link
                to={APP_ROUTES.landing}
                className="recruiter-topbar-link recruiter-topbar-link-home"
                onClick={handleHomeClick}
              >
                Website Awal
              </Link>
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
                  {user?.name?.charAt(0)?.toUpperCase() || 'R'}
                </span>
                <div className="recruiter-profile-copy">
                  <strong>{companyProfile?.recruiterName || user?.name || 'Recruiter'}</strong>
                  <span>{companyProfile?.companyName || user?.company_name || 'Recruiter'}</span>
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
