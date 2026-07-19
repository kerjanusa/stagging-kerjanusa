# AI Coding Rules

Dokumen ini adalah aturan saat memakai AI untuk menghasilkan kode.

## 1. Peran AI

AI harus diperlakukan seperti engineer cepat yang bekerja di bawah constraint ketat.

AI wajib:
- menjaga struktur yang sudah ada
- mengikuti aturan layer
- menyebut asumsi
- memikirkan auth, query, logging, dan failure path

AI dilarang:
- membuat pola baru tanpa alasan kuat
- mengarang API atau perilaku framework
- menyentuh terlalu banyak modul untuk task kecil
- menaruh logic di folder yang salah

## 2. Sebelum Menulis Kode

AI harus menjelaskan:
- tujuan task
- modul yang terdampak
- folder yang akan diubah
- risiko auth, data, atau migration
- apakah perubahan ini perlu test

Jika task menyentuh auth, tenant, payment, export, file upload, atau secret dan konteks belum jelas, AI harus berhenti dan meminta aturan lebih dulu.

## 3. Aturan Implementasi

- Satu task = satu perubahan yang jelas.
- Prefer function kecil dengan nama yang menjelaskan niat.
- Comment hanya untuk menjelaskan alasan atau niat, bukan mengulang syntax.
- Gunakan service atau use case untuk flow bisnis.
- Gunakan repository atau query service untuk akses data.
- Gunakan policy atau rule service untuk authorization.
- Gunakan audit log service untuk jejak sensitif.

## 4. Aturan Function

- Nama function harus menjelaskan aksi.
- Hindari function raksasa.
- Pisahkan:
  - validasi input
  - authorization
  - business rule
  - persistence
  - side effect
  - logging

Contoh nama yang baik:
- `validateLoginInput`
- `ensureUserCanLogin`
- `createAuthenticatedSession`
- `recordSuccessfulLogin`

## 5. Aturan Logging

- Gunakan log terstruktur.
- Sertakan context penting:
  - `request_id`
  - `actor_id`
  - `tenant_id` bila ada
  - `action`
  - `step`
- Jangan log password, token, secret, atau payload sensitif mentah.

## 6. Aturan Error

- Jangan `catch` lalu diam.
- Tambahkan context langkah saat throw atau log error.
- Error ke user harus aman.
- Detail teknis tetap di log.

## 7. Aturan Test

Minimal test untuk:
- flow auth
- permission denial
- status transition
- query scope tenant atau ownership
- bug fix penting

## 8. Stop Conditions

AI harus berhenti jika:
- aturan auth belum jelas
- penempatan folder belum jelas
- task terlalu besar
- ada perubahan schema sensitif tanpa migration plan
- ada risiko kebocoran data yang belum dipahami
