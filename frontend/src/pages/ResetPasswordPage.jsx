import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PasswordField from '../components/PasswordField';
import AuthService from '../services/authService.js';
import { APP_ROUTES, getLoginRouteForRole } from '../utils/routeHelpers.js';
import '../styles/auth.css';
import '../styles/authForm.css';
import '../styles/forgotPassword.css';

const RESET_PASSWORD_COPY = {
  default: {
    heading: 'Buat Password Baru',
    description:
      'Atur password baru untuk kembali membuka akun KerjaNusa Anda dengan aman.',
  },
  recruiter: {
    heading: 'Buat Password Baru Recruiter',
    description:
      'Gunakan password baru untuk kembali mengakses dashboard company, lowongan, dan kandidat Anda.',
  },
  candidate: {
    heading: 'Buat Password Baru Pelamar',
    description:
      'Gunakan password baru agar Anda bisa kembali melamar dan memantau status lamaran kandidat Anda.',
  },
  superadmin: {
    heading: 'Buat Password Baru Superadmin',
    description:
      'Gunakan password baru untuk memulihkan akses dashboard superadmin KerjaNusa secara aman.',
  },
};

const RESET_PASSWORD_STEPS = [
  {
    title: 'Buka link email',
    description: 'Gunakan link reset yang baru saja dikirim ke inbox email Anda.',
  },
  {
    title: 'Masukkan password baru',
    description: 'Pilih password baru yang kuat agar akun tetap aman.',
  },
  {
    title: 'Login kembali',
    description: 'Masuk lagi ke akun Anda menggunakan password yang baru.',
  },
];

/**
 * Menyatukan berbagai bentuk error reset password menjadi satu string UI.
 */
const getErrorMessage = (error, fallback) =>
  typeof error === 'string' ? error : error?.message || fallback;

/**
 * Mengambil error validasi terstruktur bila backend mengirim field-level errors.
 */
const getValidationErrors = (error) =>
  typeof error === 'object' && error?.errors ? error.errors : {};

/**
 * Menyediakan flow penggantian password baru dari link reset yang dikirim via email.
 */
const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const token = searchParams.get('token')?.trim() || '';
  const email = searchParams.get('email')?.trim() || '';
  const requestedRole = searchParams.get('role');
  const entryKey =
    requestedRole === 'candidate' || requestedRole === 'recruiter'
      ? requestedRole
      : requestedRole === 'superadmin' || requestedRole === 'internal'
        ? 'superadmin'
        : 'default';
  const resetPasswordCopy = RESET_PASSWORD_COPY[entryKey];
  const loginTo = useMemo(
    () => (entryKey === 'default' ? APP_ROUTES.login : getLoginRouteForRole(entryKey)),
    [entryKey]
  );
  const forgotPasswordTo = useMemo(
    () =>
      entryKey === 'default'
        ? APP_ROUTES.forgotPassword
        : `${APP_ROUTES.forgotPassword}?role=${entryKey}`,
    [entryKey]
  );
  const isLinkMissing = !token || !email;

  const getFieldError = (fieldName) => validationErrors?.[fieldName]?.[0] || '';
  const hasFieldErrors = Object.keys(validationErrors || {}).length > 0;

  /**
   * Membersihkan error global dan error validasi saat user mengubah input password.
   */
  const clearFeedback = () => {
    if (error || hasFieldErrors) {
      setError('');
      setValidationErrors({});
    }
  };

  /**
   * Mengirim token, email, dan password baru ke endpoint reset password frontend service.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isLinkMissing || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setValidationErrors({});

    try {
      const response = await AuthService.resetPassword({
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });

      setSuccessMessage(
        response?.message || 'Password berhasil diubah. Silakan login dengan password baru Anda.'
      );
    } catch (submissionError) {
      setError(getErrorMessage(submissionError, 'Reset password gagal.'));
      setValidationErrors(getValidationErrors(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page auth-page-forgot">
      <div className="auth-forgot-layout">
        <section className="auth-forgot-showcase" data-reveal>
          <span className="auth-forgot-kicker">Password Baru</span>
          <h1>Reset akses akun</h1>
          <div className="auth-forgot-steps" aria-label="Tahapan reset password">
            {RESET_PASSWORD_STEPS.map((step, index) => (
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
              Link reset password berlaku selama 60 menit dan hanya dapat digunakan satu kali.
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
              <h2>{resetPasswordCopy.heading}</h2>
              <p>{resetPasswordCopy.description}</p>
            </div>

            {successMessage ? (
              <div className="auth-forgot-success">
                <span className="auth-forgot-success-kicker">Password diperbarui</span>
                <h3>Silakan login kembali</h3>
                <p>{successMessage}</p>

                <div className="auth-forgot-success-actions">
                  <Link to={loginTo} className="btn btn-primary">
                    Login sekarang
                  </Link>
                </div>
              </div>
            ) : isLinkMissing ? (
              <div className="auth-forgot-success">
                <span className="auth-forgot-success-kicker">Link tidak lengkap</span>
                <h3>Link reset tidak valid</h3>
                <p>Link reset password ini tidak lengkap. Silakan minta link reset baru dari awal.</p>

                <div className="auth-forgot-success-actions">
                  <Link to={forgotPasswordTo} className="btn btn-primary">
                    Minta link baru
                  </Link>
                  <Link to={loginTo} className="btn btn-outline">
                    Kembali ke login
                  </Link>
                </div>
              </div>
            ) : (
              <form className="auth-form auth-forgot-form" onSubmit={handleSubmit}>
                {error && !getFieldError('token') && !hasFieldErrors && (
                  <div className="error-message">{error}</div>
                )}
                {getFieldError('token') && <div className="error-message">{getFieldError('token')}</div>}

                <div className="form-group">
                  <label htmlFor="reset_password_email">Email</label>
                  <input id="reset_password_email" type="email" value={email} readOnly disabled />
                </div>

                <PasswordField
                  id="reset_password_new"
                  label="Password baru"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFeedback();
                  }}
                  error={getFieldError('password')}
                  autoComplete="new-password"
                  placeholder="Masukkan password baru"
                  required
                  disabled={isSubmitting}
                  visibilityLabel="password baru"
                />

                <PasswordField
                  id="reset_password_confirmation"
                  label="Konfirmasi password baru"
                  value={passwordConfirmation}
                  onChange={(event) => {
                    setPasswordConfirmation(event.target.value);
                    clearFeedback();
                  }}
                  error={getFieldError('password_confirmation')}
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  required
                  disabled={isSubmitting}
                  visibilityLabel="konfirmasi password baru"
                />

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan password baru'}
                </button>

                <p className="auth-forgot-inline-note">
                  Setelah password berhasil diubah, semua sesi login lama untuk akun ini akan
                  diminta masuk kembali.
                </p>

                <p className="auth-link auth-forgot-back-link">
                  <Link to={loginTo}>Kembali ke login</Link>
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
