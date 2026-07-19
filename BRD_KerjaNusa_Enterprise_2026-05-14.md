# Business Requirement Document
## KerjaNusa Recruitment Platform

## 1. Cover Document
| Item | Detail |
| --- | --- |
| Nama dokumen | Business Requirement Document (BRD) |
| Nama aplikasi | KerjaNusa Recruitment Platform |
| Jenis aplikasi | Aplikasi web rekrutmen multi-role |
| Lokasi source code yang dianalisis | `/home/lutfi/Dokumen/lutfi/dani/v3` |
| Tanggal analisis | 14 Mei 2026 |
| Dasar analisis | Source code frontend React/Vite, backend Laravel, migration database, route API, konfigurasi environment, dan dokumen pendukung repo |
| Versi dokumen | 1.0 |
| Penyusun | Analisis otomatis berbasis inspeksi source code lokal |
| Status dokumen | Draft analitis siap review bisnis, produk, dan engineering |

## 2. Executive Summary
KerjaNusa adalah platform rekrutmen berbasis web yang mempertemukan kandidat, recruiter/perusahaan, dan superadmin dalam satu ekosistem operasional. Sistem saat ini sudah mencakup fondasi penting berupa autentikasi multi-role, katalog lowongan publik, proses lamaran kandidat, dashboard recruiter untuk mengelola lowongan dan kandidat, talent search berbasis paket, pusat kontrol superadmin, serta kanal komunikasi internal berbentuk chat.

Dari hasil analisis source code, aplikasi ini paling kuat pada area berikut:

1. Pemisahan peran yang jelas antara kandidat, recruiter, dan superadmin.
2. Workflow lowongan dan lamaran yang sudah dipetakan sampai level stage.
3. Model monetisasi awal berbasis paket recruiter.
4. Dashboard admin yang cukup kaya untuk monitoring operasional.
5. Arsitektur deployment yang memisahkan frontend dan backend API secara jelas.

Secara bisnis, KerjaNusa berpotensi diposisikan sebagai platform hiring end-to-end untuk perusahaan skala kecil sampai menengah yang membutuhkan proses publish lowongan, screening kandidat, shortlist, komunikasi, dan kontrol admin dalam satu dashboard. Namun, ada beberapa area yang masih bersifat parsial atau belum sepenuhnya enterprise-ready, terutama pada upload berkas nyata, audit trail persisten, notifikasi operasional selain reset password, persistence untuk sebagian kriteria lowongan recruiter, dan konsistensi routing serverless pada semua endpoint produksi.

## 3. Project Background
KerjaNusa dibangun sebagai platform rekrutmen digital yang menyederhanakan proses hiring dari tiga sisi utama:

1. Kandidat membutuhkan kanal pencarian kerja, profil siap lamar, status lamaran, dan komunikasi dengan recruiter.
2. Recruiter membutuhkan dashboard untuk publish lowongan, mengelola pipeline kandidat, dan mencari talent secara proaktif.
3. Superadmin membutuhkan visibilitas penuh atas pengguna, lowongan, aplikasi, antrian moderasi, dan kesehatan operasional platform.

Stack aplikasi yang ditemukan:

| Layer | Teknologi |
| --- | --- |
| Frontend | React 18, React Router, Axios, Zustand, Vite |
| Backend | Laravel 10, PHP 8.1+, Laravel Sanctum |
| Database | MySQL/MariaDB untuk lokal, PostgreSQL untuk alternatif deployment |
| Deployment | Frontend dan backend dapat dideploy terpisah sesuai kebutuhan infrastruktur |
| Messaging email | Laravel Mail dengan mode `log` default, siap diarahkan ke SMTP |
| Persistensi sisi browser | `localStorage` untuk session, mock mode, profil kandidat, profil recruiter, state UI tertentu |

## 4. Business Problem
Masalah bisnis yang berusaha diselesaikan oleh aplikasi:

| Area | Business Problem |
| --- | --- |
| Akuisisi kandidat | Perusahaan membutuhkan jalur cepat untuk mempublikasikan lowongan dan menerima kandidat tanpa tooling yang terfragmentasi. |
| Screening awal | Recruiter perlu memilah kandidat dengan ringkas melalui profil, pertanyaan screening, dan video intro. |
| Tracking proses | Kandidat sering tidak punya visibilitas atas progres lamaran; recruiter juga sering kehilangan konteks pipeline per lowongan. |
| Governance | Platform membutuhkan kontrol admin atas recruiter, kandidat, lowongan, status akun, dan moderasi operasional. |
| Monetisasi | Perlu pembatasan akses recruiter melalui paket, terutama pada jumlah lowongan aktif, hasil talent search, dan visibilitas dokumen kandidat. |
| Komunikasi | Proses rekrutmen sering berpindah ke kanal eksternal; sistem ini mencoba menyediakan komunikasi internal yang tetap terikat pada konteks hiring. |

## 5. Project Objectives
Tujuan proyek yang dapat diturunkan dari implementasi saat ini:

1. Menyediakan platform rekrutmen terpadu untuk kandidat, recruiter, dan superadmin.
2. Mempercepat publish lowongan dan penerimaan lamaran.
3. Memungkinkan recruiter melakukan screening kandidat dari dashboard yang terstruktur.
4. Memberikan kandidat pengalaman apply yang jelas, terukur, dan bisa dilacak.
5. Menyediakan kontrol admin untuk menjaga kualitas akun, lowongan, dan operasional platform.
6. Menyediakan model paket recruiter sebagai dasar komersialisasi layanan.

## 6. Scope Project
### 6.1 In Scope
| Domain | Cakupan |
| --- | --- |
| Akses publik | Landing, halaman company profile, daftar lowongan, login, registrasi, forgot/reset password |
| Kandidat | Profil siap lamar, rekomendasi lowongan, apply, monitoring lamaran, chat |
| Recruiter | Profil company, create/publish lowongan, lifecycle lowongan, pipeline kandidat, talent search, paket recruiter, chat |
| Superadmin | Monitoring, analytics, manajemen kandidat, manajemen recruiter, manajemen lowongan, moderasi, chat |
| Backend API | Auth, profile, jobs, applications, recruiter workspace, admin dashboard, chat, health check |
| Data | Users, jobs, applications, password reset tokens, messages |

### 6.2 Partially Implemented / Gap Scope
| Area | Temuan |
| --- | --- |
| Upload system | CV, sertifikat, dan foto kandidat saat ini dominan berupa penyimpanan metadata nama file di JSON/browser, belum ada storage file enterprise yang nyata. |
| Notifikasi | Notifikasi email operasional di luar reset password belum ditemukan. |
| Audit trail | Log aktivitas admin bersifat komputasi dari data operasional, belum berupa tabel audit trail persisten. |
| Kriteria lowongan recruiter | Beberapa field UI seperti gender, pendidikan, usia, domisili, shift, dan expiry date belum dipersist ke backend/database. |
| Billing paket | Perubahan paket recruiter belum terhubung ke payment gateway atau approval billing. |

### 6.3 Out of Scope pada implementasi saat ini
| Area | Status |
| --- | --- |
| Payment gateway | Belum ada |
| E-signature / kontrak digital | Belum ada |
| Interview scheduler terintegrasi kalender | Belum ada |
| Push notification / WhatsApp automation backend | Belum ada |
| Machine learning recommendation service terpisah | Belum ada |
| ATS document parser / CV parser | Belum ada |

## 7. Stakeholder Analysis
| Stakeholder | Kepentingan | Kebutuhan utama | Pengaruh |
| --- | --- | --- | --- |
| Kandidat | Mendapat pekerjaan dan kepastian proses | Profil yang mudah diisi, apply cepat, status lamaran jelas, akses chat | Tinggi |
| Recruiter | Mendapat kandidat relevan lebih cepat | Publish lowongan, screening, shortlist, talent search, komunikasi | Tinggi |
| Superadmin | Menjaga kualitas platform dan operasional | Monitoring penuh, moderasi, aktivasi/suspend akun, analitik, export | Sangat tinggi |
| Product Owner | Pertumbuhan bisnis dan adopsi fitur | Funnel yang jelas, monetisasi paket, insight usage | Sangat tinggi |
| Tim Engineering | Stabilitas sistem dan maintainability | Arsitektur modular, validasi, deployment jelas, observability | Tinggi |
| Tim Business Development | Akuisisi recruiter | Value proposition, paket recruiter, data perusahaan | Menengah |
| Tim Support/Operations | Menangani isu pengguna | Reset password, chat, visibilitas akun, reason suspend | Menengah |

## 8. User Roles & Permissions
| Role | Hak akses utama | Batasan |
| --- | --- | --- |
| Guest | Melihat landing, platform/about, daftar lowongan, login, register, forgot/reset password | Tidak dapat mengakses dashboard dan endpoint protected |
| Candidate | Mengelola profil sendiri, melihat rekomendasi lowongan, melamar, melihat lamaran sendiri, membatalkan lamaran aktif, chat recruiter terkait lamaran dan superadmin | Tidak dapat mengelola lowongan, talent search, atau data kandidat lain |
| Recruiter | Mengelola profil company sendiri, membuat/mengubah/menghapus lowongan sendiri, melihat kandidat pelamar pada lowongan miliknya, mengubah stage kandidat, talent search, chat kandidat terkait dan superadmin, mengganti paket | Tidak dapat mengakses dashboard admin atau data recruiter lain |
| Superadmin | Melihat monitoring global, mengelola kandidat dan recruiter, mengubah status akun non-superadmin, mengirim reset link, mengubah verifikasi recruiter, memindahkan lowongan ke recruiter lain, mengubah status lowongan, moderasi, export data, chat semua kandidat/recruiter | Tidak ada UI untuk mengubah akun superadmin lain; backend juga memblokir edit superadmin melalui endpoint admin user update |

