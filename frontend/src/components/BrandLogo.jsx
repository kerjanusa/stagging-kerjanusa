/**
 * Menampilkan logo brand ringkas yang dipakai di shell autentikasi.
 */
const BrandLogo = () => {
  return (
    <div className="auth-brand-logo">
      <img
        className="auth-brand-logo-image"
        src="/kerjanusa-logo-cutout.png"
        alt="KerjaNusa Recruitment Platform"
      />
    </div>
  );
};

export default BrandLogo;
