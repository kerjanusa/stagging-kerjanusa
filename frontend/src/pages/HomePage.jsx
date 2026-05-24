import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import LandingRegisterForm from '../components/LandingRegisterForm.jsx';
import useAuth from '../hooks/useAuth.js';
import { RECRUITER_PLAN_OPTIONS } from '../utils/recruiterPlans.js';
import { getDefaultRouteForRole, normalizeUserRole } from '../utils/routeHelpers.js';
import '../styles/home.css';

const brandList = [
  {
    name: 'Vismaya',
    src: '/partner-logos/vismaya-clean.png',
  },
  {
    name: 'Dkriuk Fried Chicken',
    src: '/partner-logos/dkriuk-fried-chicken.png',
  },
  {
    name: 'GMP',
    src: '/partner-logos/gmp.png',
  },
  {
    name: 'Kawan Lama Group',
    src: '/partner-logos/kawan-lama-group.png',
  },
  {
    name: 'CP Food Division',
    src: '/partner-logos/cp-food-division-clean.png',
  },
  {
    name: 'Mixue',
    src: '/partner-logos/mixue.png',
  },
  {
    name: 'J.Chicken',
    src: '/partner-logos/j-chicken-clean.png',
  },
];

const faqItems = [
  {
    question: 'Apa itu KerjaNusa?',
    answer:
      'KerjaNusa adalah platform rekrutmen untuk perusahaan yang ingin memasang lowongan, menjaring kandidat, dan mengelola proses hiring dalam satu dashboard.',
  },
  {
    question: 'Ada berapa jenis layanan di KerjaNusa?',
    answer:
      'Saat ini tersedia layanan pemasangan lowongan, distribusi lowongan ke partner, pengelolaan kandidat, dan form pendaftaran recruiter untuk mulai hiring lebih cepat.',
  },
  {
    question: 'Apakah pemasangan lowongan kerja di KerjaNusa dipungut biaya?',
    answer:
      'Untuk campaign dasar, perusahaan dapat mulai memasang lowongan tanpa biaya. Opsi lanjutan bisa disesuaikan dengan kebutuhan rekrutmen tim Anda.',
  },
  {
    question: 'Berapa lama proses pemasangan lowongan kerja di KerjaNusa?',
    answer:
      'Setelah akun recruiter dibuat, lowongan bisa dipasang dalam hitungan menit. Tim cukup melengkapi informasi posisi, lokasi, dan kriteria kandidat.',
  },
];

const recruiterPackageColumns = RECRUITER_PLAN_OPTIONS.map((plan) => ({
  code: plan.code,
  label: plan.label,
}));

const recruiterPackageRows = [
  {
    feature: 'Cocok untuk',
    values: Object.fromEntries(
      RECRUITER_PLAN_OPTIONS.map((plan) => [plan.code, plan.description])
    ),
  },
  {
    feature: 'Lowongan aktif',
    values: Object.fromEntries(
      RECRUITER_PLAN_OPTIONS.map((plan) => [
        plan.code,
        plan.job_limit === null ? 'Unlimited' : `${plan.job_limit} lowongan`,
      ])
    ),
  },
  {
    feature: 'Talent search',
    values: Object.fromEntries(
      RECRUITER_PLAN_OPTIONS.map((plan) => [plan.code, `${plan.talent_result_limit} kandidat`])
    ),
  },
  {
    feature: 'CV kandidat terlihat',
    values: Object.fromEntries(
      RECRUITER_PLAN_OPTIONS.map((plan) => [plan.code, `${plan.visible_resume_files} CV`])
    ),
  },
  {
    feature: 'Sertifikat kandidat terlihat',
    values: Object.fromEntries(
      RECRUITER_PLAN_OPTIONS.map((plan) => [
        plan.code,
        plan.visible_certificate_files > 0
          ? `${plan.visible_certificate_files} sertifikat`
          : 'Belum tersedia',
      ])
    ),
  },
  {
    feature: 'Chat dengan kandidat',
    values: Object.fromEntries(RECRUITER_PLAN_OPTIONS.map((plan) => [plan.code, true])),
  },
  {
    feature: 'Chat dengan superadmin',
    values: Object.fromEntries(RECRUITER_PLAN_OPTIONS.map((plan) => [plan.code, true])),
  },
];

const packageTableColumnTemplate = `minmax(240px, 1.85fr) repeat(${recruiterPackageColumns.length}, minmax(150px, 0.78fr))`;

const formatPackageFeatureValue = (value) => {
  if (typeof value === 'boolean') {
    return (
      <span
        className={`comparison-status${
          value ? ' comparison-status-positive' : ' comparison-status-negative'
        }`}
        aria-label={value ? 'Tersedia' : 'Tidak tersedia'}
      >
        {value ? '✓' : '×'}
      </span>
    );
  }

  return value;
};