## 9. Existing Business Process
### 9.1 Candidate Journey Existing
1. Guest membuka landing atau halaman lowongan.
2. Kandidat registrasi atau login.
3. Kandidat mengisi profil minimum agar status menjadi siap lamar.
4. Kandidat mencari lowongan publik, difilter berdasarkan kata kunci, lokasi, tipe kerja, dan level.
5. Kandidat membuka modal lamaran, menjawab screening, dan mengirim video jika diwajibkan.
6. Kandidat memantau progres lamaran pada dashboard.
7. Kandidat berkomunikasi dengan recruiter atau superadmin melalui chat internal.

### 9.2 Recruiter Journey Existing
1. Recruiter registrasi atau login.
2. Recruiter melengkapi profil company.
3. Recruiter membuat lowongan melalui wizard multi-step.
4. Lowongan dapat disimpan draft atau dipublikasikan aktif.
5. Recruiter mengelola status lifecycle lowongan.
6. Recruiter memantau kandidat per lowongan dan memindahkan kandidat antar stage.
7. Recruiter menjalankan talent search sesuai paket.
8. Recruiter berkomunikasi dengan kandidat atau superadmin.

### 9.3 Superadmin Journey Existing
1. Superadmin login ke dashboard admin.
2. Superadmin memantau metrik pengguna, lowongan, lamaran, dan health.
3. Superadmin mengelola status kandidat/recruiter.
4. Superadmin memverifikasi recruiter.
5. Superadmin memoderasi lowongan dan akun yang perlu tindakan.
6. Superadmin memindahkan lowongan ke recruiter lain bila diperlukan.
7. Superadmin mengekspor data CSV dan menangani komunikasi via inbox admin.

## 10. Proposed Business Process
Proses bisnis yang direkomendasikan agar sistem siap dipakai perusahaan besar:

1. Kandidat wajib melalui profile readiness gate sebelum apply.
2. Recruiter wajib lolos verifikasi company sebelum publish lowongan aktif pertama.
3. Semua stage kandidat menjadi sumber kebenaran proses hiring, bukan hanya status biner.
4. Paket recruiter dijadikan dasar entitlement sistem, termasuk quota dan visibilitas dokumen.
5. Superadmin memiliki SLA moderasi dan governance terhadap akun/lowongan berisiko.
6. Audit trail persisten, notification center, dan file storage resmi perlu dijadikan fase lanjutan wajib.

## 11. System Workflow
```text
Guest
  -> Landing / Jobs / Login / Register
  -> Candidate login -> Candidate Dashboard -> Profile Ready -> Apply -> Track -> Chat
  -> Recruiter login -> Recruiter Dashboard -> Company Profile -> Create Job -> Publish
                      -> Candidate Pipeline -> Talent Search -> Chat
  -> Superadmin login -> Monitoring -> Manage Accounts -> Moderate Jobs -> Export / Chat

Core Data Flow
Frontend React
  -> Axios API Client
  -> Laravel Controllers
  -> Service Layer
  -> Eloquent Models
  -> MySQL / PostgreSQL
```

## 12. Detailed Functional Requirements
### FR-01 Segmentasi Portal & Akses Berbasis Peran
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-01 |
| Feature Name | Segmentasi portal, routing publik, dan redirect berbasis peran |
| Description | Sistem menyediakan landing, login, dan redirect dashboard yang berbeda untuk guest, candidate, recruiter, dan superadmin. |
| Business Goal | Mengurangi kebingungan akses dan mempercepat pengguna masuk ke alur yang relevan. |
| User Role | Guest, Candidate, Recruiter, Superadmin |
| Preconditions | Browser dapat mengakses frontend; bila user sudah login, session token tersedia di local storage. |
| Main Flow | 1. Guest membuka landing atau root path.<br>2. Sistem menampilkan portal masuk berdasarkan role.<br>3. Jika user sudah login, sistem mengarahkan ke dashboard role masing-masing.<br>4. Protected route memblokir role yang tidak sesuai. |
| Alternative Flow | 1. Kandidat yang sebelumnya berniat apply namun belum login disimpan `apply intent` lalu diarahkan ke login candidate.<br>2. Setelah login, kandidat dikembalikan ke konteks lowongan semula. |
| Validation Rules | Hanya role `candidate`, `recruiter`, `superadmin` yang memiliki dashboard. Hash URL di dashboard dipetakan ke section yang valid. |
| Error Conditions | Role tidak sesuai dengan halaman tujuan; session hilang; route tidak dikenali. |
| Success Conditions | User masuk ke dashboard/halaman yang sesuai tanpa melihat menu yang tidak relevan. |
| Data Input | Query string `role`, status autentikasi, hash route, apply intent tersimpan. |
| Data Output | Navigasi halaman, menu role-based, redirect otomatis. |
| API Related | Tidak wajib API khusus; bergantung pada data user tersimpan dan endpoint `/api/me` saat refresh session. |
| Database Related | Tidak ada entitas baru. |
| Security Consideration | Frontend route guard harus selalu dilengkapi proteksi backend `auth:sanctum` dan `role`. |
| Priority Level | High |

### FR-02 Registrasi Akun
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-02 |
| Feature Name | Registrasi akun kandidat dan recruiter |
| Description | Guest dapat membuat akun baru sebagai kandidat atau recruiter. |
| Business Goal | Membuka funnel akuisisi user baru untuk dua segmen utama platform. |
| User Role | Guest |
| Preconditions | Email dan nomor telepon belum terdaftar. |
| Main Flow | 1. User membuka halaman register.<br>2. User memilih role kandidat atau recruiter.<br>3. User mengisi nama, email, nomor telepon, password, dan konfirmasi password.<br>4. Backend memvalidasi data.<br>5. Sistem membuat akun, menerbitkan token, dan menyimpan session. |
| Alternative Flow | 1. User langsung masuk dari landing dengan role default tertentu.<br>2. Jika backend mock mode aktif, sistem membuat akun demo di local storage. |
| Validation Rules | Nama wajib.<br>Email wajib, format valid, unik.<br>Phone wajib, unik.<br>Password minimal 8 karakter, mengandung huruf dan angka.<br>Role publik hanya `candidate` dan `recruiter`. |
| Error Conditions | Email duplikat, nomor telepon duplikat, password tidak memenuhi syarat, konfirmasi password tidak cocok. |
| Success Conditions | Akun aktif terbentuk dan user otomatis masuk ke sistem. |
| Data Input | `name`, `email`, `phone`, `role`, `password`, `password_confirmation`. |
| Data Output | `user`, `token`, status akun `active`. |
| API Related | `POST /api/register` |
| Database Related | Tabel `users` kolom `name`, `email`, `password`, `role`, `phone`, `account_status`, `company_name/recruiter_profile` sesuai role. |
| Security Consideration | Password di-hash; email dan phone dinormalisasi; role superadmin tidak boleh diregistrasi publik. |
| Priority Level | Critical |

### FR-03 Login, Session, dan Logout
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-03 |
| Feature Name | Login multi-role, session management, dan logout |
| Description | User dapat masuk menggunakan email dan password; session disimpan sebagai token bearer. |
| Business Goal | Menyediakan kontrol akses aman dan sederhana untuk semua role operasional. |
| User Role | Candidate, Recruiter, Superadmin |
| Preconditions | Akun sudah ada dan status akun aktif. |
| Main Flow | 1. User membuka halaman login yang dapat dikontekstualkan per role.<br>2. User memasukkan email dan password.<br>3. Backend memverifikasi email, password, dan status akun.<br>4. Backend menerbitkan token Sanctum.<br>5. Frontend menyimpan token dan user ke local storage.<br>6. User diarahkan ke dashboard role terkait.<br>7. Saat logout, token aktif dihapus dan session lokal dibersihkan. |
| Alternative Flow | 1. Saat token kadaluwarsa/tidak valid, interceptor frontend membersihkan session dan mengarahkan ke login sesuai role terakhir.<br>2. Checkbox “ingat perangkat” saat ini hanya elemen UI dan belum mengubah perilaku backend. |
| Validation Rules | Email format valid; password wajib; akun `suspended` ditolak. |
| Error Conditions | Email tidak terdaftar, password salah, akun disuspend, token tidak valid. |
| Success Conditions | Session aktif, request berikutnya membawa header `Authorization: Bearer`. |
| Data Input | `email`, `password`. |
| Data Output | `token`, `user`, redirect dashboard, logout confirmation. |
| API Related | `POST /api/login`, `POST /api/logout`, `GET /api/me` |
| Database Related | Tabel `users`; token Sanctum pada tabel internal package. |
| Security Consideration | Proteksi 401/403, middleware `active`, pemisahan role, penghapusan token saat logout/suspend. |
| Priority Level | Critical |

### FR-04 Pemulihan Password
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-04 |
| Feature Name | Forgot password dan reset password |
| Description | User dapat meminta link reset password dan menetapkan password baru melalui email. |
| Business Goal | Mengurangi hambatan akses dan beban support. |
| User Role | Candidate, Recruiter, Superadmin |
| Preconditions | Email terdaftar; mailer tersedia atau mode log aktif untuk testing. |
| Main Flow | 1. User membuka halaman forgot password sesuai role.<br>2. User memasukkan email.<br>3. Sistem mengirim token reset via mail broker.<br>4. User membuka link reset.<br>5. User mengisi password baru dan konfirmasi.<br>6. Backend memvalidasi token dan memperbarui password.<br>7. Semua token login lama user dihapus. |
| Alternative Flow | 1. Bila email tidak terdaftar, sistem tetap memberi pesan generik agar tidak membocorkan keberadaan akun.<br>2. Di mock mode, token reset disimpan di local storage. |
| Validation Rules | Forgot password di-throttle `6/menit`; reset password `10/menit`.<br>Password baru minimal 8 karakter, huruf dan angka.<br>Token wajib valid dan belum kedaluwarsa.<br>Link reset berlaku 60 menit. |
| Error Conditions | Token invalid/kedaluwarsa, password confirmation tidak cocok, email tidak valid. |
| Success Conditions | Password berubah, session lama dibersihkan, user dapat login ulang. |
| Data Input | `email`, `token`, `password`, `password_confirmation`. |
| Data Output | Email reset, pesan sukses reset, invalidasi token lama. |
| API Related | `POST /api/forgot-password`, `POST /api/reset-password` |
| Database Related | Tabel `password_reset_tokens`, `users.password`. |
| Security Consideration | Pesan generik pada forgot password, token sekali pakai, session lama dihapus pasca reset. |
| Priority Level | High |

