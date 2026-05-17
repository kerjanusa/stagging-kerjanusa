import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LoginForm from '../components/LoginForm.jsx';
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/auth.css';

const loginSlides = [
  {
    src: '/hero-slides/review-1.jpeg',
    alt: 'Dashboard kandidat dengan video interview dan score total 65 dari 100.',
  },
  {
    src: '/hero-slides/review-2.jpeg',
    alt: 'Dashboard kandidat dengan video interview dan score total 74 dari 100.',
  },
  {
    src: '/hero-slides/review-3.jpeg',
    alt: 'Dashboard kandidat dengan video interview dan score total 82 dari 100.',
  },
];

const LOGIN_ENTRY_COPY = {
  default: {
    heading: 'Masuk ke akun Anda',
    description:
      'Gunakan email dan password untuk membuka dashboard recruiter atau alur kandidat Anda.',
    registerLabel: 'Belum punya akun?',
    registerTo: '/register?role=recruiter',
    registerCta: 'Daftar di sini',
    emailPlaceholder: 'Email recruiter / company',
  },
  recruiter: {
    description:
      'Masuk untuk membuka dashboard, pasang lowongan, dan kelola kandidat.',
    registerLabel: 'Belum punya akun?',
    registerTo: '/register?role=recruiter',
    registerCta: 'Daftar di sini',
    emailPlaceholder: 'Email recruiter / company',
  },
  candidate: {
    heading: 'Login Pelamar',
    description:
      'Masuk untuk melihat status lamaran, lowongan aktif, dan aktivitas kandidat Anda.',
    registerLabel: 'Belum punya akun pelamar?',
    registerTo: '/register?role=candidate',
    registerCta: 'Daftar di sini',
    emailPlaceholder: 'Email pelamar',
  },
  superadmin: {
    heading: 'Login Superadmin',
    description:
      'Masuk untuk membuka dashboard superadmin dan memantau pelamar, recruiter, lowongan, serta data platform.',
    helper: 'Akun superadmin dikelola langsung oleh tim inti KerjaNusa.',
    emailPlaceholder: 'Email superadmin KerjaNusa',
  },
};

/**
 * Menyediakan shell login dengan copy yang menyesuaikan role tujuan dari query string.
 */
const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const requestedRole = searchParams.get('role');
  const loginEntryKey =
    requestedRole === 'candidate' || requestedRole === 'recruiter'
      ? requestedRole
      : requestedRole === 'superadmin' || requestedRole === 'internal'
        ? 'superadmin'
        : 'default';
  const loginCopy = LOGIN_ENTRY_COPY[loginEntryKey];
  const forgotPasswordTo =
    loginEntryKey === 'default'
      ? APP_ROUTES.forgotPassword
      : `${APP_ROUTES.forgotPassword}?role=${loginEntryKey}`;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentSlide((currentIndex) => (currentIndex + 1) % loginSlides.length);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="auth-page auth-page-login">
      <div className="auth-login-layout">
        <section className="auth-showcase" aria-hidden="true" data-reveal>
          <div className="auth-showcase-copy">
            <div className="auth-showcase-kicker">Keunggulan</div>
            <p>
              HR dapat menilai <span>rekaman video pelamar</span>, memberi catatan, dan
              memutuskan shortlist lebih cepat dalam satu tampilan.
            </p>
            <div className="auth-showcase-points">
              <span>Replay jawaban</span>
              <span>Nilai soft skill</span>
              <span>Review tim HR</span>
            </div>
          </div>

          <div className="auth-showcase-stage">
            <div className="auth-showcase-carousel">
              <div className="auth-showcase-carousel-shell">
                <div
                  className="auth-showcase-carousel-track"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {loginSlides.map((slide) => (
                    <figure key={slide.src} className="auth-showcase-slide">
                      <img
                        src={slide.src}
                        alt={slide.alt}
                        className="auth-showcase-slide-image"
                      />
                    </figure>
                  ))}
                </div>

                <div className="auth-showcase-carousel-overlay">
                  <span className="auth-showcase-carousel-pill">Review Kandidat</span>
                  <div className="auth-showcase-carousel-caption">
                    <strong>Video screening aktif</strong>
                    <span>Slide otomatis setiap 3 detik</span>
                  </div>
                </div>
              </div>

              <div className="auth-showcase-carousel-dots">
                {loginSlides.map((slide, index) => (
                  <button
                    key={slide.src}
                    type="button"
                    className={`auth-showcase-carousel-dot${
                      currentSlide === index ? ' active' : ''
                    }`}
                    aria-label={`Tampilkan slide ${index + 1}`}
                    aria-pressed={currentSlide === index}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel" data-reveal data-reveal-delay="120ms">
          <div className="auth-panel-inner">
            <div className="auth-panel-brand">
                <img
                  className="auth-panel-brand-image"
                  src="/kerjanusa-logo-cutout.png"
                  alt="KerjaNusa Recruitment Platform"
                />
            </div>

            <div className="auth-panel-copy">
              {loginCopy.heading ? <h1>{loginCopy.heading}</h1> : null}
              <p>{loginCopy.description}</p>
              {loginCopy.helper && <small className="auth-panel-helper">{loginCopy.helper}</small>}
            </div>

            <div className="auth-panel-form">
              <LoginForm
                emailPlaceholder={loginCopy.emailPlaceholder}
                forgotPasswordTo={forgotPasswordTo}
              />
              {loginCopy.registerTo ? (
                <p className="auth-link">
                  {loginCopy.registerLabel}{' '}
                  <Link to={loginCopy.registerTo}>{loginCopy.registerCta}</Link>
                </p>
              ) : (
                <p className="auth-link auth-link-muted">
                  Jika Anda membutuhkan akses superadmin, hubungi administrator utama KerjaNusa.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