const aboutMetrics = [
  {
    value: '80.000+',
    label: 'perusahaan telah mempercayai KerjaNusa untuk kebutuhan hiring mereka',
  },
  {
    value: '10 juta+',
    label: 'jangkauan kandidat aktif dari distribusi lowongan dan talent search',
  },
  {
    value: '< 24 jam',
    label: 'waktu tercepat untuk mulai menerima kandidat yang relevan',
  },
];

const aboutPillars = [
  {
    title: 'Publikasi yang Luas',
    description:
      'Lowongan dapat dipasang cepat dan didistribusikan ke channel yang membantu tim recruitment menjangkau kandidat lebih banyak.',
  },
  {
    title: 'Screening yang Rapi',
    description:
      'Tim HR dapat menyaring kandidat, membaca kecocokan, dan meninjau hasil video interview dari alur kerja yang lebih terstruktur.',
  },
  {
    title: 'Keputusan yang Lebih Yakin',
    description:
      'Dari shortlist sampai evaluasi kandidat, seluruh proses dibuat agar recruiter bisa bergerak cepat tanpa kehilangan kualitas penilaian.',
  },
];

const heroBenefitItems = [
  'Jumlah loker aktif unlimited',
  'Screening CV lebih efisien',
  'Cari kandidat dengan Talent Search',
  'Jangkau 10 juta+ kandidat',
];

/**
 * Menjadi landing utama KerjaNusa dengan CTA yang menyesuaikan peran user aktif.
 */