### FR-05 Pengelolaan Profil Kandidat
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-05 |
| Feature Name | Profil kandidat dan readiness checklist |
| Description | Kandidat mengelola profil pribadi sebagai prasyarat apply, termasuk identitas, ringkasan, pendidikan, pengalaman, skill, lokasi minat, role minat, dan metadata dokumen. |
| Business Goal | Menjamin recruiter menerima kandidat dengan informasi minimum yang cukup untuk screening. |
| User Role | Candidate |
| Preconditions | Kandidat sudah login. |
| Main Flow | 1. Kandidat membuka dashboard section profil.<br>2. Kandidat mengisi data inti, target pekerjaan, pendidikan, pengalaman, foto, CV, sertifikat, dan ekspektasi gaji.<br>3. Sistem menghitung checklist readiness.<br>4. Kandidat menyimpan profil.<br>5. Backend menyimpan `candidate_profile` JSON dan sinkronisasi nama/telepon ke tabel user. |
| Alternative Flow | 1. Jika sinkronisasi backend gagal, profil lokal tetap tersimpan di browser.<br>2. Kandidat tetap diarahkan untuk melengkapi item yang kurang sebelum apply. |
| Validation Rules | Minimal item wajib: nama, telepon, email, alamat saat ini, ringkasan profil, role minat, lokasi minat, minimal satu skill, pendidikan atau pengalaman terbaru, minimal satu resume. |
| Error Conditions | User belum login, sync profile gagal, data wajib belum lengkap. |
| Success Conditions | Readiness kandidat menjadi “Siap melamar” dan profil dapat dipakai saat apply instan. |
| Data Input | Data identitas, kontak, tanggal lahir, alamat, sosial media, pendidikan, pengalaman, skill, lokasi minat, role minat, salary range, foto, resumeFiles, certificateFiles. |
| Data Output | `candidate_profile` JSON tersimpan, label readiness, checklist completion. |
| API Related | `PUT /api/profile` |
| Database Related | `users.candidate_profile`, `users.name`, `users.phone`. |
| Security Consideration | Kandidat hanya boleh mengubah profil sendiri. Metadata berkas kandidat harus diperlakukan sebagai data pribadi. |
| Priority Level | Critical |

### FR-06 Pencarian Lowongan Publik & Rekomendasi
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-06 |
| Feature Name | Job listing publik, filter, geolocation, dan recommendation |
| Description | Sistem menampilkan lowongan aktif dengan filter pencarian, rekomendasi lokasi terdekat, dan rekomendasi lowongan berdasarkan profil kandidat. |
| Business Goal | Meningkatkan discoverability lowongan dan conversion apply. |
| User Role | Guest, Candidate |
| Preconditions | Lowongan aktif tersedia. Untuk recommendation kandidat, profil kandidat telah tersimpan. |
| Main Flow | 1. User membuka halaman jobs.<br>2. Sistem mengambil daftar lowongan aktif dan lokasi aktif.<br>3. User memfilter berdasarkan keyword, lokasi, tipe kerja, dan experience level.<br>4. Kandidat dapat meminta lokasi perangkat untuk rekomendasi kota lowongan terdekat.<br>5. Dashboard kandidat menampilkan lowongan yang disortir berdasarkan kecocokan role, lokasi, skill, dan pengalaman. |
| Alternative Flow | 1. Jika browser menolak geolocation, sistem menampilkan pesan kesalahan non-fatal.<br>2. Jika belum ada koordinat cocok, filter lokasi manual tetap bisa dipakai. |
| Validation Rules | Hanya lowongan `status=active` yang tampil publik. Lokasi dropdown bersumber dari lowongan aktif. |
| Error Conditions | Gagal memuat lowongan, geolocation ditolak, tidak ada hasil pencarian. |
| Success Conditions | User melihat daftar lowongan yang relevan dan dapat melanjutkan ke apply. |
| Data Input | Query filter `search`, `location`, `job_type`, `experience_level`, posisi perangkat. |
| Data Output | List lowongan, pagination, lokasi tersedia, rekomendasi kota terdekat, candidate match score. |
| API Related | `GET /api/jobs`, `GET /api/job-locations`, `GET /api/jobs/{id}` |
| Database Related | Tabel `jobs`, relasi `jobs.recruiter`. |
| Security Consideration | Banner keamanan kerja mengingatkan user agar tidak mengirim uang/OTP di luar alur resmi. |
| Priority Level | High |

### FR-07 Pengajuan Lamaran dan Screening
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-07 |
| Feature Name | Apply job dengan screening question dan video intro |
| Description | Kandidat mengirim lamaran ke lowongan aktif menggunakan profil yang sudah disimpan, cover letter, jawaban screening, dan tautan video jika diwajibkan. |
| Business Goal | Mempercepat apply sekaligus meningkatkan kualitas screening awal recruiter. |
| User Role | Candidate |
| Preconditions | Kandidat login; profil minimum siap; lowongan aktif; kandidat belum pernah apply ke lowongan yang sama. |
| Main Flow | 1. Kandidat klik “Lamar Sekarang”.<br>2. Sistem memeriksa status login, role, readiness profil, dan riwayat apply sebelumnya.<br>3. Sistem membuka modal apply berisi ringkasan profil, pertanyaan screening, dan input video link.<br>4. Kandidat mengirim lamaran.<br>5. Backend memvalidasi jawaban wajib dan video intro bila `required`.<br>6. Sistem membuat `application` dengan status `pending`, stage `applied`, dan timestamp `applied_at`. |
| Alternative Flow | 1. Jika kandidat belum login, niat apply disimpan lalu diarahkan ke login candidate.<br>2. Jika profil belum siap, kandidat diarahkan ke section profil.<br>3. Jika kandidat sudah pernah apply, diarahkan ke dashboard aplikasi. |
| Validation Rules | `job_id` harus valid.<br>Screening answer wajib diisi untuk semua pertanyaan required.<br>`video_intro_url` wajib bila lowongan mewajibkan video.<br>Duplicate application per kombinasi `job_id + candidate_id` dilarang. |
| Error Conditions | Lowongan tidak aktif, duplicate apply, jawaban screening tidak lengkap, video link tidak valid/wajib belum diisi. |
| Success Conditions | Lamaran tercatat dan kandidat menerima feedback sukses serta diarahkan ke “Lamaran Saya”. |
| Data Input | `job_id`, `cover_letter`, `screening_answers[]`, `video_intro_url`. |
| Data Output | Record lamaran baru, ringkasan screening, status awal lamaran. |
| API Related | `POST /api/apply` |
| Database Related | Tabel `applications`, `jobs.quiz_screening_questions`, relasi `applications.job_id`, `applications.candidate_id`. |
| Security Consideration | Hanya candidate yang boleh apply; backend wajib memverifikasi ownership dan status job. |
| Priority Level | Critical |

### FR-08 Dashboard Kandidat & Monitoring Lamaran
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-08 |
| Feature Name | Dashboard kandidat, histori lamaran, timeline stage, dan withdraw |
| Description | Kandidat memiliki pusat kontrol untuk melihat profil readiness, lowongan rekomendasi, lamaran aktif/selesai, timeline status, dan komunikasi dengan recruiter/superadmin. |
| Business Goal | Memberi transparansi proses dan mengurangi churn setelah kandidat apply. |
| User Role | Candidate |
| Preconditions | Kandidat login. |
| Main Flow | 1. Kandidat membuka dashboard.<br>2. Sistem memuat lowongan rekomendasi dan histori lamaran kandidat.<br>3. Sistem membagi lamaran menjadi kategori aktif dan selesai.<br>4. Kandidat melihat timeline tiap lamaran, catatan lamaran, screening summary, dan video yang sudah dikirim.<br>5. Kandidat dapat chat recruiter atau membatalkan lamaran aktif. |
| Alternative Flow | Jika belum ada lamaran, sistem menampilkan empty state dan CTA ke pencarian lowongan. |
| Validation Rules | Withdraw hanya untuk stage yang bukan `hired`, `rejected`, atau `withdrawn`. |
| Error Conditions | Gagal memuat aplikasi, gagal withdraw, recruiter tidak dapat dihubungi. |
| Success Conditions | Kandidat memahami progres lamaran dan dapat mengambil tindakan berikutnya. |
| Data Input | Filter bucket aktif/selesai, aksi withdraw, contact chat yang dipilih. |
| Data Output | Daftar lamaran terpresentasi, timeline, stage summary, feedback notifikasi. |
| API Related | `GET /api/my-applications`, `PUT /api/applications/{applicationId}/withdraw`, `GET /api/chat/*`, `POST /api/chat/messages` |
| Database Related | Tabel `applications`, `messages`, `jobs`, `users`. |
| Security Consideration | Kandidat hanya boleh melihat dan membatalkan lamaran miliknya sendiri. |
| Priority Level | High |

