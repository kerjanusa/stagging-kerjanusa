import { Link } from 'react-router-dom';
import '../styles/about.css';

const quickPoints = [
  'Posting lowongan lebih ringkas',
  'Review kandidat lebih visual',
  'Shortlist terasa lebih cepat',
];

const compactStats = [
  {
    value: '80.000+',
    label: 'perusahaan pernah menggunakan ekosistem KerjaNusa',
  },
  {
    value: '10 juta+',
    label: 'jangkauan kandidat aktif untuk kebutuhan hiring',
  },
  {
    value: '1 dashboard',
    label: 'untuk publish, review, dan shortlist',
  },
  {
    value: '< 24 jam',
    label: 'waktu tercepat mulai menerima kandidat relevan',
  },
];

const featureCards = [
  {
    title: 'Go live lebih cepat',
    description: 'Tim recruiter bisa buka lowongan tanpa tersangkut alur yang terlalu panjang.',
    accent: 'blue',
  },
  {
    title: 'Review yang lebih kebaca',
    description: 'Video, skor, dan catatan HR tampil lebih dekat dalam satu konteks.',
    accent: 'orange',
  },
  {
    title: 'Biaya tetap masuk akal',
    description: 'Cukup kuat untuk operasional, tanpa terasa terlalu berat untuk tim kecil.',
    accent: 'navy',
  },
];

const workflowSteps = [
  {
    title: 'Publish',
    description: 'Buka lowongan dan jalankan kebutuhan hiring dari satu flow yang ringkas.',
  },
  {
    title: 'Review',
    description: 'Lihat kandidat, catatan tim, dan hasil video interview tanpa pindah-pindah tool.',
  },
  {
    title: 'Decide',
    description: 'Shortlist kandidat yang paling masuk akal untuk lanjut ke tahap berikutnya.',
  },
];

/**
 * Menampilkan halaman tentang produk, positioning, dan CTA recruiter KerjaNusa.
 */
const AboutPage = () => {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-shell">
          <div className="about-hero-grid">
            <div className="about-hero-copy" data-reveal data-reveal-delay="40ms">
              <span className="about-eyebrow">Tentang KerjaNusa</span>
              <h1>Platform hiring yang rapi, cepat, dan enak dipakai recruiter.</h1>
              <p>
                KerjaNusa membantu perusahaan membuka lowongan, menilai kandidat, dan membuat
                shortlist dari dashboard yang lebih bersih dan lebih mudah dibaca.
              </p>

              <div className="about-hero-actions">
                <Link to="/register" className="btn btn-primary">
                  Buat akun recruiter
                </Link>
                <Link to="/jobs" className="btn about-btn-soft">
                  Lihat lowongan aktif
                </Link>
              </div>

              <div className="about-point-list">
                {quickPoints.map((item) => (
                  <span key={item} className="about-point-pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="about-hero-media" data-reveal data-reveal-delay="140ms">
              <div className="about-hero-shot">
                <img
                  src="/hero-slides/review-2.jpeg"
                  alt="Dashboard kandidat untuk review video interview dan penilaian soft skill."
                  className="about-shot-image"
                />

                <div className="about-floating-note">
                  <strong>Review kandidat lebih visual</strong>
                  <span>Skor, catatan HR, dan status kandidat tampil lebih dekat.</span>
                </div>
              </div>

              <div className="about-media-stack">
                <article className="about-mini-card">
                  <span className="about-mini-label">Match score</span>
                  <strong>96%</strong>
                  <p>Kandidat potensial lebih cepat terlihat.</p>
                </article>

                <article className="about-mini-card about-mini-card-image">
                  <img
                    src="/hero-slides/review-3.jpeg"
                    alt="Contoh tampilan shortlist kandidat dengan pertanyaan dan jawaban interview."
                    className="about-stack-image"
                    loading="lazy"
                  />
                </article>
              </div>
            </div>
          </div>

          <div className="about-stat-strip">
            {compactStats.map((item, index) => (
              <article
                key={item.value}
                className="about-stat-card"
                data-reveal
                data-reveal-delay={`${index * 70}ms`}
              >
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section">
        <div className="about-shell">
          <div className="about-section-heading" data-reveal>
            <span className="about-eyebrow">Yang bikin terasa beda</span>
            <h2>Lebih sedikit keramaian. Lebih banyak konteks yang memang berguna.</h2>
            <p>
              Kami sengaja membuat pengalaman yang lebih singkat dan lebih visual supaya recruiter
              tidak lelah membaca halaman yang terlalu penuh.
            </p>
          </div>

          <div className="about-feature-grid">
            {featureCards.map((item, index) => (
              <article
                key={item.title}
                className="about-feature-card"
                data-reveal
                data-reveal-delay={`${index * 80}ms`}
              >
                <span className={`about-feature-icon about-feature-icon-${item.accent}`} />
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section">
        <div className="about-shell">
          <div className="about-section-heading about-section-heading-compact" data-reveal>
            <span className="about-eyebrow">Alur singkat</span>
            <h2>Didesain untuk ritme kerja recruiter.</h2>
          </div>

          <div className="about-workflow-grid">
            {workflowSteps.map((item, index) => (
              <article
                key={item.title}
                className="about-workflow-card"
                data-reveal
                data-reveal-delay={`${index * 80}ms`}
              >
                <span className="about-workflow-number">0{index + 1}</span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section">
        <div className="about-shell">
          <div className="about-cta-card" data-reveal>
            <div className="about-cta-copy">
              <span className="about-eyebrow">Mulai lebih rapi</span>
              <h2>Kalau hiring sudah sibuk, platformnya jangan ikut bikin capek.</h2>
              <p>
                Mulai dari lowongan aktif, review kandidat, sampai shortlist dari workflow yang
                lebih bersih dan lebih enak dilihat.
              </p>
            </div>

            <div className="about-cta-actions">
              <Link to="/register" className="btn btn-primary">
                Mulai rekrut kandidat
              </Link>
              <Link to="/jobs" className="btn about-btn-outline">
                Lihat contoh lowongan
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AboutPage;