const HomePage = () => {
  const { user } = useAuth();
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const userRole = normalizeUserRole(user?.role);

  if (user && userRole !== 'recruiter') {
    return <Navigate to={getDefaultRouteForRole(userRole)} replace />;
  }

  const heroActionSet = user
    ? userRole === 'recruiter'
      ? {
          primary: { label: 'Pasang Loker Sekarang', to: '/recruiter/jobs/create' },
          secondary: { label: 'Dashboard Company', to: '/recruiter' },
          supportLinks: [
            { label: 'Cari Pekerjaan', to: '/jobs' },
            { label: 'Tentang Kami', to: '/platform' },
          ],
        }
      : userRole === 'candidate'
        ? {
            primary: { label: 'Lihat Lowongan', to: '/jobs' },
            secondary: { label: 'Info Data Diri', to: '/candidate' },
            supportLinks: [
              { label: 'Chat Kandidat', to: '/candidate#chat' },
              { label: 'Tentang Kami', to: '/platform' },
            ],
          }
        : {
            primary: { label: 'Dashboard Admin', to: '/admin' },
            secondary: { label: 'Moderasi Lowongan', to: '/admin#moderasi' },
            supportLinks: [
              { label: 'Monitoring Pelamar', to: '/admin#pelamar' },
              { label: 'Tentang Kami', to: '/platform' },
            ],
          }
    : {
        primary: { label: 'Pasang Loker Sekarang', to: '/register?role=recruiter' },
        secondary: { label: 'Lihat Lowongan', to: '/jobs' },
        supportLinks: [
          { label: 'Login Recruiter', to: '/login?role=recruiter' },
          { label: 'Daftar Pelamar', to: '/register?role=candidate' },
          { label: 'Tentang Kami', to: '/platform' },
        ],
      };

  /**
   * Membuka atau menutup satu item FAQ agar interaksi accordion tetap sederhana.
   */
  const toggleFaq = (index) => {
    setOpenFaqIndex((currentIndex) => (currentIndex === index ? null : index));
  };

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-shell home-hero-grid">
          <div className="hero-copy" data-reveal data-reveal-delay="40ms">
            <span className="hero-kicker">Dashboard Awal</span>
            <h1 className="hero-headline">
              <span className="hero-headline-line">Pasang</span>
              <span className="hero-headline-line">Loker</span>
              <span className="hero-headline-line">Gratis</span>
              <span className="hero-headline-line hero-headline-accent">TANPA BATAS!</span>
            </h1>
            <span className="hero-headline-bar" aria-hidden="true" />
            <p className="hero-description hero-description-spotlight">
              Kelola hiring dari publikasi lowongan sampai shortlist kandidat dalam tampilan
              yang cepat, rapi, dan mudah dipakai tim recruiter.
            </p>

            <div className="hero-benefits" aria-label="Keunggulan utama KerjaNusa">
              {heroBenefitItems.map((benefit) => (
                <span key={benefit} className="hero-benefit-item">
                  {benefit}
                </span>
              ))}
            </div>

            <div className="hero-actions">
              <Link to={heroActionSet.primary.to} className="btn btn-hero btn-primary">
                {heroActionSet.primary.label}
              </Link>
              <Link
                to={heroActionSet.secondary.to}
                className="btn btn-hero btn-ghost btn-hero-secondary"
              >
                {heroActionSet.secondary.label}
              </Link>
            </div>

            <div className="hero-support-links" aria-label="Akses cepat tambahan">
              {heroActionSet.supportLinks.map((link) => (
                <Link key={link.label} to={link.to} className="hero-support-link">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hero-visual" data-reveal data-reveal-delay="140ms">
            <div className="hero-showcase">
              <div className="hero-showcase-chip">Recruitment Flow yang Lebih Cepat</div>

              <div className="hero-showcase-panel">
                <div className="hero-showcase-badge hero-showcase-badge-top">
                  Review video interview lebih jelas
                </div>

                <div className="hero-phone-frame">
                  <img
                    src="/hero-slides/review-1.jpeg"
                    alt="Tampilan evaluasi kandidat KerjaNusa"
                    className="hero-phone-screen"
                  />
                </div>

                <div className="hero-showcase-badge hero-showcase-badge-bottom">
                  Shortlist kandidat lebih cepat
                </div>
              </div>

              <div className="hero-showcase-note">
                <strong>Publikasi, screening, dan shortlist dalam satu alur.</strong>
                <span>
                  Cocok untuk recruiter yang ingin pasang lowongan cepat tanpa proses manual
                  yang berulang.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-trust-section" aria-label="Kepercayaan perusahaan">
        <div className="home-shell">
          <div className="about-trust about-trust-standalone" data-reveal>
            <p className="about-trust-copy">
              Dipercaya oleh 80.000+ perusahaan ternama yang telah mempercayai KerjaNusa
            </p>
            <div className="brand-marquee" aria-label="Partner logos">
              <div className="brand-track">
                {[...brandList, ...brandList].map((brand, index) => (
                  <div key={`${brand.name}-${index}`} className="brand-logo-item">
                    <img
                      src={brand.src}
                      alt={brand.name}
                      className="brand-logo-image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section" id="tentang">
        <div className="home-shell">
          <div className="about-card" data-reveal>
            <div className="about-copy">
              <span className="about-kicker">Tentang Kami</span>
              <h2>Platform rekrutmen modern untuk perusahaan yang ingin hiring lebih cepat tanpa proses yang berantakan.</h2>
              <p>
                KerjaNusa dibangun untuk membantu HR dan recruiter mempublikasikan
                lowongan, menjangkau kandidat yang relevan, meninjau pelamar, dan mengambil
                keputusan dengan lebih percaya diri dari satu alur kerja yang rapi.
              </p>

              <div className="about-metrics">
                {aboutMetrics.map((metric) => (
                  <article key={metric.label} className="about-metric-card">
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="about-stage" aria-hidden="true">
              <div className="about-stage-panel">
                <div className="about-stage-chip">Hiring Command Center</div>
                <div className="about-stage-header">
                  <strong>Lebih cepat menyaring kandidat yang tepat</strong>
                  <span>Satu alur kerja untuk publish, review, dan shortlist</span>
                </div>

                <div className="about-stage-grid">
                  <div className="about-stage-stat">
                    <b>3x</b>
                    <span>screening lebih efisien</span>
                  </div>
                  <div className="about-stage-stat">
                    <b>1</b>
                    <span>dashboard terpadu</span>
                  </div>
                  <div className="about-stage-stat">
                    <b>CV + Video</b>
                    <span>review lebih lengkap</span>
                  </div>
                  <div className="about-stage-stat">
                    <b>Real-time</b>
                    <span>monitoring kandidat aktif</span>
                  </div>
                </div>

                <div className="about-stage-bars">
                  <span className="about-stage-bar about-stage-bar-primary" />
                  <span className="about-stage-bar about-stage-bar-secondary" />
                  <span className="about-stage-bar about-stage-bar-accent" />
                </div>
              </div>

              <div className="about-stage-note">
                <strong>Dirancang untuk tim recruiter yang butuh gerak cepat.</strong>
                <span>Lebih sedikit pekerjaan manual, lebih banyak keputusan yang tepat.</span>
              </div>
            </div>
          </div>

          <div className="about-pillars">
            {aboutPillars.map((pillar, index) => (
              <article
                key={pillar.title}
                className="about-pillar-card"
                data-reveal
                data-reveal-delay={`${index * 80}ms`}
              >
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-register-section">
        <div className="home-shell">
          <div className="comparison-card" id="daftar-paket" data-reveal>
            <div className="comparison-heading">
              <span className="comparison-kicker">Daftar paket</span>
              <h2>Daftar Paket KerjaNusa untuk Recruiter</h2>
              <p>
                Bandingkan langsung manfaat utama setiap layanan KerjaNusa sebelum mulai rekrut
                kandidat.
              </p>
            </div>

            <div className="comparison-table" role="table" aria-label="Daftar paket recruiter KerjaNusa">
              <div className="comparison-table-head" role="rowgroup">
                <div
                  className="comparison-table-row comparison-table-row-head"
                  role="row"
                  style={{ gridTemplateColumns: packageTableColumnTemplate, minWidth: '760px' }}
                >
                  <div className="comparison-cell comparison-cell-feature" role="columnheader">
                    Fitur
                  </div>
                  {recruiterPackageColumns.map((plan, index) => (
                    <div
                      key={plan.code}
                      className={`comparison-cell comparison-cell-brand${
                        index === 0 ? ' comparison-cell-brand-primary' : ''
                      }`}
                      role="columnheader"
                    >
                      {plan.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="comparison-table-body" role="rowgroup">
                {recruiterPackageRows.map((row) => (
                  <div
                    key={row.feature}
                    className="comparison-table-row"
                    role="row"
                    style={{ gridTemplateColumns: packageTableColumnTemplate, minWidth: '760px' }}
                  >
                    <div
                      className="comparison-cell comparison-cell-feature"
                      role="cell"
                      data-label="Fitur"
                    >
                      {row.feature}
                    </div>
                    {recruiterPackageColumns.map((plan, index) => (
                      <div
                        key={`${row.feature}-${plan.code}`}
                        className={`comparison-cell comparison-cell-value${
                          index === 0 ? ' comparison-cell-value-primary' : ''
                        }`}
                        role="cell"
                        data-label={plan.label}
                      >
                        {formatPackageFeatureValue(row.values[plan.code])}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="home-register-card" id="daftar" data-reveal data-reveal-delay="80ms">
            <LandingRegisterForm />
          </div>
        </div>
      </section>

      <section className="home-faq-section" id="faq">
        <div className="home-shell faq-layout" data-reveal>
          <div className="faq-visual" aria-hidden="true">
            <div className="faq-brand-card">
              <span className="faq-brand-logo" />
            </div>
            <div className="faq-blob faq-blob-soft" />
            <div className="faq-scribble">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="faq-content">
            <div className="faq-heading">
              <h2>Paling Sering Ditanyakan</h2>
            </div>

            <div className="faq-list">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;

                return (
                  <article
                    key={item.question}
                    className={`faq-item${isOpen ? ' faq-item-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <span className="faq-toggle">{isOpen ? '−' : '⌄'}</span>
                    </button>
                    {isOpen && <p className="faq-answer">{item.answer}</p>}
                  </article>
                );
              })}
            </div>

            <a href="#daftar" className="faq-more-link">
              tunggu apalagi, daftar akun sekarang...
              <span>→</span>
            </a>
          </div>
        </div>
      </section>

      <section className="home-article-section">
        <div className="home-shell article-shell">
          <article className="article-content" data-reveal>
            <h3>Cara Mencari Pekerja di KerjaNusa</h3>
            <p>
              KerjaNusa merupakan platform rekrutmen online yang membantu perusahaan memasang
              lowongan kerja dan mendapatkan calon karyawan dengan proses yang lebih cepat dan
              praktis. Perusahaan dapat membuat lowongan, menerima lamaran, lalu menyaring
              kandidat dari satu tempat.
            </p>
            <p>
              Dengan memasang lowongan kerja di KerjaNusa, lowongan dapat dijangkau oleh lebih
              banyak pencari kerja aktif. Anda cukup melengkapi informasi posisi, lokasi, dan
              kebutuhan kandidat, lalu tim rekrutmen bisa segera mulai menerima pelamar yang masuk.
            </p>

            <h3>Kelebihan pasang lowongan kerja di KerjaNusa</h3>
            <p>
              Yang membedakan KerjaNusa dari platform pasang loker lain adalah fokusnya pada proses
              rekrutmen yang ringan, cepat, dan mudah dijalankan tim perusahaan. Berikut beberapa
              keunggulan utamanya.
            </p>

            <h4>1. Lowongan kerja mudah ditemukan</h4>
            <p>
              Dengan posting lowongan kerja di KerjaNusa, posisi yang Anda buka dapat terlihat oleh
              lebih banyak kandidat potensial. Hal ini membantu perusahaan mendapatkan lamaran yang
              lebih relevan untuk kebutuhan posisi yang sedang dibuka.
            </p>

            <h4>2. Kualitas pelamar yang bermutu</h4>
            <p>
              Proses rekrutmen menjadi lebih terarah karena perusahaan bisa fokus pada kandidat yang
              paling sesuai dengan kriteria. Dengan begitu, waktu seleksi bisa dipangkas dan tim
              dapat bergerak lebih cepat ke tahap interview.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