### FR-09 Profil Company Recruiter
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-09 |
| Feature Name | Profil company recruiter |
| Description | Recruiter wajib melengkapi identitas company dan PIC untuk membangun trust kandidat dan menjadi gerbang publish lowongan aktif. |
| Business Goal | Meningkatkan kualitas lowongan dan kredibilitas perusahaan. |
| User Role | Recruiter |
| Preconditions | Recruiter login. |
| Main Flow | 1. Recruiter membuka section profil company.<br>2. Recruiter mengisi nama PIC, peran PIC, nama perusahaan, telepon, lokasi perusahaan, website, deskripsi company, dan fokus hiring.<br>3. Sistem menghitung company readiness.<br>4. Data disimpan ke backend dan local storage. |
| Alternative Flow | Jika profil belum siap, recruiter tetap dapat menyimpan draft namun akan dibatasi saat aktivasi lowongan. |
| Validation Rules | Field wajib: nama perusahaan, peran PIC, telepon, lokasi utama perusahaan, ringkasan perusahaan, fokus hiring. |
| Error Conditions | Sync profile gagal; data belum lengkap saat akan publish lowongan. |
| Success Conditions | Company profile berstatus siap publish. |
| Data Input | `recruiterName`, `contactRole`, `companyName`, `phone`, `companyLocation`, `website`, `companyDescription`, `hiringFocus`, `plan_code`, `kn_credit`. |
| Data Output | `recruiter_profile` JSON dan sinkronisasi ke `users.name`, `users.company_name`, `users.phone`. |
| API Related | `PUT /api/profile` |
| Database Related | `users.company_name`, `users.recruiter_profile`, `users.phone`. |
| Security Consideration | Recruiter hanya dapat mengubah profil miliknya sendiri. |
| Priority Level | Critical |

### FR-10 Pembuatan & Publikasi Lowongan
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-10 |
| Feature Name | Wizard pembuatan lowongan recruiter |
| Description | Recruiter membuat lowongan melalui wizard empat langkah: informasi dasar, kualifikasi, kuis screening, dan preview/publish. |
| Business Goal | Menstandarkan kualitas lowongan dan menurunkan friksi publish. |
| User Role | Recruiter |
| Preconditions | Recruiter login. Untuk publish aktif, company profile minimum harus siap dan quota paket masih tersedia. |
| Main Flow | 1. Recruiter membuka halaman create job.<br>2. Recruiter mengisi judul, kategori, deskripsi, tipe kerja, work mode, jumlah kebutuhan, lokasi penempatan, gaji, tipe interview, expiry, dan kriteria kandidat.<br>3. Recruiter memilih pertanyaan screening default dan pertanyaan custom.<br>4. Recruiter memilih mode draft atau publish.<br>5. Backend menyimpan lowongan dan mapping workflow ke status aktif/nonaktif. |
| Alternative Flow | 1. Bila recruiter belum siap publish, lowongan dapat disimpan sebagai draft.<br>2. Lokasi penempatan dapat dipilih dari address book atau dibuat baru.<br>3. Jika quota lowongan aktif paket penuh, aktivasi ditolak dan recruiter diminta upgrade/nonaktifkan lowongan lama. |
| Validation Rules | Judul wajib.<br>Deskripsi minimal 75 karakter.<br>Kategori, job type, work mode, experience level, interview type, lokasi, gaji min/max, dan expiry wajib diisi di UI.<br>Gaji max >= gaji min.<br>Maksimal 5 pertanyaan screening preset dan 3 pertanyaan custom teks pada UI. |
| Error Conditions | Quota paket penuh, form tidak lengkap, deskripsi terlalu pendek, gaji tidak valid, lokasi belum dipilih. |
| Success Conditions | Lowongan tersimpan sebagai draft atau aktif dan muncul di dashboard recruiter. |
| Data Input | Field UI lowongan, address book, quiz screening selections. |
| Data Output | Job record baru, workflow status, screening question payload. |
| API Related | `POST /api/jobs` |
| Database Related | `jobs.title`, `description`, `category`, `salary_min`, `salary_max`, `location`, `job_type`, `experience_level`, `work_mode`, `openings_count`, `interview_type`, `interview_note`, `video_screening_requirement`, `quiz_screening_questions`, `status`, `workflow_status`. |
| Security Consideration | Hanya recruiter terautentikasi dapat membuat lowongan; quota plan harus divalidasi server-side. |
| Priority Level | Critical |

### FR-11 Lifecycle Lowongan Recruiter
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-11 |
| Feature Name | Pengelolaan lifecycle lowongan |
| Description | Recruiter mengelola lowongan miliknya melalui status `draft`, `active`, `paused`, `closed`, dan `filled`, serta dapat menghapus lowongan. |
| Business Goal | Memberi kontrol penuh atas siklus hiring tanpa kehilangan histori operasional. |
| User Role | Recruiter, Superadmin |
| Preconditions | Lowongan ada dan dimiliki recruiter yang login, atau user adalah superadmin. |
| Main Flow | 1. Recruiter membuka section lowongan.<br>2. Sistem menampilkan semua lowongan milik recruiter.<br>3. Recruiter memfilter lowongan berdasarkan workflow dan keyword.<br>4. Recruiter mengubah workflow status atau menghapus lowongan.<br>5. Recruiter dapat masuk ke pipeline kandidat dari lowongan tertentu. |
| Alternative Flow | Superadmin dapat mengubah status lowongan dari panel admin untuk kebutuhan moderasi. |
| Validation Rules | Aktivasi lowongan harus mematuhi quota paket; recruiter biasa hanya boleh mengelola lowongan miliknya sendiri. |
| Error Conditions | Lowongan tidak ditemukan, tidak punya akses, quota aktif terlampaui. |
| Success Conditions | Status lifecycle baru tersimpan dan list lowongan ter-refresh. |
| Data Input | `workflow_status`, `status`, `jobId`, aksi delete. |
| Data Output | Perubahan status lowongan, daftar lowongan recruiter, statistik lowongan. |
| API Related | `GET /api/my-jobs`, `PUT /api/jobs/{id}`, `DELETE /api/jobs/{id}`, `GET /api/jobs/{id}/statistics` |
| Database Related | Tabel `jobs`, agregasi `applications`. |
| Security Consideration | Backend melakukan pengecekan owner atau role superadmin. |
| Priority Level | High |

### FR-12 Pipeline Kandidat Recruiter
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-12 |
| Feature Name | Manajemen kandidat per lowongan |
| Description | Recruiter melihat pelamar per lowongan, ringkasan profil, jawaban screening, akses berkas sesuai paket, dan memindahkan kandidat antar stage. |
| Business Goal | Menjadikan recruiter mampu men-screening, shortlist, dan memutuskan kandidat dalam satu workspace. |
| User Role | Recruiter, Superadmin |
| Preconditions | Lowongan dipilih; ada pelamar atau setidaknya lowongan valid. |
| Main Flow | 1. Recruiter memilih lowongan pada section kandidat.<br>2. Sistem memuat semua pelamar untuk lowongan tersebut.<br>3. Recruiter memfilter berdasarkan stage atau pencarian nama/email/skill.<br>4. Recruiter meninjau ringkasan kandidat, cover letter, screening summary, jawaban screening, video intro, dan jumlah berkas terlihat.<br>5. Recruiter memindahkan stage kandidat.<br>6. Recruiter dapat menghubungi kandidat via email atau chat platform. |
| Alternative Flow | Superadmin dapat mengakses detail aplikasi untuk kepentingan governance. |
| Validation Rules | Stage yang diperbolehkan: `applied`, `screening`, `shortlisted`, `interview`, `offering`, `hired`, `rejected`, `withdrawn`. |
| Error Conditions | Tidak ada akses ke lowongan, aplikasi tidak ditemukan, gagal update stage. |
| Success Conditions | Pipeline kandidat terbarui dan recruiter dapat melanjutkan follow-up. |
| Data Input | `jobId`, filter stage, pencarian kandidat, `applicationId`, stage baru. |
| Data Output | Daftar kandidat terpresentasi, summary screening, perubahan stage. |
| API Related | `GET /api/jobs/{jobId}/applications`, `PUT /api/applications/{applicationId}/status`, `GET /api/applications/{applicationId}` |
| Database Related | `applications.status`, `applications.stage`, `applications.screening_answers`, `applications.video_intro_url`, `users.candidate_profile`. |
| Security Consideration | Recruiter hanya dapat melihat aplikasi pada lowongan miliknya; visibilitas dokumen kandidat harus mengikuti paket aktif. |
| Priority Level | Critical |

### FR-13 Talent Search & Entitlement Paket
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-13 |
| Feature Name | Talent search dengan pembatasan paket recruiter |
| Description | Recruiter dapat mencari kandidat aktif berdasarkan kata kunci, lokasi, skill, grade, dan tipe pengalaman. Jumlah hasil serta visibilitas dokumen ditentukan oleh paket aktif. |
| Business Goal | Mendorong recruiter melakukan pencarian proaktif sekaligus membuka monetisasi berbasis paket. |
| User Role | Recruiter |
| Preconditions | Recruiter login; kandidat aktif tersedia. |
| Main Flow | 1. Recruiter membuka section talent search.<br>2. Sistem menampilkan paket aktif dan entitlement-nya.<br>3. Recruiter memasukkan filter pencarian.<br>4. Backend menyusun kandidat yang cocok, menghitung grade dan readiness, lalu membatasi hasil sesuai paket.<br>5. Recruiter melihat ringkasan profil dan dapat memulai chat. |
| Alternative Flow | Jika hasil nol, recruiter diminta memperluas filter. |
| Validation Rules | Paket `starter`, `growth`, `scale` harus valid.<br>Result limit, visible resume, dan visible certificate mengikuti plan config. |
| Error Conditions | Gagal menjalankan search, paket tidak dikenali, kandidat tidak ditemukan. |
| Success Conditions | Recruiter mendapatkan shortlist talent yang sesuai dan dapat menghubungi kandidat. |
| Data Input | `query`, `location`, `skill`, `grade`, `experience_type`, `page`, `per_page`. |
| Data Output | Candidate list, pagination, grade kandidat, readiness score, document access summary. |
| API Related | `GET /api/recruiter/talent-search`, `GET /api/recruiter/package` |
| Database Related | `users` role candidate, `candidate_profile`, `applications`, `recruiter_profile.plan_code`. |
| Security Consideration | Hanya recruiter aktif yang boleh menjalankan talent search; visibilitas berkas dibatasi server-side, bukan hanya frontend. |
| Priority Level | High |

