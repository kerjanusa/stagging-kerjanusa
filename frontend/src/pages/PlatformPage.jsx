import { Link } from 'react-router-dom';
import '../styles/platform.css';

const HERO_MARKERS = [
  { value: 'April 2026', label: 'Bogor Launch' },
  { value: 'Indonesia', label: 'Trusted Access' },
  { value: 'KerjaNusa', label: 'Career Bridge' },
];

const MISSION_ITEMS = [
  'Membantu pencari kerja menemukan peluang karier yang sesuai dengan potensi mereka.',
  'Mendukung perusahaan mendapatkan kandidat terbaik secara lebih efektif dan efisien.',
  'Menghadirkan sistem rekrutmen digital yang profesional, aman, dan transparan.',
  'Menjadi bagian dari perkembangan sumber daya manusia Indonesia yang lebih kompetitif dan berkualitas.',
  'Membangun ekosistem rekrutmen modern yang mudah diakses kapan saja dan di mana saja.',
];

const CANDIDATE_BENEFITS = [
  'Lowongan kerja terpercaya dari berbagai perusahaan',
  'Proses melamar kerja yang cepat dan praktis',
  'Informasi karier yang selalu diperbarui',
  'Kesempatan membangun jenjang karier lebih baik',
  'Pengalaman mencari kerja yang aman dan profesional',
];

const RECRUITER_BENEFITS = [
  'Akses kandidat dari berbagai daerah di Indonesia',
  'Proses seleksi lebih cepat dan terstruktur',
  'Efisiensi waktu dan biaya rekrutmen',
  'Sistem manajemen pelamar yang modern',
  'Branding perusahaan lebih profesional di mata kandidat',
];

const VALUE_PILLARS = [
  {
    number: '01',
    icon: '◆',
    title: 'Profesional',
    description: 'Kami mengutamakan kualitas layanan dan pengalaman pengguna terbaik.',
  },
  {
    number: '02',
    icon: '◌',
    title: 'Transparan',
    description: 'Kami percaya proses rekrutmen yang sehat dimulai dari informasi yang jelas dan terpercaya.',
  },
  {
    number: '03',
    icon: '✦',
    title: 'Aman & Terpercaya',
    description: 'Keamanan data pengguna menjadi prioritas utama kami.',
  },
  {
    number: '04',
    icon: '◎',
    title: 'Inovatif',
    description: 'Kami terus berkembang mengikuti kebutuhan dunia kerja modern.',
  },
  {
    number: '05',
    icon: '⟡',
    title: 'Kolaboratif',
    description: 'Kami percaya pertumbuhan terbaik terjadi melalui kerja sama yang kuat antara perusahaan dan talenta.',
  },
];

/**
 * Menampilkan halaman Tentang Kami dengan narasi brand, manfaat, dan kontak utama KerjaNusa.
 */
