import { Link, useSearchParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import RegisterForm from '../components/RegisterForm.jsx';
import '../styles/auth.css';

const REGISTER_COPY = {
  default: {
    heading: 'Daftar akun baru',
    description:
      'Pilih jalur recruiter atau pelamar, lalu lanjutkan pendaftaran sesuai kebutuhan Anda.',
  },
  recruiter: {
    heading: 'Daftar sebagai recruiter',
    description:
      'Buka akun recruiter untuk memasang lowongan dan mengelola kandidat dari satu dashboard.',
  },
  candidate: {
    heading: 'Daftar sebagai kandidat',
    description:
      'Buka akun kandidat untuk melamar lowongan dan mengikuti proses rekrutmen yang tersedia.',
  },
};

/**
 * Menyediakan shell register dengan copy yang mengikuti role dari query string.
 */
const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const selectedRole = requestedRole === 'candidate' ? 'candidate' : 'recruiter';
  const loginRoute =
    requestedRole === 'candidate'
      ? '/login?role=candidate'
      : requestedRole === 'recruiter'
        ? '/login?role=recruiter'
        : '/login';
  const registerCopy =
    requestedRole === 'candidate'
      ? REGISTER_COPY.candidate
      : requestedRole === 'recruiter'
        ? REGISTER_COPY.recruiter
        : REGISTER_COPY.default;

  return (
    <div className="auth-page auth-page-register">
      <div className="auth-container auth-container-wide auth-container-register">
        <div className="auth-card auth-card-register" data-reveal>
          <div className="auth-brand auth-brand-register">
            <BrandLogo />
            <div className="auth-brand-copy auth-brand-copy-register">
              <h1>{registerCopy.heading}</h1>
              <p>{registerCopy.description}</p>
            </div>
          </div>
          <RegisterForm defaultRole={selectedRole} />
          <p className="auth-link auth-link-register">
            Sudah punya akun? <Link to={loginRoute}>Login di sini</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