### FR-14 Kolaborasi Chat Internal
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-14 |
| Feature Name | Inbox chat kandidat, recruiter, dan superadmin |
| Description | Sistem menyediakan thread, daftar kontak yang sah, conversation view, unread count, dan pengiriman pesan dengan konteks lowongan opsional. |
| Business Goal | Menjaga komunikasi rekrutmen tetap berada di dalam ekosistem platform. |
| User Role | Candidate, Recruiter, Superadmin |
| Preconditions | User login dan memiliki counterpart yang sah menurut relasi lamaran atau role superadmin. |
| Main Flow | 1. User membuka section chat.<br>2. Sistem memuat thread terbaru dan kontak yang boleh dihubungi.<br>3. User memilih kontak.<br>4. Sistem memuat percakapan dan menandai pesan masuk sebagai terbaca.<br>5. User mengirim pesan teks; recruiter dapat menyertakan konteks lowongan. |
| Alternative Flow | Superadmin dapat menghubungi semua recruiter dan kandidat aktif; candidate/recruiter terbatas pada relasi lamaran. |
| Validation Rules | Tidak boleh chat ke akun sendiri.<br>Pesan maksimal 5000 karakter.<br>Recipient harus valid.<br>Job context hanya boleh dipakai bila relasi pengirim-penerima memang terkait lowongan tersebut. |
| Error Conditions | Kontak tidak valid, tidak punya izin komunikasi, job context tidak sah, pesan kosong. |
| Success Conditions | Pesan tersimpan, thread ter-update, unread count berjalan. |
| Data Input | `recipient_id`, `body`, `job_id` opsional. |
| Data Output | Thread list, contacts list, conversation messages, unread state. |
| API Related | `GET /api/chat/threads`, `GET /api/chat/contacts`, `GET /api/chat/conversations/{userId}`, `POST /api/chat/messages` |
| Database Related | Tabel `messages`, relasi ke `users` dan `jobs`. |
| Security Consideration | Akses chat dibatasi oleh ownership relasi lamaran atau privilege superadmin. |
| Priority Level | High |

### FR-15 Manajemen Paket Recruiter
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-15 |
| Feature Name | Pengelolaan paket recruiter |
| Description | Recruiter dapat melihat paket aktif, katalog paket, KN credit, serta mengubah plan code akun. |
| Business Goal | Menyediakan dasar entitlement komersial dan diferensiasi fitur antar recruiter. |
| User Role | Recruiter, Superadmin |
| Preconditions | Recruiter login. |
| Main Flow | 1. Recruiter membuka section paket.<br>2. Sistem menampilkan paket aktif beserta deskripsi, limit lowongan, limit talent search, dan visibilitas berkas.<br>3. Recruiter memilih paket lain.<br>4. Backend menyimpan `plan_code` baru di `recruiter_profile`. |
| Alternative Flow | Superadmin juga dapat memperbarui `plan_code` dan `kn_credit` recruiter melalui endpoint admin update user walaupun UI admin saat ini lebih fokus ke verification/status. |
| Validation Rules | Plan yang valid hanya `starter`, `growth`, `scale`. KN credit minimum 0. |
| Error Conditions | Plan tidak valid, update gagal, user bukan recruiter. |
| Success Conditions | Paket aktif recruiter berubah dan entitlement langsung tercermin di fitur lain. |
| Data Input | `plan_code`, `kn_credit` bila dari admin. |
| Data Output | Context paket aktif, katalog paket, user fresh. |
| API Related | `GET /api/recruiter/package`, `PUT /api/recruiter/package`, `PUT /api/admin/users/{userId}` |
| Database Related | `users.recruiter_profile.plan_code`, `users.recruiter_profile.kn_credit`. |
| Security Consideration | Perubahan paket harus terekam secara governance pada fase enterprise lanjutan. |
| Priority Level | High |

### FR-16 Superadmin Monitoring & Analytics
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-16 |
| Feature Name | Monitoring operasional dan analytics superadmin |
| Description | Superadmin memantau total users, lowongan, lamaran, growth 7 hari, health, map lokasi, quick control, screening overview, dan analytics visual. |
| Business Goal | Memberi visibilitas menyeluruh atas kesehatan platform dan prioritas tindakan operasional. |
| User Role | Superadmin |
| Preconditions | Superadmin login. |
| Main Flow | 1. Superadmin membuka section monitoring atau analytics.<br>2. Backend menghitung agregasi users/jobs/applications.<br>3. Frontend membangun kartu metrik, map, chart pertumbuhan, dan daftar aktivitas.<br>4. Superadmin dapat refresh data, membuka quick control, dan menavigasi ke area prioritas. |
| Alternative Flow | Jika data kosong atau API gagal, sistem menampilkan error/empty state dan status platform warning. |
| Validation Rules | Hanya superadmin yang dapat mengakses dashboard admin. |
| Error Conditions | Gagal memuat dashboard, data tidak sinkron, DB issue yang memengaruhi metrik. |
| Success Conditions | Superadmin memperoleh insight operasional dan prioritas tindakan dari satu layar. |
| Data Input | Filter monitoring/analytics, search, refresh action. |
| Data Output | Totals, growth, map points, health cards, charts, insight text, quick actions. |
| API Related | `GET /api/admin/dashboard` |
| Database Related | Agregasi `users`, `jobs`, `applications`, `messages`; indeks tambahan untuk query dashboard. |
| Security Consideration | Dashboard admin mengandung data lintas user dan harus dibatasi ketat ke superadmin. |
| Priority Level | Critical |

### FR-17 Superadmin Governance Kandidat & Recruiter
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-17 |
| Feature Name | Manajemen akun kandidat dan recruiter |
| Description | Superadmin dapat melihat detail akun, menyaring data, mengaktifkan/menonaktifkan akun, mengirim reset password, dan mengatur verifikasi recruiter. |
| Business Goal | Menjaga kualitas ekosistem pengguna dan menangani kasus support/governance dengan cepat. |
| User Role | Superadmin |
| Preconditions | Superadmin login; target user bukan superadmin. |
| Main Flow | 1. Superadmin membuka tab kandidat atau recruiter.<br>2. Sistem menampilkan tabel, filter, detail panel, dan queue review.<br>3. Superadmin memilih akun tertentu.<br>4. Superadmin dapat suspend/aktifkan akun, kirim reset link, atau verifikasi recruiter.<br>5. Sistem me-refresh data dashboard setelah aksi berhasil. |
| Alternative Flow | Recruiter dapat dikembalikan ke status review dari status verified. |
| Validation Rules | User target tidak boleh role superadmin.<br>`account_status` hanya `active` atau `suspended`.<br>`verification_status` recruiter hanya `pending` atau `verified`. |
| Error Conditions | User tidak ditemukan, reset link gagal terkirim, update status gagal, recruiter tidak valid. |
| Success Conditions | Status akun/verification berubah dan tercermin di dashboard admin. |
| Data Input | `userId`, `account_status`, `account_status_reason`, `verification_status`, `verification_notes`, aksi reset password. |
| Data Output | Data akun terkini, feedback aksi admin. |
| API Related | `PUT /api/admin/users/{userId}`, `POST /api/admin/users/{userId}/send-reset-link` |
| Database Related | `users.account_status`, `users.account_status_reason`, `users.recruiter_profile.verificationStatus`, `verificationNotes`, `verifiedAt`. |
| Security Consideration | Endpoint admin wajib menolak modifikasi akun superadmin dan hanya menerima superadmin terautentikasi. |
| Priority Level | Critical |

### FR-18 Superadmin Moderasi Lowongan, Reassignment, Reporting, dan Health
| Atribut | Detail |
| --- | --- |
| Requirement ID | FR-18 |
| Feature Name | Moderasi lowongan, reassign recruiter, export CSV, dan health check |
| Description | Superadmin dapat memoderasi lowongan bermasalah, mengubah status lowongan, memindahkan lowongan ke recruiter aktif lain, mengekspor CSV, dan memeriksa health endpoint. |
| Business Goal | Menjaga kualitas supply lowongan dan mendukung operasi platform yang stabil. |
| User Role | Superadmin |
| Preconditions | Lowongan ada; recruiter tujuan aktif; sistem backend tersedia. |
| Main Flow | 1. Superadmin membuka tab lowongan atau moderasi.<br>2. Sistem menandai lowongan yang sepi, pause, draft, atau perlu tindakan.<br>3. Superadmin dapat pause/aktifkan kembali lowongan.<br>4. Superadmin dapat memilih recruiter baru dan menjalankan reassign.<br>5. Superadmin dapat mengekspor CSV untuk monitoring, pelamar, recruiter, analytics, dan lowongan.<br>6. Tim operasional dapat memakai endpoint health untuk cek koneksi database dan kesiapan schema. |
| Alternative Flow | Panel moderasi dapat mengarahkan superadmin ke detail kandidat/recruiter/lowongan terkait. |
| Validation Rules | Recruiter tujuan harus role recruiter dan status aktif.<br>Lowongan harus ada.<br>Health endpoint memeriksa tabel inti `users`, `jobs`, `applications`, `password_reset_tokens`. |
| Error Conditions | Lowongan tidak ditemukan, recruiter tujuan tidak valid, export data kosong, database unavailable. |
| Success Conditions | Lowongan termoderasi, penanggung jawab baru terset, laporan CSV tersedia, health status terlapor. |
| Data Input | `jobId`, `recruiter_id`, action status lowongan, trigger export, akses health URL. |
| Data Output | Status lowongan baru, reassign sukses, file CSV, JSON health report. |
| API Related | `PUT /api/admin/jobs/{jobId}/reassign`, `PUT /api/jobs/{id}`, `GET /api/health`, `GET /api/health/database` |
| Database Related | `jobs.recruiter_id`, `jobs.status`, `jobs.workflow_status`, pengecekan tabel inti. |
| Security Consideration | Reassign job dan change lifecycle merupakan aksi high impact yang sebaiknya dicatat pada audit trail persisten pada fase berikutnya. |
| Priority Level | High |

