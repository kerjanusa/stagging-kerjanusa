import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthService from '../services/authService.js';
import { APP_ROUTES, getLoginRouteForRole } from '../utils/routeHelpers.js';
import '../styles/auth.css';
import '../styles/authForm.css';
import '../styles/forgotPassword.css';

const FORGOT_PASSWORD_COPY = {
  default: {
    heading: 'Reset Password Akun',
    description:
      'Masukkan email yang Anda gunakan saat login. Kami akan menyiapkan instruksi pemulihan akses secara aman.',
    emailPlaceholder: 'Email recruiter / pelamar / admin',
    loginTo: APP_ROUTES.login,
    loginLabel: 'Kembali ke login',
    helper: 'Gunakan email yang sama dengan akun KerjaNusa Anda.',
  },
  recruiter: {
    heading: 'Reset Password Company',
    description:
      'Masukkan email recruiter atau company yang terdaftar untuk menerima panduan reset password dashboard company.',
    emailPlaceholder: 'Email recruiter / company',
    loginTo: getLoginRouteForRole('recruiter'),
    loginLabel: 'Kembali ke login company',
    helper: 'Pastikan alamat email anda sudah sesuai dengan akun terdaftar',
  },
  candidate: {
    heading: 'Reset Password Pelamar',
    description:
      'Masukkan email pelamar yang terdaftar agar Anda bisa melanjutkan proses melamar dan membuka kembali dashboard kandidat.',
    emailPlaceholder: 'Email pelamar',
    loginTo: getLoginRouteForRole('candidate'),
    loginLabel: 'Kembali ke login pelamar',
    helper: 'Instruksi reset akan dikirim ke email yang terkait dengan akun pelamar.',
  },
  superadmin: {
    heading: 'Reset Password Superadmin',
    description:
      'Masukkan email superadmin KerjaNusa yang terdaftar untuk menerima instruksi pemulihan akses dashboard utama.',
    emailPlaceholder: 'Email superadmin KerjaNusa',
    loginTo: getLoginRouteForRole('superadmin'),
    loginLabel: 'Kembali ke login superadmin',
    helper: 'Untuk akun superadmin, gunakan email resmi yang sudah didaftarkan oleh administrator utama.',
  },
};

const FORGOT_PASSWORD_STEPS = [
  {
    title: 'Masukkan email',
    description: 'Gunakan email yang sama dengan akun login Anda.',
  },
  {
    title: 'Cek inbox',
    description: 'Instruksi reset akan dikirim ke email jika akun ditemukan.',
  },
  {
    title: 'Buat password baru',
    description: 'Atur ulang akses agar bisa masuk kembali ke dashboard Anda.',
  },
];

/**
 * Menyediakan flow permintaan link reset password yang netral untuk semua role.
 */
