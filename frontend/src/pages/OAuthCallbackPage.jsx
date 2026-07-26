import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { APP_ROUTES, getDefaultRouteForRole } from '../utils/routeHelpers.js';
import '../styles/auth.css';
import '../styles/authForm.css';

const parseCallbackParams = (location) => {
  const fragmentParams = new URLSearchParams(
    location.hash?.startsWith('#') ? location.hash.slice(1) : location.hash
  );
  const queryParams = new URLSearchParams(location.search);

  return {
    token: fragmentParams.get('token') || queryParams.get('token') || '',
    error: fragmentParams.get('error') || queryParams.get('error') || '',
  };
};

/**
 * Menyelesaikan OAuth callback dengan token Sanctum dari backend.
 */
const OAuthCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [statusMessage, setStatusMessage] = useState('Menyelesaikan login...');
  const [errorMessage, setErrorMessage] = useState('');
  const callbackParams = useMemo(() => parseCallbackParams(location), [location]);

  useEffect(() => {
    let isMounted = true;

    if (callbackParams.error) {
      setErrorMessage(callbackParams.error);
      setStatusMessage('Login belum berhasil.');
      return () => {
        isMounted = false;
      };
    }

    if (!callbackParams.token) {
      setErrorMessage('Token login tidak diterima. Silakan coba lagi.');
      setStatusMessage('Login belum berhasil.');
      return () => {
        isMounted = false;
      };
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, document.title, APP_ROUTES.oauthCallback);
    }

    completeOAuthLogin(callbackParams.token)
      .then((authData) => {
        if (!isMounted) {
          return;
        }

        navigate(getDefaultRouteForRole(authData.user?.role), { replace: true });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error?.message || 'Login Google/Facebook gagal. Silakan coba lagi.');
        setStatusMessage('Login belum berhasil.');
      });

    return () => {
      isMounted = false;
    };
  }, [callbackParams, completeOAuthLogin, navigate]);

  return (
    <div className="auth-page auth-page-login auth-page-oauth-callback">
      <section className="auth-panel auth-oauth-panel">
        <div className="auth-panel-inner">
          <div className="auth-panel-brand">
            <img
              className="auth-panel-brand-image"
              src="/kerjanusa-logo-cutout.png"
              alt="KerjaNusa Recruitment Platform"
            />
          </div>

          <div className="auth-panel-copy">
            <h1>{statusMessage}</h1>
            <p>
              {errorMessage
                ? 'Silakan kembali ke halaman login untuk mencoba metode lain.'
                : 'Mohon tunggu sebentar.'}
            </p>
          </div>

          {errorMessage ? (
            <div className="auth-form">
              <div className="error-message">{errorMessage}</div>
              <Link to={APP_ROUTES.login} className="btn btn-primary">
                Kembali ke login
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default OAuthCallbackPage;