## 13. Non Functional Requirements
| Kategori | Requirement |
| --- | --- |
| Performance | Listing lowongan, dashboard recruiter, dan dashboard admin sebaiknya merespons < 3 detik untuk beban normal. |
| Availability | Frontend dan backend production didesain untuk deployment terpisah. |
| Scalability | Query dashboard admin sudah mulai dioptimasi dengan indeks tambahan pada tabel `users`, `jobs`, dan `applications`. |
| Security | Semua endpoint protected harus memakai token Sanctum, middleware `active`, dan middleware `role` bila diperlukan. |
| Data Integrity | Duplicate lamaran per lowongan-kandidat harus dicegah secara DB (`unique`) dan service. |
| Maintainability | Arsitektur backend memakai pattern Controller -> Service -> Model; frontend memisahkan pages, services, hooks, utils. |
| Usability | UI bersifat role-based, responsif, dan memakai section yang jelas untuk dashboard kandidat/recruiter/admin. |
| Observability | Endpoint `/api/health` dan `/api/health/database` harus tersedia untuk validasi deployment. |
| Portability | Konfigurasi database mendukung MySQL lokal dan PostgreSQL. |
| Deployability | Build frontend harus lulus `vite build`; backend harus valid menjalankan route list dan migration. |
| Privacy | Data profil kandidat, nomor telepon, email, dan dokumen harus dianggap data sensitif. |
| Resilience | Frontend memiliki fallback mock mode saat API URL tidak tersedia, namun mode ini harus dibatasi untuk non-production usage. |

## 14. UI/UX Requirements
| Area | Requirement |
| --- | --- |
| Navigasi awal | Landing harus memisahkan jalur akses recruiter, kandidat, dan superadmin secara eksplisit. |
| Form auth | Login/register/reset password harus memberi pesan validasi yang spesifik dan mudah dipahami. |
| Profil kandidat | Checklist readiness harus selalu terlihat agar kandidat tahu item wajib sebelum apply. |
| Apply flow | Modal apply harus menampilkan ringkasan profil yang akan dipakai, bukan form panjang baru. |
| Recruiter workspace | Lowongan, kandidat, talent search, chat, dan paket harus tersegmentasi jelas. |
| Admin dashboard | Monitoring, analytics, moderation, dan manajemen akun harus bisa diakses tanpa berpindah produk/tool. |
| Responsiveness | Semua halaman inti harus tetap usable pada mobile dan desktop. |
| Feedback state | Semua action penting harus menampilkan success/error banner. |
| Accessibility | Tombol, tab, dropdown, dan dialog harus mendukung label/aria yang jelas. |
| Localization | Bahasa utama sistem adalah Bahasa Indonesia formal-operasional. |

## 15. System Architecture
### 15.1 Logical Architecture
```text
User Browser
  -> React SPA (frontend)
     -> Axios API Client
        -> Laravel API (backend)
           -> Controller Layer
              -> Service Layer
                 -> Eloquent Model Layer
                    -> Relational Database
```

### 15.2 Architectural Notes
| Area | Temuan |
| --- | --- |
| Frontend routing | React Router dengan guest/protected route guard |
| State | Zustand untuk auth; hooks lokal untuk jobs, applications, chat |
| Persistence client | localStorage untuk token, user, profile candidate/recruiter, mock data |
| Backend business logic | Terpusat pada `AuthService`, `JobService`, `ApplicationService`, `AdminService`, `MessageService`, `RecruiterPlanService`, `TalentSearchService` |
| Deployment adapter | Backend memakai wrapper PHP pada folder `backend/api` untuk deployment adapter yang membutuhkan entrypoint khusus |
| Runtime limitation | Storage sementara diarahkan ke `/tmp/kerjanusa-storage` pada environment yang tidak memiliki storage persisten |

## 16. Database Analysis
### 16.1 Core Tables
| Tabel | Tujuan | Kolom penting |
| --- | --- | --- |
| `users` | Master user semua role | `id`, `name`, `company_name`, `email`, `password`, `role`, `account_status`, `account_status_reason`, `phone`, `profile_picture`, `candidate_profile`, `recruiter_profile`, `created_at` |
| `jobs` | Lowongan kerja | `id`, `recruiter_id`, `title`, `description`, `category`, `salary_min`, `salary_max`, `location`, `job_type`, `experience_level`, `work_mode`, `openings_count`, `interview_type`, `interview_note`, `video_screening_requirement`, `quiz_screening_questions`, `status`, `workflow_status` |
| `applications` | Lamaran kandidat | `id`, `job_id`, `candidate_id`, `status`, `stage`, `cover_letter`, `screening_answers`, `video_intro_url`, `applied_at` |
| `messages` | Chat internal | `id`, `sender_id`, `recipient_id`, `job_id`, `body`, `read_at`, `created_at` |
| `password_reset_tokens` | Token reset password | `email`, `token`, `created_at` |

### 16.2 Database Relationships
```text
users (recruiter) 1 --- N jobs
users (candidate) 1 --- N applications
jobs 1 --- N applications
users 1 --- N sent_messages
users 1 --- N received_messages
jobs 1 --- N messages (optional context)
password_reset_tokens keyed by email
```

### 16.3 JSON Payload Fields
| Entity | JSON Field | Isi penting |
| --- | --- | --- |
| `users` | `candidate_profile` | biodata, alamat, summary, sosial media, education, experiences, skills, preferred roles/locations, salary expectation, resumeFiles, certificateFiles |
| `users` | `recruiter_profile` | contactRole, companyLocation, companyDescription, hiringFocus, plan_code, kn_credit, verificationStatus, verificationNotes, verifiedAt |
| `jobs` | `quiz_screening_questions` | daftar pertanyaan screening dengan `id`, `type`, `title`, `question`, `answers`, `required` |
| `applications` | `screening_answers` | jawaban kandidat per pertanyaan screening |

### 16.4 Key Constraints
| Constraint | Nilai |
| --- | --- |
| Email user | Unique |
| Phone user | Unique |
| Lamaran kandidat ke lowongan yang sama | Unique (`job_id`, `candidate_id`) |
| Foreign keys | `jobs.recruiter_id`, `applications.job_id`, `applications.candidate_id`, `messages.sender_id`, `messages.recipient_id`, `messages.job_id` |

## 17. API Documentation
### 17.1 Public and Health
| Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api` | No | Public | API root health summary |
| GET | `/api/health` | No | Public/DevOps | Health endpoint umum |
| GET | `/api/health/database` | No | Public/DevOps | Validasi koneksi database dan tabel inti |
| POST | `/api/register` | No | Public | Registrasi kandidat/recruiter |
| POST | `/api/login` | No | Public | Login |
| POST | `/api/forgot-password` | No | Public | Minta reset password |
| POST | `/api/reset-password` | No | Public | Simpan password baru |
| GET | `/api/jobs` | No | Public | Listing lowongan aktif |
| GET | `/api/job-locations` | No | Public | Lokasi lowongan aktif |
| GET | `/api/jobs/{id}` | No | Public | Detail lowongan |

### 17.2 Authenticated Common
| Method | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/logout` | Semua role aktif | Logout |
| GET | `/api/me` | Semua role aktif | Ambil user saat ini |
| PUT | `/api/profile` | Semua role aktif | Update profil sendiri |
| PUT | `/api/change-password` | Semua role aktif | Ganti password |
| GET | `/api/chat/threads` | Semua role aktif | Daftar thread chat |
| GET | `/api/chat/contacts` | Semua role aktif | Daftar kontak yang dapat dihubungi |
| GET | `/api/chat/conversations/{userId}` | Semua role aktif | Detail percakapan |
| POST | `/api/chat/messages` | Semua role aktif | Kirim pesan |

### 17.3 Candidate APIs
| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/apply` | Kirim lamaran |
| GET | `/api/my-applications` | Daftar lamaran kandidat |
| PUT | `/api/applications/{applicationId}/withdraw` | Batalkan lamaran aktif |
| GET | `/api/applications/{applicationId}` | Detail lamaran milik kandidat |

### 17.4 Recruiter APIs
| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/jobs` | Buat lowongan |
| GET | `/api/my-jobs` | Daftar lowongan recruiter |
| PUT | `/api/jobs/{id}` | Update lowongan |
| DELETE | `/api/jobs/{id}` | Hapus lowongan |
| GET | `/api/jobs/{id}/statistics` | Statistik lowongan |
| GET | `/api/jobs/{jobId}/applications` | Pelamar per lowongan |
| PUT | `/api/applications/{applicationId}/status` | Ubah status/stage lamaran |
| GET | `/api/recruiter/package` | Context paket recruiter |
| PUT | `/api/recruiter/package` | Ganti paket recruiter |
| GET | `/api/recruiter/talent-search` | Cari kandidat aktif |

