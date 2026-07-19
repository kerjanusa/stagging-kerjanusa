# Migration and Release Rules

Dokumen ini fokus pada perubahan schema, rollout, dan release aman.

## 1. Prinsip Inti

- Schema change adalah release concern, bukan runtime concern.
- Jangan membuat atau mengubah tabel dari request handler production.
- Perubahan schema high risk harus kecil, terpisah, dan bisa dipulihkan.

## 2. No Runtime Schema Repair

Yang dilarang:

- `Schema::create()` di service request path
- fallback permanen `hasColumn()` untuk menutup migration yang belum jalan
- bootstrap production yang diam-diam memperbaiki schema

Fallback runtime hanya boleh bersifat sementara, eksplisit, dan punya removal plan.

## 3. Expand, Migrate, Contract

Untuk perubahan besar:

1. expand:
   tambahkan kolom atau tabel baru tanpa mematahkan pembaca lama
2. migrate:
   pindahkan atau backfill data
3. contract:
   hapus kolom lama setelah semua consumer pindah

## 4. Migration Checklist

Sebelum merge:

- tujuan perubahan schema jelas
- data existing aman
- default dan nullability dipikirkan
- index dan constraint dipertimbangkan
- rollback atau roll-forward plan ada

Sebelum deploy:

- backup tersedia
- migration diuji di environment non-production
- estimasi lock dan durasi diketahui
- monitoring setelah migration disiapkan

## 5. Backfill Rules

- Backfill besar sebaiknya tidak dibebankan ke request user.
- Gunakan command, job, atau script operasional yang jelas.
- Backfill harus idempotent bila mungkin.
- Track progress dan failure count.

## 6. Release Sequence

Urutan aman yang umum:

1. deploy kode yang kompatibel dengan schema lama dan baru
2. jalankan migration
3. jalankan backfill bila perlu
4. aktifkan feature flag atau consumer baru
5. buang compat layer setelah stabil

## 7. Rollback dan Roll-Forward

- Tidak semua migration aman di-rollback.
- Untuk perubahan destruktif, lebih aman menyiapkan roll-forward plan.
- Tentukan siapa yang mengeksekusi keputusan rollback.

## 8. High Risk Changes

Anggap high risk bila menyentuh:

- users
- auth
- billing
- files
- export
- queue
- status transition inti

Perubahan seperti ini sebaiknya:

- dipisah dari perubahan kosmetik
- punya review tambahan
- punya smoke test khusus

## 9. Red Flags

- migration digabung dengan refactor besar yang tidak relevan
- request production membuat tabel sendiri
- compat layer dibiarkan permanen tanpa cleanup plan
- tidak ada backup atau restore check
- perubahan schema sensitif tanpa test atau smoke test
