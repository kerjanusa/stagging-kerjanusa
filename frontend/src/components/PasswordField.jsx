import { useState } from 'react';

/**
 * Merender ikon mata terbuka atau tertutup sesuai status visibilitas password.
 */
const PasswordVisibilityIcon = ({ isVisible }) => {
  const iconProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (isVisible) {
    return (
      <svg {...iconProps}>
        <path d="M2.8 12s3.2-5.5 9.2-5.5S21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z" />
        <path d="m4 4 16 16" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <path d="M2.8 12s3.2-5.5 9.2-5.5S21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
};

/**
 * Membungkus input password dengan tombol toggle agar field bisa ditampilkan atau disembunyikan.
 */
const PasswordField = ({
  id,
  name,
  label,
  value,
  onChange,
  error = '',
  placeholder,
  autoComplete = 'current-password',
  disabled = false,
  required = false,
  visibilityLabel = 'password',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="password-input-shell">
        <input
          id={id}
          name={name}
          type={isVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          className="password-visibility-toggle"
          onClick={() => setIsVisible((currentValue) => !currentValue)}
          disabled={disabled}
          aria-label={isVisible ? `Sembunyikan ${visibilityLabel}` : `Tampilkan ${visibilityLabel}`}
          aria-pressed={isVisible}
          aria-controls={id}
        >
          <PasswordVisibilityIcon isVisible={isVisible} />
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
};

export default PasswordField;
