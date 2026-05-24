# Setup & Run Backend & Frontend

Panduan lengkap menjalankan KerjaNusa backend (Laravel) dan frontend (React).

## Prerequisites

Pastikan sudah terinstall:
- **PHP 8.1+** → Check: `php -v`
- **Composer** → Check: `composer --version`
- **Node.js 18+** → Check: `node -v`
- **NPM** → Check: `npm -v`
- **MySQL/MariaDB** → (opsional, untuk environment deploy/staging)

Untuk development, bisa pakai SQLite atau MySQL.

## Quick Start

### Metode 1: Menggunakan Shell Scripts (Paling Mudah)

#### Terminal 1 - Run Backend
```bash
cd /home/lutfi/Dokumen/lutfi/dani/v3/backend
bash run-backend.sh
```

Backend akan berjalan di: **http://localhost:8000/api**

#### Terminal 2 - Run Frontend
```bash
cd /home/lutfi/Dokumen/lutfi/dani/v3/frontend
bash run-frontend.sh
```

Frontend akan berjalan di URL yang ditampilkan Vite, biasanya: **http://localhost:5173**

## Metode 2: Manual Setup

### Backend Setup

#### Step 1: Masuk folder backend
```bash
cd /home/lutfi/Dokumen/lutfi/dani/v3/backend
```

#### Step 2: Install dependencies
```bash
composer install
```

**Output yang diharapkan:**
```
Loading composer repositories with package information...
Updating dependencies...
Installing dependencies...
Generating autoload files
```

#### Step 3: Setup environment
```bash
cp .env.example .env
```

#### Step 4: Generate app key
```bash
php artisan key:generate
```

**Output:**
```
Application key set successfully.
```

#### Step 5: Run server
```bash
php artisan serve
```

**Output:**
```
   INFO  Server running on [http://127.0.0.1:8000].
```

Backend siap di: `http://localhost:8000/api`

### Frontend Setup

#### Step 1: Masuk folder frontend
```bash
cd /home/lutfi/Dokumen/lutfi/dani/v3/frontend
```

#### Step 2: Install dependencies
```bash
npm install
```

**Output yang diharapkan:**
```
added XXX packages, and audited XXX packages in XXs
```

#### Step 3: Run development server
```bash
npm run dev
```

**Output:**
```
  VITE v5.0.0  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Frontend siap di URL yang ditampilkan Vite, biasanya: `http://localhost:5173`

## Akses Website

Buka browser dan akses URL frontend yang tampil di terminal Vite.
Biasanya: **http://localhost:5173**

Akan melihat:
- Login page jika belum login
- Job list page jika sudah login

## Testing API

### Menggunakan cURL

#### 1. Login
```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recruiter@example.com",
    "password": "password123"
  }'
```

Response:
```json
{
  "message": "Login successful",
  "user": { ... },
  "token": "YOUR_TOKEN_HERE"
}
```

#### 2. Copy token, gunakan di request selanjutnya
```bash
curl http://localhost:8000/api/jobs \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Menggunakan Postman

Buka Postman dan:

1. **New Request** → POST
2. **URL**: `http://localhost:8000/api/login`
3. **Headers**: `Content-Type: application/json`
4. **Body** (raw JSON):
```json
{
  "email": "recruiter@example.com",
  "password": "password123"
}
```
5. **Send** → Copy token dari response
6. **Gunakan token** di request protected dengan header:
```
Authorization: Bearer <paste_token_here>
```

## Troubleshooting

### Backend

#### Error: "Could not open input file: artisan"
```bash
composer install
php artisan key:generate
```

#### Error: "Port 8000 already in use"
```bash
php artisan serve --port=8001
```

#### Error: "PHP curl extension not enabled"
Abaikan, Laravel tetap bisa berjalan (lebih lambat saja)

---

### Frontend

#### Error: "Port 5173 already in use"
```bash
npm run dev -- --port 5173
```

#### Error: "npm: command not found"
Install Node.js dari: https://nodejs.org

#### Error: "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

## Terminal Setup

Untuk development optimal, buka **2 terminal sekaligus**:

### Terminal 1 (Backend)
```bash
cd backend
bash run-backend.sh
```
Port: `8000`

### Terminal 2 (Frontend)
```bash
cd frontend
bash run-frontend.sh
```
Port: `5173` atau port Vite lain yang tersedia

Keuntungan:
- lihat log dari kedua server
- mudah restart jika ada error
- monitor realtime

## Default Test Credentials

**Recruiter (pemberi kerja):**
```
Email: recruiter@example.com
Password: password123
Role: recruiter
```

**Candidate (pencari kerja):**
```
Email: candidate@example.com
Password: password123
Role: candidate
```

Bisa juga buat akun baru dengan klik "Daftar" di login page.

## Database (Optional)

Jika ingin pakai MySQL untuk environment deploy/staging:

### 1. Create database
```sql
CREATE DATABASE kerjanusa_db;
```

### 2. Setup .env
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=kerjanusa_db
DB_USERNAME=root
DB_PASSWORD=your_password
```

### 3. Run migrations
```bash
php artisan migrate
```

### 4. (Optional) Seed data
```bash
php artisan db:seed
```

## Environment Files

### Backend (.env)
```env
APP_NAME=KerjaNusa
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=sqlite
# atau
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=kerjanusa_db
DB_USERNAME=root
DB_PASSWORD=
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000/api
```

## Quick Commands Reference

### Backend
```bash
# Install dependencies
composer install

# Generate key
php artisan key:generate

# Run server
php artisan serve --port=8000

# Run migrations
php artisan migrate

# Reset database
php artisan migrate:reset

# Database dari awal
php artisan migrate:fresh

# Tinker (PHP shell)
php artisan tinker
```

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build optimized bundle
npm run build

# Preview hasil build
npm run preview

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Staging Workflow

Untuk push aman ke repo staging `kerjanusa/stagging-kerjanusa`, pakai script khusus berikut:
Catatan: nama repo memang memakai ejaan `stagging`, jadi nama script juga mengikuti repo tersebut.

### 1. Push code ke GitHub staging saja
```bash
./staggingpushgithub.sh "Sync backend frontend ke staging"
```

Perilaku script:
- hanya stage `backend`, `frontend`, dan script staging
- tidak `git add -A` ke seluruh repo
- push current branch `HEAD` ke branch `main` repo staging

## Checklist Sebelum Push Staging

- [ ] Backend dijalankan: `php artisan serve`
- [ ] Frontend dijalankan: `npm run dev`
- [ ] Bisa akses URL frontend lokal yang aktif, biasanya `http://localhost:5173`
- [ ] Bisa login dengan credentials
- [ ] Bisa lihat job list
- [ ] API bekerja (test di Postman)
- [ ] Database terhubung (jika pakai MySQL)

## Next Steps

1. Jalankan backend dan frontend
2. Login dan cek flow utama
3. 📝 Read API documentation
4. 🎨 Customize UI sesuai kebutuhan
5. 🔄 Add more features
6. Test menyeluruh
7. Uji di staging
8. Push ke repo staging dan verifikasi hasil deploy

## Help

Jika ada masalah:
1. Check terminal output
2. Check browser console (F12)
3. Review error messages
4. Check folder structure
5. Restart server

---

Jika perlu deploy staging, gunakan salah satu dari:
- `./staggingpushgithub.sh "pesan commit"`
