import { useState } from 'react';
import useAuth from '../hooks/useAuth';

/**
 * Menyederhanakan berbagai bentuk error API menjadi satu string yang siap ditampilkan.
 */
const getErrorMessage = (error) => {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.errors) {
    return Object.values(error.errors)
      .flat()
      .join(' ');
  }

  return 'Pendaftaran gagal. Coba lagi.';
};

/**
 * Menormalkan nomor telepon lokal ke format +62 yang dipakai backend.
 */
const normalizePhoneNumber = (rawPhone) => {
  const digits = rawPhone.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `+62${digits}` : '';
};

/**
 * Membuat password awal otomatis agar form landing tidak perlu meminta password manual.
 */
const createStarterPassword = (rawPhone) => {
  const digits = rawPhone.replace(/\D/g, '');
  const tail = digits.slice(-4).padStart(4, '0');
  return `Kerja${tail}24`;
};

/**
 * Menyediakan form pendaftaran recruiter singkat untuk landing page marketing.
 */
const LandingRegisterForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    referral_code: '',
  });
  const [successMessage, setSuccessMessage] = useState('');
  const { register, isLoading, error, clearError } = useAuth();

  const errorMessage = getErrorMessage(error);

  /**
   * Menyimpan perubahan input lalu membersihkan pesan sukses/error lama agar form tetap sinkron.
   */
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    if (successMessage) {
      setSuccessMessage('');
    }

    if (error) {
      clearError();
    }
  };

  /**
   * Mengirim form recruiter landing ke endpoint register dengan password otomatis.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    const generatedPassword = createStarterPassword(formData.phone);

    try {
      await register({
        ...formData,
        phone: normalizePhoneNumber(formData.phone),
        role: 'recruiter',
        password: generatedPassword,
        password_confirmation: generatedPassword,
      });

      setSuccessMessage(
        `Akun recruiter berhasil dibuat. Password awal Anda: ${generatedPassword}. Simpan lalu ubah setelah login.`
      );
    } catch {
      // Error state is already managed in the auth store.
    }
  };

  return (
    <form className="landing-signup-form" onSubmit={handleSubmit}>
      <h2>Buat Akun dan Mulai Rekrut Kandidat!</h2>

      {errorMessage && <div className="error landing-signup-message">{errorMessage}</div>}
      {successMessage && <div className="success landing-signup-message">{successMessage}</div>}

      <div className="landing-signup-grid">
        <div className="form-group">
          <label htmlFor="landing-name">Nama Lengkap*</label>
          <input
            id="landing-name"
            name="name"
            type="text"
            placeholder="Masukkan nama lengkap"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="landing-company">Nama Perusahaan/Bisnis Terdaftar*</label>
          <input
            id="landing-company"
            name="company_name"
            type="text"
            placeholder="Masukkan nama perusahaan"
            value={formData.company_name}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="landing-email">Email Bisnis (Untuk verifikasi)*</label>
          <input
            id="landing-email"
            name="email"
            type="email"
            placeholder="Masukkan email bisnis"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="landing-phone">Nomor Whatsapp*</label>
          <div className="landing-phone-field">
            <span className="landing-phone-prefix">+62</span>
            <input
              id="landing-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              placeholder="823 4567 8910"
              value={formData.phone}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="landing-referral">Kode Referral</label>
        <input
          id="landing-referral"
          name="referral_code"
          type="text"
          placeholder="Masukkan kode referral jika ada"
          value={formData.referral_code}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      <button type="submit" className="btn btn-primary landing-signup-submit" disabled={isLoading}>
        {isLoading ? 'Memproses...' : 'Daftar Sekarang'}
      </button>

      <p className="landing-signup-footnote">
        Dengan mendaftar, saya setuju dengan <a href="/#tentang">Syarat & Ketentuan</a> dari
        KerjaNusa
      </p>
    </form>
  );
};

export default LandingRegisterForm;