### 17.5 Superadmin APIs
| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/dashboard` | Dashboard agregat superadmin |
| PUT | `/api/admin/users/{userId}` | Update status/verification/plan user |
| POST | `/api/admin/users/{userId}/send-reset-link` | Kirim link reset password |
| PUT | `/api/admin/jobs/{jobId}/reassign` | Pindahkan lowongan ke recruiter lain |

## 18. Security Analysis
| Kontrol | Implementasi saat ini | Catatan |
| --- | --- | --- |
| Authentication | Token Sanctum bearer | Token disimpan di local storage frontend |
| Authorization | Middleware `role` dan pengecekan owner di controller/service | Sudah baik untuk scope saat ini |
| Account status gate | Middleware `active` | Akun suspend langsung ditolak dan token dihapus |
| Password security | Hashing password, reset token via broker | Perlu SMTP production untuk operasi nyata |
| Validation | Laravel validation pada controller | Cakupan kuat untuk auth, job, application |
| Abuse prevention | Throttle forgot/reset password | Belum terlihat rate limit granular untuk endpoint lain |
| CORS | Configurable via env | Production origin sudah disediakan contoh |
| Session resilience | Axios interceptor menghapus session saat 401/403 suspend | Baik untuk UX keamanan |
| Data privacy | Data kandidat dibatasi per role | Dokumen file belum punya storage governance formal |
| Gaps | Belum ada 2FA, audit trail persisten, encryption-at-rest config eksplisit di level aplikasi, file upload enterprise | Direkomendasikan fase enterprise berikutnya |

## 19. Integration Requirements
| Integrasi | Status | Keterangan |
| --- | --- | --- |
| Frontend static hosting | Ada | SPA route fallback ke `index.html` |
| Backend PHP runtime | Ada | Wrapper `backend/api` tersedia untuk adapter deployment yang membutuhkan entrypoint khusus |
| Database MySQL | Ada | Default lokal |
| PostgreSQL | Ada sebagai target alternatif deployment | Didukung lewat env `pgsql` |
| Email SMTP | Parsial | Konfigurasi tersedia, default masih `log` |
| Browser Geolocation API | Ada | Untuk rekomendasi lokasi lowongan |
| WhatsApp Deep Link | Ada | Floating button ke nomor support |
| localStorage | Ada | Session, mock data, profile, UI state |
| Mock/Demo Mode | Ada | Frontend dapat bekerja tanpa backend live bila env mengizinkan |

## 20. Reporting Features
| Fitur | Role | Detail |
| --- | --- | --- |
| Dashboard totals | Superadmin | Total kandidat, recruiter, lowongan, lamaran |
| Growth 7 hari | Superadmin | Kandidat baru, recruiter baru, lowongan baru, lamaran baru |
| Analytics chart | Superadmin | Pertumbuhan pelamar vs recruiter |
| Job popularity | Superadmin | Lowongan terpopuler berdasarkan jumlah pelamar |
| Category distribution | Superadmin | Distribusi kategori pekerjaan |
| Job statistics | Recruiter/Superadmin | Total, pending, accepted, rejected per lowongan |
| Screening overview | Superadmin | Profil kandidat incomplete, video screening masuk, screening answers terkumpul |
| CSV export | Superadmin | Monitoring, pelamar, recruiter, analytics, lowongan |

## 21. Notification Features
| Jenis notifikasi | Status |
| --- | --- |
| Email reset password | Implemented |
| Banner sukses/gagal pada action frontend | Implemented |
| Unread count chat | Implemented |
| Email notifikasi apply baru ke recruiter | Belum ditemukan |
| Email notifikasi stage change ke kandidat | Belum ditemukan |
| Push/in-app notification center | Belum ditemukan |

## 22. Audit Trail System
Implementasi audit trail saat ini masih bersifat implisit dan belum berupa subsystem formal.

| Area | Kondisi saat ini | Gap |
| --- | --- | --- |
| Activity logs admin | Dibangun dari kalkulasi dan presentasi data operasional | Tidak immutable, tidak menyimpan siapa melakukan aksi apa |
| Perubahan status user | Bisa dilakukan admin | Belum ada tabel audit perubahan |
| Perubahan stage kandidat | Bisa dilakukan recruiter/admin | Belum ada histori stage persisten terpisah |
| Reassign lowongan | Ada endpoint | Belum ada log persisten detail before/after |

Rekomendasi enterprise:

1. Tambahkan tabel `audit_logs`.
2. Tambahkan tabel `application_stage_histories`.
3. Catat actor, before value, after value, timestamp, IP, user agent, dan correlation id.

## 23. Error Handling
| Layer | Implementasi |
| --- | --- |
| Backend validation | Mengembalikan JSON error dengan field-level messages |
| Backend not found | `404` dengan message sederhana |
| Backend forbidden | `403 Forbidden` atau reason khusus `account_suspended` |
| Backend health | Memberi hint jenis error database seperti invalid host, invalid credentials, SSL issue |
| Frontend hooks | Memetakan error menjadi pesan yang lebih user-friendly |
| Frontend auth interceptor | Membersihkan session bila token invalid/suspend |
| Empty state UI | Tersedia pada jobs, applications, pipeline, contacts, admin tables |

## 24. Validation Rules
| Domain | Rules utama |
| --- | --- |
| Register | Email unik, phone unik, password min 8 huruf+angka, role publik terbatas |
| Login | Email valid, password wajib, akun suspend ditolak |
| Profile candidate | Readiness minimum untuk apply: kontak, alamat, summary, role, lokasi, skill, education/experience, resume |
| Profile recruiter | Company readiness minimum untuk publish aktif |
| Job create/update backend | Title wajib, description wajib, salary max >= salary min, type/level/workflow/status harus dari enum yang didukung |
| Job create UI | Description >= 75 karakter, interview type wajib, expiry wajib di UI, address wajib dipilih |
| Application submit | Lowongan aktif, belum pernah apply, screening wajib lengkap, video wajib bila required |
| Application stage | Stage/status harus dari daftar yang sah |
| Chat | Recipient valid, body tidak kosong, max 5000 karakter, job context harus sah |
| Admin user update | Status akun valid, verification status valid, plan code valid, KN credit >= 0 |
| Recruiter package | Plan code terbatas `starter/growth/scale` |

## 25. Testing Requirements
| Area | Kebutuhan |
| --- | --- |
| Unit test backend | Service `AuthService`, `JobService`, `ApplicationService`, `MessageService`, `AdminService`, `TalentSearchService` |
| Feature/API test | Auth flow, apply flow, recruiter pipeline, superadmin update, health endpoints |
| Frontend integration test | Login/register, profile readiness, apply modal, recruiter workflow, admin export |
| Security test | Role bypass, duplicate apply, suspended account, invalid reset token, unauthorized chat |
| Load test | Listing jobs, admin dashboard aggregate, chat thread retrieval |
| Regression test | Plan quota, document visibility by plan, application stage mapping, dashboard calculations |

Catatan analisis:

1. Tidak ditemukan suite test backend/frontend aktif di repo saat inspeksi ini dilakukan.
2. Verifikasi teknis yang sempat dijalankan hanya `php artisan route:list --path=api` dan `npm run build` frontend.

## 26. Deployment Requirements
| Area | Requirement |
| --- | --- |
| Frontend build | `npm run build` harus lulus |
| Backend runtime | Laravel harus dapat di-serve melalui web server atau adapter deployment yang sesuai |
| Environment | `APP_KEY`, koneksi DB, CORS, SANCTUM stateful domain, mail config, `VITE_API_URL` |
| Database migration | Semua migration harus dijalankan sebelum go-live |
| Mail | SMTP production dibutuhkan untuk reset password nyata |
| API base URL | Frontend production harus menunjuk backend API production |
| Health check | `/api/health` dan `/api/health/database` harus green |

## 27. Infrastructure Requirements
| Komponen | Requirement |
| --- | --- |
| Frontend runtime | Node.js 18+ untuk build |
| Backend runtime | PHP 8.1+ |
| Database | MySQL/MariaDB lokal atau PostgreSQL production |
| Deployment region | Ditentukan oleh infrastruktur aktif yang dipakai tim |
| Storage sementara | `/tmp/kerjanusa-storage` pada runtime yang tidak memiliki storage persisten |
| Secret management | Semua kredensial harus di env variable, bukan di source code |
| Logging | Minimal stderr/log channel pada production |
| Backup | Backup database terjadwal perlu ditetapkan di luar aplikasi |

## 28. Maintenance Plan
| Horizon | Aktivitas |
| --- | --- |
| Harian | Cek health endpoint, error login, failure reset password, antrian moderasi |
| Mingguan | Review growth metrics, job inactivity, recruiter verification backlog |
| Bulanan | Review performa query dashboard, evaluasi paket recruiter, audit keamanan token/session |
| Per rilis | Regression testing flow auth, apply, pipeline, admin governance, build frontend, route validation backend |

## 29. Risk Analysis
| Risiko | Dampak | Probabilitas | Mitigasi |
| --- | --- | --- | --- |
| Upload dokumen belum real storage | Tinggi | Tinggi | Integrasi object storage dan metadata file formal |
| Audit trail belum persisten | Tinggi | Tinggi | Tambah logging aksi admin/recruiter yang immutable |
| Routing adapter deployment untuk sebagian endpoint recruiter/chat perlu divalidasi konsistensinya | Tinggi | Menengah | Verifikasi routing production dan tambahkan rewrite/catch-all yang konsisten |
| Kriteria lowongan di UI belum seluruhnya tersimpan di backend | Tinggi | Tinggi | Finalisasi model data requisition/candidate criteria |
| Mailer default `log` | Menengah | Tinggi | Aktifkan SMTP production dan monitoring delivery |
| Session token di local storage | Menengah | Menengah | Pertimbangkan hardening, CSP, dan review XSS posture |
| Tidak ada automated test suite aktif | Tinggi | Tinggi | Bangun baseline test sebelum ekspansi fitur besar |
| Perubahan paket tanpa billing/audit | Menengah | Menengah | Tambahkan workflow approval/billing trail |

## 30. Future Enhancement
1. File storage nyata untuk CV, sertifikat, foto, dan dokumen recruiter.
2. Notification center untuk apply baru, stage berubah, recruiter verification, dan moderation alert.
3. Audit trail persisten dan approval history.
4. Scheduler interview dan integrasi Google/Outlook Calendar.
5. Billing/payment gateway untuk paket recruiter.
6. Verifikasi recruiter berbasis dokumen formal.
7. CV parser dan scoring yang lebih advanced.
8. Search ranking kandidat berbasis ML.
9. SLA dashboard dan queue assignment untuk tim support/admin.
10. Soft delete, archive, dan histori status lowongan/kandidat.

## 31. Conclusion
KerjaNusa sudah memiliki fondasi produk yang cukup matang untuk sebuah platform rekrutmen multi-role tahap growth. Arsitektur, role separation, job/application workflow, plan-based recruiter entitlement, dan admin control center sudah menunjukkan arah produk yang jelas. Dari sisi BRD, sistem ini dapat diposisikan sebagai solusi hiring end-to-end dengan tiga jalur operasi utama: kandidat, recruiter, dan superadmin.

Agar layak digunakan oleh perusahaan besar, prioritas penguatan berikut paling penting:

1. Menjadikan upload dokumen, audit trail, dan notifikasi sebagai kapabilitas first-class.
2. Menyelaraskan semua field UI recruiter dengan persistence backend dan database.
3. Menyempurnakan deployment production agar semua endpoint workspace benar-benar tersedia.
4. Menambahkan automated tests dan governance operasional yang lebih formal.

---

# Lampiran

## A. Daftar Halaman Aplikasi
| Route | Akses | Fungsi |
| --- | --- | --- |
| `/` | Guest | Redirect ke login recruiter |
| `/dashboard-awal` | Public | Landing/portal masuk utama |
| `/about` | Public | Halaman promosi value proposition |
| `/platform` | Public | Profil perusahaan/platform |
| `/jobs` | Public/Candidate | Listing lowongan publik + apply |
| `/login` | Public | Login multi-role |
| `/forgot-password` | Public | Permintaan reset password |
| `/reset-password` | Public | Form password baru |
| `/register` | Public | Registrasi kandidat/recruiter |
| `/candidate` | Candidate | Dashboard overview |
| `/candidate#profile` | Candidate | Profil siap lamar |
| `/candidate#jobs` | Candidate | Lowongan rekomendasi |
| `/candidate#applications` | Candidate | Lamaran saya |
| `/candidate#messages` | Candidate | Chat |
| `/recruiter` | Recruiter | Dashboard overview |
| `/recruiter#company` | Recruiter | Profil company |
| `/recruiter#jobs` | Recruiter | Lowongan saya |
| `/recruiter#candidates` | Recruiter | Pipeline kandidat |
| `/recruiter#talent` | Recruiter | Talent search |
| `/recruiter#messages` | Recruiter | Chat |
| `/recruiter#package` | Recruiter | Paket recruiter |
| `/recruiter/jobs/create` | Recruiter | Wizard create job |
| `/admin` | Superadmin | Monitoring |
| `/admin#pelamar` | Superadmin | Manajemen pelamar |
| `/admin#recruiter` | Superadmin | Manajemen recruiter |
| `/admin#lowongan` | Superadmin | Manajemen lowongan |
| `/admin#analytics` | Superadmin | Analytics |
| `/admin#moderasi` | Superadmin | Moderasi |
| `/admin#messages` | Superadmin | Chat |