const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [debugResetUrl, setDebugResetUrl] = useState('');
  const [debugResetExpiresMinutes, setDebugResetExpiresMinutes] = useState(60);
  const [isCopyingDebugUrl, setIsCopyingDebugUrl] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const requestedRole = searchParams.get('role');
  const entryKey =
    requestedRole === 'candidate' || requestedRole === 'recruiter'
      ? requestedRole
      : requestedRole === 'superadmin' || requestedRole === 'internal'
        ? 'superadmin'
        : 'default';
  const forgotPasswordCopy = FORGOT_PASSWORD_COPY[entryKey];
  const hasFieldErrors = Object.keys(validationErrors || {}).length > 0;
  const getFieldError = (fieldName) => validationErrors?.[fieldName]?.[0] || '';

  /**
   * Menghapus pesan error lama saat user mulai memperbaiki input email.
   */
  const clearFeedback = () => {
    if (error || hasFieldErrors) {
      setError('');
      setValidationErrors({});
    }
  };

  /**
   * Mengirim email ke endpoint forgot password lalu menampilkan status generik yang aman.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setValidationErrors({});

    try {
      const response = await AuthService.forgotPassword(email.trim());
      setSubmittedEmail(email.trim());
      setSuccessMessage(
        response?.message || 'Jika email terdaftar, link reset password telah dikirim ke email Anda.'
      );
      setDebugResetUrl(response?.debug_reset_url || '');
      setDebugResetExpiresMinutes(Number(response?.debug_reset_expires_minutes || 60));
      setCopyFeedback('');
    } catch (submissionError) {
      setError(
        typeof submissionError === 'string'
          ? submissionError
          : submissionError?.message || 'Permintaan reset password gagal.'
      );
      setValidationErrors(
        typeof submissionError === 'object' && submissionError?.errors ? submissionError.errors : {}
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Mengembalikan panel sukses ke state form kosong agar user bisa mencoba email lain.
   */
  const handleReset = () => {
    setSubmittedEmail('');
    setSuccessMessage('');
    setError('');
    setValidationErrors({});
    setDebugResetUrl('');
    setDebugResetExpiresMinutes(60);
    setCopyFeedback('');
  };

  /**
   * Copy the staging debug URL so internal testing can continue without email delivery.
   */
  const handleCopyDebugUrl = async () => {
    if (!debugResetUrl || isCopyingDebugUrl) {
      return;
    }

    try {
      setIsCopyingDebugUrl(true);
      await navigator.clipboard.writeText(debugResetUrl);
      setCopyFeedback('Link reset berhasil disalin.');
    } catch {
      setCopyFeedback('Gagal menyalin link reset. Buka langsung lewat tombol di bawah.');
    } finally {
      setIsCopyingDebugUrl(false);
    }
  };

  return (
    <div className="auth-page auth-page-forgot">
      <div className="auth-forgot-layout">
        <section className="auth-forgot-showcase" data-reveal>
          <span className="auth-forgot-kicker">Pemulihan Akses</span>
          <h1>Tata cara penggunaan</h1>
          <div className="auth-forgot-steps" aria-label="Tahapan reset password">
            {FORGOT_PASSWORD_STEPS.map((step, index) => (
              <article key={step.title} className="auth-forgot-step">
                <span className="auth-forgot-step-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="auth-forgot-note">
            <strong>Catatan keamanan</strong>
            <p>
              Demi menjaga privasi akun, sistem tidak akan menampilkan apakah email tertentu
              terdaftar atau tidak.
            </p>
          </div>
        </section>

        <section className="auth-forgot-panel" data-reveal data-reveal-delay="120ms">
          <div className="auth-forgot-panel-inner">
            <div className="auth-panel-brand auth-forgot-brand">
              <img
                className="auth-panel-brand-image"
                src="/kerjanusa-logo-cutout.png"
                alt="KerjaNusa Recruitment Platform"
              />
            </div>

            <div className="auth-forgot-copy">
              <h2>{forgotPasswordCopy.heading}</h2>
              <p>{forgotPasswordCopy.helper}</p>
            </div>

            {submittedEmail ? (
              <div className="auth-forgot-success">
                <span className="auth-forgot-success-kicker">Permintaan diterima</span>
                <h3>Cek email Anda</h3>
                <p>{successMessage}</p>
                <p>
                  Jika <strong>{submittedEmail}</strong> terdaftar, buka inbox email tersebut lalu
                  gunakan link reset yang berlaku selama 60 menit.
                </p>

                {debugResetUrl ? (
                  <div className="auth-forgot-debug">
                    <strong>Link reset staging siap dipakai</strong>
                    <p>
                      Pengiriman email staging masih bisa terlambat. Untuk lanjut sekarang, buka
                      link reset langsung di bawah ini. Link berlaku {debugResetExpiresMinutes}{' '}
                      menit.
                    </p>
                    <div className="auth-forgot-debug-actions">
                      <a
                        href={debugResetUrl}
                        className="btn btn-primary"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka link reset
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleCopyDebugUrl}
                        disabled={isCopyingDebugUrl}
                      >
                        {isCopyingDebugUrl ? 'Menyalin...' : 'Salin link reset'}
                      </button>
                    </div>
                    <code className="auth-forgot-debug-url">{debugResetUrl}</code>
                    {copyFeedback ? <p className="auth-forgot-debug-feedback">{copyFeedback}</p> : null}
                  </div>
                ) : null}

                <div className="auth-forgot-success-actions">
                  <Link to={forgotPasswordCopy.loginTo} className="btn btn-primary">
                    {forgotPasswordCopy.loginLabel}
                  </Link>
                  <button type="button" className="btn btn-outline" onClick={handleReset}>
                    Gunakan email lain
                  </button>
                </div>
              </div>
            ) : (
              <form className="auth-form auth-forgot-form" onSubmit={handleSubmit}>
                {error && !hasFieldErrors && <div className="error-message">{error}</div>}

                <div className={`form-group${getFieldError('email') ? ' has-error' : ''}`}>
                  <label htmlFor="forgot_password_email">Email</label>
                  <input
                    id="forgot_password_email"
                    type="email"
                    autoComplete="email"
                    placeholder={forgotPasswordCopy.emailPlaceholder}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearFeedback();
                    }}
                    required
                    disabled={isSubmitting}
                    aria-invalid={Boolean(getFieldError('email'))}
                  />
                  {getFieldError('email') && <p className="field-error">{getFieldError('email')}</p>}
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Mengirim...' : 'Kirim tautan reset'}
                </button>

                <p className="auth-forgot-inline-note">
                  Jika email terdaftar, kami akan mengirim panduan pemulihan akses ke inbox Anda.
                </p>

                <p className="auth-link auth-forgot-back-link">
                  <Link to={forgotPasswordCopy.loginTo}>
                    {forgotPasswordCopy.loginLabel}
                  </Link>
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
