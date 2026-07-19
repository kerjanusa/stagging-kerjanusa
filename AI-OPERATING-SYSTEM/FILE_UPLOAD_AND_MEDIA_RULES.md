# File Upload and Media Rules

Dokumen ini untuk flow upload profile picture, CV, sertifikat, lampiran, dan media lain.

## 1. Prinsip Inti

- File dianggap tidak terpercaya sampai lolos validasi.
- Metadata file boleh masuk database, file mentah tidak.
- Akses file harus mengikuti auth dan ownership.
- Storage harus durable; jangan andalkan filesystem lokal serverless.

## 2. Validasi Minimum

Validasi di backend minimal mencakup:

- ukuran maksimum
- MIME type
- extension yang diizinkan
- nama aman
- jumlah file
- ownership target upload

Jangan percaya validasi frontend sebagai kontrol final.

## 3. Penyimpanan

- Simpan file ke object storage atau blob storage.
- Simpan di database hanya metadata seperti:
  - path atau key
  - original name
  - mime type
  - size
  - checksum bila perlu
  - uploader id
  - uploaded at

## 4. Nama File

- Jangan pakai nama file asli sebagai key storage final.
- Gunakan nama aman atau generated key.
- Pisahkan folder atau prefix berdasarkan domain:
  - `profile-pictures/`
  - `resumes/`
  - `certificates/`
  - `exports/`

## 5. Download dan Preview

- File sensitif tidak boleh selalu public by default.
- Resume, sertifikat, export, dan dokumen pribadi sebaiknya diakses lewat URL signed atau proxy yang mengecek authorization.
- Jangan expose path storage internal mentah jika tidak perlu.

## 6. Profile Picture

- Simpan hasil upload sebagai URL atau storage key, bukan object upload mentah.
- Batasi tipe file gambar yang aman dan umum.
- Pertimbangkan resize atau transform bila ukuran liar.

## 7. Resume dan Sertifikat

- Tentukan tipe yang diizinkan, misalnya PDF untuk resume.
- Validasi jumlah file maksimum.
- Tentukan apakah recruiter boleh melihat semua file atau hanya sebagian sesuai plan.
- Akses recruiter ke file kandidat harus tetap dicek di backend.

## 8. Video dan Link Eksternal

- Jika hanya menyimpan URL video, validasi domain atau pola provider bila ada kebijakan khusus.
- Jangan anggap URL eksternal aman; treat sebagai input user biasa.
- Jangan embed mentah tanpa sanitasi atau allowlist bila nanti dirender di UI.

## 9. Logging dan Audit

- Log upload penting dengan metadata aman:
  - actor
  - target resource
  - file type
  - size bucket
  - result
- Jangan log nama sensitif lengkap bila tidak perlu.
- Delete, replace, atau export file sensitif harus punya audit trail.

## 10. Red Flags

- file mentah disimpan di database
- storage key memakai nama file user tanpa sanitasi
- upload diterima tanpa limit ukuran
- file private di-host public permanen tanpa auth
- object upload mentah disimpan ke kolom string
- rule akses file hanya dicek di frontend
