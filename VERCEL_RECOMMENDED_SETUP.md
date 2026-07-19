# Recommended Vercel Setup

Dokumen ini dibuat untuk setup yang paling rapi untuk project ini:

- Satu repo GitHub: `reggy29012025-design/stagging-kerjanusa`
- Dua project Vercel terpisah:
  - `stagging-kerjanusa-backend`
  - `stagging-kerjanusa-frontend`
- Keduanya tetap sinkron karena sama-sama deploy dari branch `main` repo yang sama.

## Kenapa Dipisah?

Frontend dan backend punya cara deploy berbeda:

- Frontend adalah React/Vite, output-nya file static dari folder `frontend/dist`.
- Backend adalah Laravel API, berjalan dari folder `backend` dengan route `/api`.

Dengan dipisah, kalau ada error build frontend tidak mengacaukan konfigurasi backend, dan sebaliknya. Tetapi karena sumbernya tetap satu repo dan branch yang sama, setiap push tetap membawa versi frontend dan backend yang cocok.

## Project 1: Backend

Di Vercel, buat project baru dari repo GitHub:

`reggy29012025-design/stagging-kerjanusa`

Setting project:

| Setting | Nilai |
| --- | --- |
| Project Name | `stagging-kerjanusa-backend` |
| Root Directory | `backend` |
| Framework Preset | Other |
| Build Command | kosongkan/default |
| Output Directory | kosongkan/default |
| Install Command | `composer install --no-dev --optimize-autoloader` |

Environment variables backend ada di:

`backend/.env.vercel.example`

Minimal yang wajib diganti:

- `APP_KEY`
- `APP_URL`
- `FRONTEND_APP_URL`
- `DATABASE_URL`
- `FILESYSTEM_DISK`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET`
- `AWS_ENDPOINT`
- `CORS_ALLOWED_ORIGINS`
- `SANCTUM_STATEFUL_DOMAINS`

Untuk membuat `APP_KEY`, di komputer lokal jalankan dari folder `backend`:

```bash
php artisan key:generate --show
```

Copy hasilnya ke env Vercel `APP_KEY`.

Untuk upload CV, foto profil, logo perusahaan, dan dokumen legal, backend production harus pakai storage durable.
Rekomendasi paling mudah untuk project ini adalah Supabase Storage S3-compatible karena database sudah memakai Supabase.
Isi `FILESYSTEM_DISK=s3`, lalu lengkapi `AWS_*` sesuai credential storage. Jangan pakai disk `local` atau `public` di Vercel karena file serverless bisa hilang.

Setelah deploy backend berhasil, cek:

```text
https://DOMAIN-BACKEND-VERCEL/api/health
https://DOMAIN-BACKEND-VERCEL/api/health/database
```

## Project 2: Frontend

Buat project Vercel kedua dari repo GitHub yang sama:

`reggy29012025-design/stagging-kerjanusa`

Setting project:

| Setting | Nilai |
| --- | --- |
| Project Name | `stagging-kerjanusa-frontend` |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

Environment variables frontend ada di:

`frontend/.env.production.example`

Yang wajib diisi di Vercel frontend:

```text
VITE_API_URL=https://DOMAIN-BACKEND-VERCEL/api
```

## Urutan Paling Aman

1. Import repo ke Vercel sebagai backend dulu.
2. Isi env backend dari `backend/.env.vercel.example`.
3. Deploy backend.
4. Copy URL backend.
5. Import repo yang sama ke Vercel sebagai frontend.
6. Isi env frontend: `VITE_API_URL=https://URL-BACKEND/api`.
7. Deploy frontend.
8. Copy URL frontend.
9. Update env backend:
   - `FRONTEND_APP_URL=https://URL-FRONTEND`
   - `CORS_ALLOWED_ORIGINS=https://URL-FRONTEND`
   - `SANCTUM_STATEFUL_DOMAINS=DOMAIN-FRONTEND-TANPA-HTTPS`
10. Redeploy backend.

## Cara Sinkronnya

Setelah dua project Vercel dibuat, alurnya sederhana:

```text
Push ke GitHub main
        |
        +-- Vercel deploy backend dari folder backend
        |
        +-- Vercel deploy frontend dari folder frontend
```

Jangan deploy dari root repo sebagai satu project Vercel, karena project ini memang monorepo dengan dua aplikasi.

## Checklist Setelah Deploy

- Backend `/api/health` berhasil dibuka.
- Backend `/api/health/database` berhasil dan konek database.
- Frontend bisa dibuka.
- Login/register tidak kena CORS error.
- Frontend memanggil API ke domain backend, bukan localhost.
- Reset password tidak expose debug link di production kecuali memang staging internal.

## Catatan Penting

Vercel tidak cocok untuk menyimpan upload permanen di filesystem lokal Laravel. Kalau nanti fitur upload CV, logo perusahaan, atau dokumen pelamar perlu disimpan permanen, pakai storage eksternal seperti Supabase Storage atau S3-compatible storage.
