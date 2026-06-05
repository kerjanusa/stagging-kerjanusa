import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/navbar.css';

const CONTACT_EMAIL = 'Kerjanusacompany@gmail.com';

/**
 * Mengubah kode role internal menjadi label UI yang lebih mudah dipahami user.
 */
const resolveUserRoleLabel = (role) => {
  if (role === 'candidate') {
    return 'Pelamar';
  }

  if (role === 'recruiter') {
    return 'Recruiter';
  }

  if (role === 'superadmin') {
    return 'Superadmin';
  }

  return 'Pengguna';
};

/**
 * Menyediakan navbar publik dan navbar sesi login ringan untuk halaman non-dashboard.
 */
const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === APP_ROUTES.landing;
  const isLoginPage = location.pathname === APP_ROUTES.login;
  const isPlatformPage = location.pathname === APP_ROUTES.platform;
  const isGuest = !user;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const contactPanelRef = useRef(null);
  const authenticatedLinks =
    user?.role === 'candidate'
      ? [
          { to: '/candidate#profile', label: 'Profil Siap Lamar' },
          { to: '/jobs', label: 'Lowongan Kerja' },
        ]
      : user?.role === 'superadmin'
        ? [
          { to: '/admin', label: 'Dashboard Admin' },
          { to: '/platform', label: 'Tentang Kami' },
          ]
        : [
            { to: '/recruiter', label: 'Dashboard Company' },
            { to: '/jobs', label: 'Lowongan Kerja' },
          ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsContactOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isContactOpen) {
      return undefined;
    }

    const handleOutsidePointer = (event) => {
      if (!contactPanelRef.current?.contains(event.target)) {
        setIsContactOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsidePointer);

    return () => {
    document.removeEventListener('mousedown', handleOutsidePointer);
    };
  }, [isContactOpen]);

  /**
   * Menutup seluruh panel mobile dan popover kontak agar navigasi kembali bersih.
   */
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsContactOpen(false);
  };

  /**
   * Menjalankan logout dari navbar setelah state UI lokal ditutup.
   */
  const handleLogout = () => {
    closeMobileMenu();
    logout();
  };

  /**
   * Membuka atau menutup panel kontak singkat pada navbar guest.
   */
  const handleContactToggle = () => {
    setIsContactOpen((currentValue) => !currentValue);
  };

  return (
    <>
      <nav
        className={`navbar ${isHomePage ? 'navbar-home' : ''}${
          isLoginPage ? ' navbar-login' : ''
        }${
          isPlatformPage ? ' navbar-platform' : ''
        }${
          isMobileMenuOpen ? ' navbar-menu-open' : ''
        }`}
      >
        <div className="navbar-container">
          <Link
            to={APP_ROUTES.landing}
            className="navbar-logo"
            aria-label="Beranda KerjaNusa"
            onClick={closeMobileMenu}
          >
            <img
              className="navbar-brand-image"
              src="/kerjanusa-logo-cutout.png"
              alt="KerjaNusa Recruitment Platform"
            />
          </Link>

          <button
            type="button"
            className="navbar-toggle"
            aria-expanded={isMobileMenuOpen}
            aria-controls="navbar-panel"
            aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
          >
            <span className="navbar-toggle-line" />
            <span className="navbar-toggle-line" />
            <span className="navbar-toggle-line" />
          </button>

          <div id="navbar-panel" className={`navbar-panel${isMobileMenuOpen ? ' is-open' : ''}`}>
            <div className="navbar-menu">
              {isGuest ? (
                <>
                  <div
                    ref={contactPanelRef}
                    className={`navbar-contact${isContactOpen ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="navbar-link navbar-contact-trigger"
                      aria-expanded={isContactOpen}
                      aria-controls="navbar-contact-panel"
                      onClick={handleContactToggle}
                    >
                      Kontak Kami
                    </button>

                    <div
                      id="navbar-contact-panel"
                      className={`navbar-contact-panel${isContactOpen ? ' is-open' : ''}`}
                    >
                      <strong>Kontak Kami</strong>
                      <a href={`mailto:${CONTACT_EMAIL}`} onClick={closeMobileMenu}>
                        {CONTACT_EMAIL}
                      </a>
                    </div>
                  </div>
                  <NavLink
                    to="/platform"
                    className={({ isActive }) =>
                      `navbar-link navbar-link-muted${isActive ? ' active' : ''}`
                    }
                    onClick={closeMobileMenu}
                  >
                    Tentang Kami
                  </NavLink>
                </>
              ) : (
                <>
                  {authenticatedLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </>
              )}
            </div>

            <div className="navbar-auth">
              {user ? (
                <>
                  <div className="navbar-user-chip" aria-label="Akun yang sedang login">
                    <strong>{user.name || 'Akun KerjaNusa'}</strong>
                    <span>{resolveUserRoleLabel(user.role)}</span>
                  </div>
                  <button className="btn btn-secondary" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-outline" onClick={closeMobileMenu}>
                    Login
                  </Link>
                  <Link
                    to={APP_ROUTES.register}
                    className="btn btn-primary"
                    onClick={closeMobileMenu}
                  >
                    Daftar Sekarang
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`navbar-backdrop${isMobileMenuOpen ? ' is-open' : ''}`}
          aria-hidden={!isMobileMenuOpen}
          tabIndex={isMobileMenuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        />
      </nav>

    </>
  );
};

export default Navbar;
