import { useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { APP_ROUTES } from '../utils/routeHelpers.js';
import '../styles/whatsappFloating.css';

const CONTACT_WHATSAPP_LINK =
  'https://api.whatsapp.com/send?phone=6281286402753&text=Halo%20KerjaNusa';

/**
 * Menampilkan shortcut WhatsApp hanya untuk pengunjung publik yang belum login.
 * Token dipakai sebagai guard awal agar tombol tidak sempat muncul di area kandidat
 * saat role user belum selesai dinormalisasi dari session tersimpan.
 */
const WhatsAppFloatingButton = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const normalizedRole = user?.role === 'internal' ? 'superadmin' : user?.role;

  if (token || normalizedRole || location.pathname === APP_ROUTES.adminDashboard) {
    return null;
  }

  return (
    <a
      href={CONTACT_WHATSAPP_LINK}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-floating-button"
      aria-label="Chat WhatsApp KerjaNusa"
    >
      <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.11 17.18c-.29-.14-1.7-.84-1.97-.93-.26-.1-.45-.14-.64.14-.19.29-.73.93-.89 1.12-.17.19-.33.22-.62.07-.29-.14-1.2-.44-2.29-1.41-.85-.76-1.42-1.69-1.59-1.98-.17-.29-.02-.45.12-.59.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.09-.19.05-.36-.02-.5-.08-.14-.64-1.55-.88-2.13-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36-.26.29-.99.97-.99 2.36s1.02 2.73 1.16 2.91c.14.19 2 3.04 4.84 4.27.68.29 1.2.46 1.61.59.68.22 1.31.19 1.8.12.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Z"
        />
        <path
          fill="currentColor"
          d="M16.01 4.8c-6.12 0-11.1 4.96-11.1 11.06 0 1.95.51 3.86 1.48 5.53L4.8 27.2l5.99-1.57a11.13 11.13 0 0 0 5.22 1.33h.01c6.12 0 11.1-4.96 11.1-11.07 0-2.96-1.15-5.75-3.25-7.84A11.02 11.02 0 0 0 16.01 4.8Zm0 20.27h-.01c-1.67 0-3.31-.45-4.74-1.3l-.34-.2-3.56.93.95-3.47-.22-.35a9.17 9.17 0 0 1-1.42-4.83c0-5.06 4.13-9.18 9.21-9.18 2.45 0 4.76.95 6.49 2.68a9.1 9.1 0 0 1 2.69 6.48c0 5.06-4.13 9.18-9.2 9.18Z"
        />
      </svg>
    </a>
  );
};

export default WhatsAppFloatingButton;