## B. Sitemap Aplikasi
```text
Public
├── Dashboard Awal
├── Tentang / About
├── Platform
├── Jobs
├── Login
├── Register
├── Forgot Password
└── Reset Password

Candidate
├── Overview
├── Profil Siap Lamar
├── Lowongan
├── Lamaran Saya
└── Chat

Recruiter
├── Overview
├── Profil Company
├── Lowongan
├── Kandidat
├── Talent Search
├── Chat
├── Paket
└── Create Job Wizard

Superadmin
├── Monitoring
├── Pelamar
├── Recruiter
├── Lowongan
├── Analytics
├── Moderasi
└── Chat
```

## C. Flow User Journey
### C.1 Candidate
1. Masuk/daftar.
2. Lengkapi profil.
3. Cari lowongan.
4. Apply dan jawab screening.
5. Pantau stage.
6. Chat recruiter/superadmin.

### C.2 Recruiter
1. Masuk/daftar.
2. Lengkapi profil company.
3. Buat draft lowongan.
4. Publish lowongan aktif.
5. Review kandidat.
6. Ubah stage kandidat.
7. Jalankan talent search.
8. Ganti paket bila perlu.

### C.3 Superadmin
1. Login.
2. Pantau health dan analytics.
3. Review akun kandidat/recruiter.
4. Moderasi lowongan.
5. Reassign lowongan.
6. Export data.
7. Tindak lanjuti via chat.

## D. Relasi Database
| Relasi | Keterangan |
| --- | --- |
| User recruiter -> Jobs | Satu recruiter memiliki banyak lowongan |
| User candidate -> Applications | Satu kandidat memiliki banyak lamaran |
| Job -> Applications | Satu lowongan menerima banyak lamaran |
| User -> Messages (sender/recipient) | Komunikasi dua arah antar akun |
| Job -> Messages | Pesan dapat diberi konteks lowongan |

## E. Role Permission Matrix
| Capability | Guest | Candidate | Recruiter | Superadmin |
| --- | --- | --- | --- | --- |
| Lihat lowongan publik | Ya | Ya | Ya | Ya |
| Register | Ya | - | - | Tidak |
| Login | Ya | - | - | - |
| Update profil sendiri | Tidak | Ya | Ya | Ya |
| Apply lowongan | Tidak | Ya | Tidak | Tidak |
| Withdraw lamaran | Tidak | Ya | Tidak | Tidak |
| Create/update/delete lowongan sendiri | Tidak | Tidak | Ya | Ya |
| Lihat pelamar per lowongan | Tidak | Tidak | Ya | Ya |
| Update stage kandidat | Tidak | Tidak | Ya | Ya |
| Talent search | Tidak | Tidak | Ya | Tidak |
| Ganti paket recruiter | Tidak | Tidak | Ya | Ya |
| Suspend akun user | Tidak | Tidak | Tidak | Ya |
| Verifikasi recruiter | Tidak | Tidak | Tidak | Ya |
| Reassign lowongan | Tidak | Tidak | Tidak | Ya |
| Export CSV | Tidak | Tidak | Tidak | Ya |
| Chat internal | Tidak | Ya | Ya | Ya |

## F. Menu Navigation
| Persona | Menu |
| --- | --- |
| Guest Navbar | Kontak Kami, Tentang Kami/Platform, Login, Daftar Sekarang |
| Candidate | Dashboard, Profil Siap Lamar, Lowongan, Lamaran Saya, Chat |
| Recruiter | Website Awal, Dashboard, Profil Company, Lowongan, Kandidat, Talent Search, Chat, Paket |
| Superadmin | Monitoring, Pelamar, Recruiter, Lowongan, Analytics, Moderasi, Chat |

## G. Daftar Module Aplikasi
| Modul | Ringkasan |
| --- | --- |
| Auth & Session | Register, login, logout, me, change password |
| Password Recovery | Forgot/reset password, email token |
| Public Job Discovery | Listing lowongan, filter, lokasi, geolocation |
| Candidate Workspace | Profil, readiness, lamaran, chat |
| Recruiter Workspace | Company profile, jobs, candidates, talent, package, chat |
| Superadmin Control Center | Monitoring, analytics, moderation, account governance |
| Messaging | Threads, contacts, conversation, send message |
| Health & Ops | Health endpoint dan database readiness |
| Mock Mode | Demo/local operation tanpa backend hidup |

## H. Dependency Project
### Backend
| Package | Fungsi |
| --- | --- |
| `laravel/framework` | Framework utama backend |
| `laravel/sanctum` | Token auth API |
| `laravel/tinker` | Tooling Laravel |
| `phpunit/phpunit` | Dev dependency testing |

### Frontend
| Package | Fungsi |
| --- | --- |
| `react` / `react-dom` | UI framework |
| `react-router-dom` | Routing SPA |
| `axios` | HTTP client |
| `zustand` | Auth state management |
| `vite` | Build/dev server |
| `@vitejs/plugin-react` | Integrasi React ke Vite |

## I. Teknologi yang Digunakan
| Area | Teknologi |
| --- | --- |
| Bahasa backend | PHP |
| Bahasa frontend | JavaScript/JSX |
| Backend framework | Laravel 10 |
| Frontend framework | React 18 |
| Auth API | Sanctum bearer token |
| Database | MySQL/MariaDB, PostgreSQL |
| Styling | CSS custom |
| Build tool | Vite |
| Deployment | Bergantung pada infrastruktur aktif |
| Mail | Laravel Mail (`log`/SMTP) |
| Browser API | Geolocation, localStorage |
| External deep link | WhatsApp |

## J. Asumsi Analisis
1. Dokumen ini diturunkan dari implementasi source code terkini pada 14 Mei 2026.
2. Beberapa requirement “to-be” ditambahkan sebagai pelengkap profesional ketika UI sudah mengindikasikan intent bisnis, tetapi backend persistence belum lengkap.
3. Field recruiter seperti gender kandidat, batas usia, pendidikan minimum, domisili, shift, dan expiry date dianggap sebagai requirement bisnis yang direncanakan, namun saat ini belum seluruhnya masuk ke model data backend.
4. Berdasarkan konfigurasi `backend/api`, endpoint chat dan sebagian recruiter workspace perlu divalidasi ulang pada deployment production agar routing adapter deployment tetap konsisten sebagaimana endpoint auth/jobs/admin dasar.
