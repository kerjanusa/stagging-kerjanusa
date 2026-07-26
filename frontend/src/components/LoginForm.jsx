import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import AuthService from '../services/authService.js';
import PasswordField from './PasswordField';
import '../styles/authForm.css';

/**
 * Menyediakan form login umum dengan wiring error state dari auth store.
 */
const LoginForm = ({
  onSuccess,
  emailPlaceholder = 'Email recruiter / company',
  forgotPasswordTo = '/forgot-password',
  oauthRole = 'candidate',
  showOAuthLogin = true,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [oauthError, setOauthError] = useState('');
  const { login, isLoading, error, validationErrors, clearError } = useAuth();

  const hasFieldErrors = Object.keys(validationErrors || {}).length > 0;
  const formError = oauthError || error;
  const canUseOAuthLogin = showOAuthLogin && AuthService.canUseOAuthLogin();

  /**
   * Mengambil error pertama untuk field tertentu agar input cukup membaca satu sumber pesan.
   */
  const getFieldError = (fieldName) => validationErrors?.[fieldName]?.[0] || '';

  /**
   * Menyimpan perubahan email lalu membersihkan feedback lama yang sudah tidak relevan.
   */
  const handleEmailChange = (value) => {
    setEmail(value);

    if (error || hasFieldErrors) {
      clearError();
    }

    if (oauthError) {
      setOauthError('');
    }
  };

  /**
   * Menyimpan perubahan password lalu mereset pesan error yang sudah basi.
   */
  const handlePasswordChange = (value) => {
    setPassword(value);

    if (error || hasFieldErrors) {
      clearError();
    }

    if (oauthError) {
      setOauthError('');
    }
  };

  /**
   * Mengirim kredensial login ke auth store dan meneruskan hasil sukses ke parent bila ada.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const authData = await login(email, password, { rememberDevice });
      onSuccess?.(authData);
    } catch {
      // Error is handled by Zustand store
    }
  };

  /**
   * Mulai OAuth login lewat backend agar callback tetap memakai token Sanctum aplikasi.
   */
  const handleOAuthLogin = (provider) => {
    try {
      window.location.assign(AuthService.getOAuthRedirectUrl(provider, oauthRole));
    } catch (error) {
      setOauthError(error?.message || 'Login Google/Facebook belum bisa diproses.');
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {formError && !hasFieldErrors && <div className="error-message">{formError}</div>}

      <div className={`form-group${getFieldError('email') ? ' has-error' : ''}`}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder={emailPlaceholder}
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          required
          disabled={isLoading}
          aria-invalid={Boolean(getFieldError('email'))}
        />
        {getFieldError('email') && <p className="field-error">{getFieldError('email')}</p>}
      </div>

      <PasswordField
        id="password"
        label="Password"
        value={password}
        onChange={(e) => handlePasswordChange(e.target.value)}
        error={getFieldError('password')}
        autoComplete="current-password"
        placeholder="Ketik password"
        required
        disabled={isLoading}
      />

      <div className="auth-form-support">
        <label className="auth-form-remember" htmlFor="remember_device">
          <input
            id="remember_device"
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={isLoading}
          />
          <span>Ingat perangkat ini</span>
        </label>
        <Link
          to={forgotPasswordTo}
          className={`auth-form-forgot${isLoading ? ' is-disabled' : ''}`}
          onClick={(event) => {
            if (isLoading) {
              event.preventDefault();
            }
          }}
          aria-disabled={isLoading}
        >
          Lupa kata sandi?
        </Link>
      </div>

      <button type="submit" className="btn btn-primary" disabled={isLoading}>
        {isLoading ? 'Memproses...' : 'Login'}
      </button>

      {canUseOAuthLogin ? (
        <>
          <div className="auth-social-divider">
            <span>atau</span>
          </div>
          <div className="auth-social-actions" aria-label="Pilihan login sosial">
            <button
              type="button"
              className="auth-social-button"
              onClick={() => handleOAuthLogin('google')}
              disabled={isLoading}
            >
              <span className="auth-social-icon auth-social-icon-google" aria-hidden="true">
                G
              </span>
              <span>Google</span>
            </button>
            <button
              type="button"
              className="auth-social-button"
              onClick={() => handleOAuthLogin('facebook')}
              disabled={isLoading}
            >
              <span className="auth-social-icon auth-social-icon-facebook" aria-hidden="true">
                f
              </span>
              <span>Facebook</span>
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
};

export default LoginForm;
