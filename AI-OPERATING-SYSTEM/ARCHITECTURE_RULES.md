# Architecture Rules

Dokumen ini menentukan kode harus tinggal di mana dan siapa yang bertanggung jawab atas apa.

## 1. Prinsip Inti

- Struktur mengikuti modul bisnis, bukan sekadar jenis file.
- Satu layer punya satu tanggung jawab utama.
- Business logic tidak boleh tersebar.
- Query, logging, dan integrasi eksternal harus punya tempat tetap.
- Flow baru harus masuk ke pola yang sama, bukan membuat pola baru.

## 2. Layer

### Presentation

Isi:
- controller
- form request
- API resource
- page action
- console command tipis

Tugas:
- menerima input
- validasi boundary awal
- memanggil use case
- mengembalikan response

Dilarang:
- query database langsung
- business rule kompleks
- transaction orchestration

### Application

Isi:
- use case
- application service
- action class

Tugas:
- mengatur alur satu aksi bisnis
- menentukan urutan langkah
- memanggil repository, policy, notifier, audit log
- menentukan transaction boundary

### Domain

Isi:
- entity
- value object
- policy domain
- invariant
- state transition rule

Tugas:
- menyimpan aturan bisnis inti
- menjaga status transition tetap valid
- menjaga invariant domain

### Infrastructure

Isi:
- repository implementation
- external API client
- mailer
- queue publisher
- file storage adapter
- cache adapter
- logger or audit adapter

Tugas:
- detail teknis I/O
- implementasi koneksi ke sistem luar

## 3. Ownership

- `Controller` atau `Command`: input dan output
- `Use case`: orchestration
- `Domain`: aturan inti
- `Repository`: query dan persistence
- `Policy`: authorization decision
- `Audit logger`: jejak aksi penting
- `Application logger`: debug, info, warning, error teknis

## 4. Aturan Penempatan

- login flow utama di `Application`
- cek user aktif atau state bisnis di `Domain` atau `Application`, tergantung sifat aturannya
- query cari user, invoice, request, dan reporting di `Repository` atau `QueryService`
- log teknis di application layer atau infrastructure boundary
- audit log di service khusus, jangan `Log::info` bercampur dengan audit
- event external atau webhook adapter di infrastructure

## 5. Query Rules

- Query tidak boleh hidup di controller atau blade/component.
- Query reporting atau listing besar boleh dipisah ke `QueryService`.
- Query write dan query read boleh dipisah jika kebutuhan mulai kompleks.
- Semua query sensitif harus membawa scope auth atau tenant secara eksplisit.

## 6. Logging Rules

- Flow penting harus traceable.
- Jangan log setiap baris.
- Log di titik penting:
  - request masuk
  - sebelum langkah sensitif
  - setelah state berubah
  - saat gagal
  - saat selesai

## 7. Forbidden Patterns

- controller gemuk
- query di view, component, atau helper acak
- domain rule di JavaScript atau frontend saja
- helper global yang diam-diam berisi aturan bisnis
- side effect tersembunyi dalam repository
- satu file menangani input, query, business logic, dan logging sekaligus

## 8. Golden Rule

Kalau bingung menaruh sesuatu, tanya:
- ini urusan tampilan, proses, aturan bisnis, atau I/O?
- siapa yang seharusnya mengubah ini kalau requirement berubah?

Jawaban dua pertanyaan itu biasanya sudah menentukan foldernya.