const PlatformPage = () => {
  return (
    <main className="platform-page" aria-label="Tentang KerjaNusa">
      <div className="platform-shell">
        <section className="platform-hero" id="tentang" data-reveal data-reveal-delay="40ms">
          <div className="platform-hero-copy">
            <span className="platform-hero-kicker">Tentang Kami</span>
            <h1>
              Selamat Datang di
              <em> KerjaNusa.</em>
            </h1>
            <p className="platform-hero-quote">
              “Menghubungkan Talenta Indonesia dengan Peluang Masa Depan.”
            </p>
            <p className="platform-hero-summary">
              KerjaNusa hadir sebagai platform rekrutmen kerja modern yang menghubungkan
              perusahaan dengan talenta terbaik Indonesia secara lebih cepat, profesional,
              dan terpercaya.
            </p>
            <p className="platform-hero-summary">
              Didirikan pada April 2026 di Kabupaten Bogor, Jawa Barat, KerjaNusa dibangun
              untuk menciptakan proses rekrutmen yang lebih mudah, transparan, dan efisien
              di era digital.
            </p>

            <div className="platform-hero-metrics">
              {HERO_MARKERS.map((item) => (
                <article key={item.label} className="platform-hero-metric">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="platform-hero-visual" data-reveal data-reveal-delay="120ms">
            <article className="platform-poster-card">
              <div className="platform-poster-glow" aria-hidden="true" />
              <div className="platform-poster-grid" aria-hidden="true" />
              <div className="platform-poster-copy">
                <span>Opportunity</span>
                <small>Menjadi jembatan antara peluang dan potensi.</small>
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="platform-storyband" id="layanan">
        <div className="platform-shell">
          <div className="platform-story-grid" data-reveal data-reveal-delay="40ms">
            <article className="platform-visual-tile platform-visual-tile-office">
              <span className="platform-visual-label">Why KerjaNusa Exists</span>
              <div className="platform-office-stage" aria-hidden="true">
                <span className="platform-office-table" />
                <span className="platform-office-leg platform-office-leg-left" />
                <span className="platform-office-leg platform-office-leg-right" />
                <span className="platform-office-chair" />
                <span className="platform-office-lamp" />
                <span className="platform-office-floor" />
              </div>
            </article>

            <article className="platform-story-copy">
              <span className="platform-story-kicker">Mengapa KerjaNusa Hadir</span>
              <h2>Peluang kerja yang terpercaya harus lebih mudah dijangkau.</h2>
              <p>
                Di tengah perkembangan dunia kerja yang semakin kompetitif, banyak pelamar
                kesulitan menemukan lowongan terpercaya, sementara perusahaan membutuhkan proses
                rekrutmen yang cepat dan tepat sasaran.
              </p>
              <p>
                KerjaNusa hadir untuk menjawab kebutuhan tersebut melalui platform yang dirancang
                modern, aman, dan mudah digunakan oleh semua kalangan mulai dari fresh graduate,
                profesional berpengalaman, hingga perusahaan dari berbagai industri.
              </p>
            </article>
          </div>

          <div
            className="platform-story-grid platform-story-grid-second"
            data-reveal
            data-reveal-delay="80ms"
          >
            <article className="platform-story-copy platform-story-copy-mission">
              <span className="platform-story-kicker">Visi & Misi</span>
              <h2>Koneksi profesional yang berkualitas dan bisa dipercaya.</h2>
              <p>
                Visi kami adalah menjadi platform rekrutmen kerja terpercaya di Indonesia yang
                mampu menghadirkan koneksi profesional berkualitas antara perusahaan dan pencari
                kerja.
              </p>

              <div className="platform-quote-pill">
                <span className="platform-quote-icon">✦</span>
                <div className="platform-mission-list">
                  {MISSION_ITEMS.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            </article>

            <article className="platform-visual-tile platform-visual-tile-signal">
              <div className="platform-signal-orb" aria-hidden="true">
                <span className="platform-signal-ring platform-signal-ring-1" />
                <span className="platform-signal-ring platform-signal-ring-2" />
                <span className="platform-signal-ring platform-signal-ring-3" />
                <span className="platform-signal-ring platform-signal-ring-4" />
                <span className="platform-signal-core" />
              </div>
              <div className="platform-signal-plaque">
                <strong>Trusted Career Flow</strong>
                <span>Profesional, aman, dan transparan</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="platform-benefits-section" data-reveal data-reveal-delay="40ms">
        <div className="platform-shell">
          <div className="platform-values-heading">
            <div>
              <span className="platform-values-kicker">Untuk Para Pelamar Kerja</span>
              <h2>Peluang kerja yang lebih luas dan lebih terpercaya.</h2>
            </div>
            <p>
              Kami memahami bahwa setiap perjalanan karier dimulai dari satu kesempatan yang tepat.
            </p>
          </div>

          <div className="platform-benefits-grid">
            {CANDIDATE_BENEFITS.map((item) => (
              <article key={item} className="platform-benefit-card">
                <strong>{item}</strong>
              </article>
            ))}
          </div>

          <div className="platform-values-heading platform-values-heading-second">
            <div>
              <span className="platform-values-kicker">Untuk Perusahaan & Rekruter</span>
              <h2>Menemukan kandidat potensial tanpa proses yang rumit.</h2>
            </div>
            <p>
              Kami membantu perusahaan fokus menemukan talenta terbaik dengan proses yang lebih
              efisien dan profesional.
            </p>
          </div>

          <div className="platform-benefits-grid">
            {RECRUITER_BENEFITS.map((item) => (
              <article key={item} className="platform-benefit-card platform-benefit-card-recruiter">
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-values-section" data-reveal data-reveal-delay="40ms">
        <div className="platform-shell">
          <div className="platform-values-heading">
            <div>
              <span className="platform-values-kicker">Nilai Utama Kami</span>
              <h2>Landasan kerja yang kami jaga setiap hari.</h2>
            </div>

            <p>
              KerjaNusa berkomitmen menjadi partner terpercaya bagi pencari kerja maupun perusahaan
              dalam membangun masa depan karier dan bisnis yang lebih baik.
            </p>
          </div>

          <div className="platform-values-grid">
            {VALUE_PILLARS.map((item) => (
              <article key={item.number} className="platform-value-card">
                <span className="platform-value-number">{item.number}</span>
                <span className="platform-value-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-cta-strip" data-reveal data-reveal-delay="40ms">
        <div className="platform-shell platform-cta-shell">
          <div>
            <h2>Bergabung bersama KerjaNusa.</h2>
            <p>
              Temukan peluang terbaik, bangun karier impian, dan temukan talenta terbaik bersama
              KerjaNusa.
            </p>
          </div>

          <Link to="/register?role=candidate" className="platform-cta-button">
            Daftar Sekarang
          </Link>
        </div>
      </section>

      <footer className="platform-footer" id="kontak" data-reveal data-reveal-delay="40ms">
        <div className="platform-shell">
          <div className="platform-footer-grid">
            <div className="platform-footer-brand">
              <Link to="/" className="platform-footer-logo">
                <span className="platform-footer-logo-mark">K</span>
                <span>KerjaNusa</span>
              </Link>
              <p>
                Kami tidak hanya menyediakan platform lowongan kerja, tetapi juga menghadirkan
                ruang bagi peluang, pertumbuhan, dan koneksi profesional yang bernilai.
              </p>
            </div>

            <div className="platform-footer-links">
              <strong>Hubungi Kami</strong>
              <span>Email: kerjanusacompany@gmail.com</span>
              <span>Lokasi: Bogor Barat, Jawa Barat, Indonesia.</span>
            </div>

            <div className="platform-footer-links platform-footer-contact">
              <strong>Komitmen KerjaNusa</strong>
              <span>
                Menjadi partner terpercaya bagi pencari kerja maupun perusahaan dalam membangun
                masa depan yang lebih baik.
              </span>
            </div>
          </div>

          <div className="platform-footer-bottom">
            <span>© 2026 KerjaNusa. Menghubungkan talenta Indonesia dengan peluang masa depan.</span>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default PlatformPage;
