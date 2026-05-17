import { Link } from 'react-router-dom';
import '../styles/platform.css';

const HERO_MARKERS = [
  { value: '01.', label: 'Founding Vision' },
  { value: '14.', label: 'April Launch' },
  { value: 'ID.', label: 'Nationwide' },
];

const VALUE_PILLARS = [
  {
    number: '01',
    icon: '⌘',
    title: 'Profesionalisme',
    description:
      'Menjaga standar layanan yang rapi, jelas, dan dapat diandalkan untuk setiap proses rekrutmen.',
  },
  {
    number: '02',
    icon: '◌',
    title: 'Integritas',
    description:
      'Mendorong proses seleksi yang transparan agar perusahaan dan kandidat sama-sama percaya.',
  },
  {
    number: '03',
    icon: '✦',
    title: 'Inovasi',
    description:
      'Menghadirkan fitur yang relevan dengan dinamika pasar kerja yang terus bergerak progresif.',
  },
  {
    number: '04',
    icon: '◎',
    title: 'Kolaborasi',
    description:
      'Membangun hubungan yang kuat dengan perusahaan, pencari kerja, dan mitra ekosistem.',
  },
];

const FOOTER_LINKS = {
  company: ['Tentang Kami', 'Kisah Kami', 'Karir', 'Blog'],
  services: ['Cari Lowongan', 'Untuk Perusahaan', 'Rekrutmen Global', 'Bantuan'],
};

/**
 * Menyajikan halaman profil platform dan nilai utama perusahaan dalam format editorial.
 */
const PlatformPage = () => {
  return (
    <main className="platform-page" aria-label="Tentang KerjaNusa">
      <div className="platform-shell">
        <section className="platform-hero" id="tentang" data-reveal data-reveal-delay="40ms">
          <div className="platform-hero-copy">
            <span className="platform-hero-kicker">Est. 2024</span>
            <h1>
              Visi Besar,
              <em> Talenta Unggul.</em>
            </h1>
            <p className="platform-hero-quote">“Menjembatani Talenta, Membangun Negeri.”</p>

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
                <span>Collaboration</span>
                <small>Menyatukan talenta, industri, dan visi bertumbuh.</small>
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="platform-storyband" id="layanan">
        <div className="platform-shell">
          <div className="platform-story-grid" data-reveal data-reveal-delay="40ms">
            <article className="platform-visual-tile platform-visual-tile-office">
              <span className="platform-visual-label">Modern Office</span>
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
              <span className="platform-story-kicker">Our Narrative</span>
              <h2>Lahir dari Dinamika Digital Bogor.</h2>
              <p>
                Didirikan pada <strong>14 April 2024</strong> di Bogor oleh Danny Ekananda Dista
                Farma, KerjaNusa bukan sekadar platform rekrutmen biasa.
              </p>
              <p>
                Kami lahir dari kebutuhan mendalam akan sebuah ekosistem yang mampu menyelaraskan
                kecepatan perkembangan teknologi dengan kebutuhan manusia akan pekerjaan yang
                bermakna.
              </p>
            </article>
          </div>

          <div className="platform-story-grid platform-story-grid-second" data-reveal data-reveal-delay="80ms">
            <article className="platform-story-copy platform-story-copy-mission">
              <span className="platform-story-kicker">Our Mission</span>
              <h2>Menghubungkan Potensi Tanpa Batas.</h2>
              <p>
                Kami berkomitmen meningkatkan kualitas rekrutmen di Indonesia dengan menjembatani
                pencari kerja dan perusahaan melalui teknologi digital yang efisien dan inklusif.
              </p>

              <div className="platform-quote-pill">
                <span className="platform-quote-icon">✦</span>
                <p>
                  “Visi kami adalah menjadi katalisator terbukanya bakat bagi talenta Indonesia di
                  panggung dunia.”
                </p>
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
                <strong>Inklusivitas</strong>
                <span>Core Pillar</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="platform-values-section" data-reveal data-reveal-delay="40ms">
        <div className="platform-shell">
          <div className="platform-values-heading">
            <div>
              <span className="platform-values-kicker">Values & DNA</span>
              <h2>Landasan Strategis KerjaNusa.</h2>
            </div>

            <p>
              Membangun kepercayaan melalui transparansi dan inovasi berkelanjutan.
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
            <h2>Siap Menemukan Potensi Anda?</h2>
            <p>Gabung bersama ribuan talenta lainnya di KerjaNusa hari ini.</p>
          </div>

          <Link to="/register" className="platform-cta-button">
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
                Membangun jembatan digital bagi talenta masa depan Indonesia menuju kesuksesan
                karir yang berkelanjutan.
              </p>

              <div className="platform-footer-socials">
                <a href="https://instagram.com" target="_blank" rel="noreferrer">
                  IG
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer">
                  LI
                </a>
                <a href="https://twitter.com" target="_blank" rel="noreferrer">
                  TW
                </a>
              </div>
            </div>

            <div className="platform-footer-links">
              <strong>Perusahaan</strong>
              {FOOTER_LINKS.company.map((item) => (
                <a key={item} href="#tentang">
                  {item}
                </a>
              ))}
            </div>

            <div className="platform-footer-links">
              <strong>Layanan</strong>
              {FOOTER_LINKS.services.map((item) => (
                <a key={item} href="#layanan">
                  {item}
                </a>
              ))}
            </div>

            <div className="platform-footer-links platform-footer-contact">
              <strong>Hubungi Kami</strong>
              <span>Bogor, Jawa Barat, Indonesia</span>
              <a href="mailto:contact@kerjanusa.com">contact@kerjanusa.com</a>
            </div>
          </div>

          <div className="platform-footer-bottom">
            <span>© 2024 KerjaNusa. Seluruh hak cipta dilindungi.</span>
            <div>
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default PlatformPage;
